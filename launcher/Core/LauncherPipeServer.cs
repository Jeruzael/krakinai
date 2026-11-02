using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Krakinai.BridgeLauncher.Core;

public sealed class LauncherPipeServer : IAsyncDisposable
{
    public const int MaximumClients = 8;
    private readonly string name;
    private readonly BridgeController controller;
    private readonly TimeProvider clock;
    private readonly object sync = new(), pipeSync = new();
    private readonly SemaphoreSlim membership = new(1, 1);
    private readonly CancellationTokenSource lifetime = new();
    private readonly ConcurrentDictionary<NamedPipeServerStream, byte> pipes = new();
    private readonly HashSet<Client> clients = [];
    private Task? accepting, monitoring;
    private long serial;
    private bool disposed;
    public event Action<string>? ConnectionRejected;

    private sealed class Client : IDisposable
    {
        public readonly NamedPipeServerStream Pipe;
        public readonly CancellationTokenSource Stop;
        public readonly FrameReader Reader;
        public readonly FrameWriter Writer;
        public readonly string Route = Guid.NewGuid().ToString("N");
        public readonly TaskCompletionSource Finished = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public readonly ConcurrentDictionary<long, Task> Calls = new();
        public readonly SemaphoreSlim StatusSignal = new(0, 1);
        public Task? StatusWorker;
        public string Id = "none";
        public bool Admitted;
        public volatile bool Initialized;
        public int InFlight;
        public long LastHeartbeat;
        public readonly long Created;
        private readonly Action<NamedPipeServerStream> closePipe;
        private int closed;
        public Client(NamedPipeServerStream pipe, CancellationToken parent, TimeProvider clock, FrameQueueBudget budget, Action<NamedPipeServerStream> closePipe)
        {
            Pipe = pipe; Stop = CancellationTokenSource.CreateLinkedTokenSource(parent); this.closePipe = closePipe;
            Reader = new(pipe, FrameDirection.AdapterRequest); Writer = new(pipe, FrameDirection.AdapterResponse, budget);
            LastHeartbeat = Created = clock.GetTimestamp();
        }
        public void SignalStatus()
        {
            if (Stop.IsCancellationRequested) return;
            try { StatusSignal.Release(); } catch (SemaphoreFullException) { } catch (ObjectDisposedException) { }
        }
        public void Close() { if (Interlocked.Exchange(ref closed, 1) == 0) { Stop.Cancel(); closePipe(Pipe); } }
        public void Dispose() { Close(); Reader.Dispose(); Writer.Dispose(); StatusSignal.Dispose(); Stop.Dispose(); }
    }
    public LauncherPipeServer(string name, BridgeController controller, TimeProvider? clock = null)
    {
        if (!Regex.IsMatch(name, "^KRAKINAI\\.BridgeLauncher\\.v1\\.[a-f0-9]{32}$")) throw new LauncherFault("IPC_NAME_INVALID");
        this.name = name; this.controller = controller; this.clock = clock ?? TimeProvider.System;
    }
    public Task StartAsync()
    {
        if (accepting is not null) throw new LauncherFault("IPC_ALREADY_LISTENING");
        var listeners = new List<NamedPipeServerStream>();
        try { for (int i = 0; i <= MaximumClients; i++) listeners.Add(NewListener()); }
        catch { foreach (var pipe in listeners) ClosePipe(pipe); throw; }
        controller.StatusChanged += StatusChanged;
        accepting = Task.WhenAll(listeners.Select(AcceptAsync)); monitoring = MonitorAsync(); return Task.CompletedTask;
    }
    private NamedPipeServerStream NewListener()
    {
        lock (pipeSync)
        {
            lifetime.Token.ThrowIfCancellationRequested();
            var pipe = new NamedPipeServerStream(name, PipeDirection.InOut, MaximumClients + 1, PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly | (pipes.IsEmpty ? PipeOptions.FirstPipeInstance : PipeOptions.None), 4096, 4096);
            pipes.TryAdd(pipe, 0); return pipe;
        }
    }
    private void ClosePipe(NamedPipeServerStream pipe) { lock (pipeSync) { if (pipes.TryRemove(pipe, out _)) pipe.Dispose(); } }
    private Client[] Snapshot() { lock (sync) return clients.ToArray(); }
    private async Task AcceptAsync(NamedPipeServerStream pipe)
    {
        try
        {
            while (!lifetime.IsCancellationRequested)
            {
                await pipe.WaitForConnectionAsync(lifetime.Token);
                var client = new Client(pipe, lifetime.Token, clock, controller.OutgoingBudget, ClosePipe);
                lock (sync) clients.Add(client);
                await HandleAsync(client); pipe = NewListener();
            }
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
        catch (ObjectDisposedException) when (lifetime.IsCancellationRequested) { }
        finally { ClosePipe(pipe); }
    }
    private async Task HandleAsync(Client client)
    {
        try
        {
            using var firstDeadline = CancellationTokenSource.CreateLinkedTokenSource(client.Stop.Token); firstDeadline.CancelAfter(TimeSpan.FromSeconds(5));
            var hello = await client.Reader.ReadAsync(firstDeadline.Token) ?? throw new LauncherFault("IPC_PROTOCOL_ERROR");
            PipeIdentity.ValidateClient(client.Pipe);
            if (FrameCodec.Text(hello, "kind") != "hello") throw new LauncherFault("IPC_PROTOCOL_ERROR");
            client.Id = FrameCodec.Text(hello, "connectionId");
            bool admitted;
            await membership.WaitAsync(firstDeadline.Token);
            try { lock (sync) { admitted = clients.Count(c => c.Admitted) < MaximumClients; if (admitted) client.Admitted = true; } }
            finally { membership.Release(); }
            if (!admitted) { Reject("MCP_CLIENT_LIMIT"); await ErrorAsync(client, hello, "MCP_CLIENT_LIMIT"); return; }
            await StatusAsync(client, FrameCodec.Text(hello, "requestId")); client.StatusWorker = PumpStatusAsync(client);
            var seen = new HashSet<string>(StringComparer.Ordinal) { FrameCodec.Text(hello, "requestId") }; var order = new Queue<string>(seen);
            while (await client.Reader.ReadAsync(client.Initialized ? client.Stop.Token : firstDeadline.Token) is { } frame)
            {
                if (FrameCodec.Text(frame, "connectionId") != client.Id) throw new LauncherFault("IPC_IDENTITY_MISMATCH");
                var id = FrameCodec.Text(frame, "requestId");
                if (!seen.Add(id)) throw new LauncherFault("IPC_DUPLICATE_REQUEST");
                order.Enqueue(id); if (order.Count > 256) seen.Remove(order.Dequeue());
                switch (FrameCodec.Text(frame, "kind"))
                {
                    case "initialized":
                        if (client.Initialized) throw new LauncherFault("IPC_PROTOCOL_ERROR");
                        await membership.WaitAsync(firstDeadline.Token);
                        try
                        {
                            firstDeadline.Token.ThrowIfCancellationRequested();
                            int count; lock (sync) { client.Initialized = true; client.LastHeartbeat = clock.GetTimestamp(); count = clients.Count(c => c.Initialized); }
                            await controller.SetMcpClientCountAsync(count);
                        }
                        finally { membership.Release(); }
                        await StatusAsync(client, id); break;
                    case "heartbeat": Interlocked.Exchange(ref client.LastHeartbeat, clock.GetTimestamp()); await StatusAsync(client, id); break;
                    case "call":
                        if (!client.Initialized) throw new LauncherFault("IPC_NOT_INITIALIZED");
                        if (Interlocked.Increment(ref client.InFlight) > 16) { Interlocked.Decrement(ref client.InFlight); await ErrorAsync(client, frame, "QUEUE_FULL"); break; }
                        long callId = Interlocked.Increment(ref serial); var task = CallAsync(client, frame); client.Calls.TryAdd(callId, task);
                        _ = task.ContinueWith(_ => { client.Calls.TryRemove(callId, out var ignored); }, TaskScheduler.Default); break;
                    default: throw new LauncherFault("IPC_METHOD_DENIED");
                }
            }
        }
        catch (Exception error)
        {
            if (!lifetime.IsCancellationRequested && !client.Stop.IsCancellationRequested) Reject(error is LauncherFault fault ? fault.Code : "IPC_CONNECTION_REJECTED");
        }
        finally
        {
            client.Close();
            await membership.WaitAsync();
            try
            {
                bool wasInitialized; int count;
                lock (sync) { wasInitialized = client.Initialized; client.Initialized = false; clients.Remove(client); count = clients.Count(c => c.Initialized); }
                // Hold membership through Stop: a competing initialization cannot revive consent.
                if (wasInitialized) await controller.SetMcpClientCountAsync(count);
            }
            finally { membership.Release(); }
            await Task.WhenAll(client.Calls.Values);
            if (client.StatusWorker is not null) await client.StatusWorker;
            client.Dispose(); client.Finished.TrySetResult();
        }
    }
    private void Reject(string code) { try { ConnectionRejected?.Invoke(code); } catch { } }
    private static JsonElement Route(JsonElement frame, string connectionId)
    {
        var values = frame.EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value.Clone()); values["connectionId"] = connectionId;
        return JsonSerializer.SerializeToElement(values);
    }
    private async Task CallAsync(Client client, JsonElement frame)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(client.Stop.Token); deadline.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            var result = await controller.CallAsync(Route(frame, client.Route), deadline.Token);
            if (FrameCodec.Text(result, "connectionId") != client.Route || FrameCodec.Text(result, "requestId") != FrameCodec.Text(frame, "requestId") || FrameCodec.Text(result, "generation") != FrameCodec.Text(frame, "generation")) throw new LauncherFault("IPC_UNEXPECTED_RESULT");
            await WriteAsync(client, Route(result, client.Id));
        }
        catch (Exception error) { await ErrorAsync(client, frame, error is LauncherFault fault ? fault.Code : "DISCONNECTED"); }
        finally { Interlocked.Decrement(ref client.InFlight); }
    }
    private static async Task WriteAsync(Client client, JsonElement frame)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(client.Stop.Token); deadline.CancelAfter(TimeSpan.FromSeconds(5));
        try { await client.Writer.WriteAsync(frame, deadline.Token); }
        catch { client.Close(); }
    }
    private static Task ErrorAsync(Client client, JsonElement request, string code) => WriteAsync(client,
        FrameCodec.Make("error", FrameCodec.Text(request, "generation"), client.Id, FrameCodec.Text(request, "requestId"), ("code", code)));
    private Task StatusAsync(Client client, string requestId)
    {
        var status = controller.Status;
        var state = new Dictionary<string, object?> { ["bridge"] = status.Bridge, ["browser"] = status.Browser, ["mcp"] = status.Mcp, ["origin"] = status.Origin, ["relay"] = status.Relay };
        if (status.ErrorCode is not null) state["errorCode"] = status.ErrorCode;
        return WriteAsync(client, FrameCodec.Make("status", status.Generation, client.Id, requestId, ("state", state)));
    }
    private void StatusChanged(LauncherStatus ignored) { foreach (var client in Snapshot()) if (client.Admitted) client.SignalStatus(); }
    private async Task PumpStatusAsync(Client client)
    {
        try
        {
            while (!client.Stop.IsCancellationRequested)
            {
                await client.StatusSignal.WaitAsync(client.Stop.Token);
                await StatusAsync(client, Guid.NewGuid().ToString("N"));
            }
        }
        catch (OperationCanceledException) when (client.Stop.IsCancellationRequested) { }
    }
    public async Task CheckHeartbeatAsync()
    {
        var stale = Snapshot().Where(client => client.Initialized
            ? clock.GetElapsedTime(Interlocked.Read(ref client.LastHeartbeat)) >= TimeSpan.FromSeconds(15)
            : clock.GetElapsedTime(client.Created) >= TimeSpan.FromSeconds(5)).ToArray();
        foreach (var client in stale) client.Close();
        await Task.WhenAll(stale.Select(client => client.Finished.Task));
    }
    private async Task MonitorAsync()
    {
        try { while (!lifetime.IsCancellationRequested) { await Task.Delay(1000, lifetime.Token); await CheckHeartbeatAsync(); } }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
    }
    public async ValueTask DisposeAsync()
    {
        if (disposed) return; disposed = true; controller.StatusChanged -= StatusChanged; lifetime.Cancel();
        foreach (var pipe in pipes.Keys) ClosePipe(pipe);
        foreach (var client in Snapshot()) client.Close();
        if (accepting is not null) await accepting;
        if (monitoring is not null) await monitoring;
        membership.Dispose(); lifetime.Dispose();
    }
}
