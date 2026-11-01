using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Krakinai.BridgeLauncher.Core;

public sealed class LauncherPipeServer : IAsyncDisposable
{
    private readonly string name;
    private readonly BridgeController controller;
    private readonly TimeProvider clock;
    private readonly object sync = new();
    private readonly CancellationTokenSource lifetime = new();
    private readonly ConcurrentDictionary<NamedPipeServerStream, byte> pipes = new();
    private readonly object pipeSync = new();
    private Client? active;
    private Task? accepting, monitoring;
    private long serial;
    private bool disposed;
    public event Action<string>? ConnectionRejected;
    private sealed class Client(NamedPipeServerStream pipe, CancellationToken parent, TimeProvider clock, Action<NamedPipeServerStream> closePipe) : IDisposable
    {
        public readonly NamedPipeServerStream Pipe = pipe;
        public readonly CancellationTokenSource Stop = CancellationTokenSource.CreateLinkedTokenSource(parent);
        public readonly FrameReader Reader = new(pipe, FrameDirection.AdapterRequest);
        public readonly FrameWriter Writer = new(pipe, FrameDirection.AdapterResponse);
        public readonly TaskCompletionSource Finished = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public readonly ConcurrentDictionary<long, Task> Calls = new();
        public string Id = "none";
        public bool Initialized;
        public int InFlight;
        public long LastHeartbeat = clock.GetTimestamp();
        public readonly long Created = clock.GetTimestamp();
        private int closed;
        public void Close() { if (Interlocked.Exchange(ref closed, 1) == 0) { Stop.Cancel(); closePipe(Pipe); } }
        public void Dispose() { Close(); Reader.Dispose(); Writer.Dispose(); Stop.Dispose(); }
    }
    public LauncherPipeServer(string name, BridgeController controller, TimeProvider? clock = null)
    {
        if (!Regex.IsMatch(name, "^KRAKINAI\\.BridgeLauncher\\.v1\\.[a-f0-9]{32}$")) throw new LauncherFault("IPC_NAME_INVALID");
        this.name = name; this.controller = controller; this.clock = clock ?? TimeProvider.System;
    }
    public Task StartAsync()
    {
        if (accepting is not null) throw new LauncherFault("IPC_ALREADY_LISTENING");
        var first = NewListener(); NamedPipeServerStream second;
        try { second = NewListener(); } catch { ClosePipe(first); throw; }
        controller.StatusChanged += StatusChanged;
        accepting = Task.WhenAll(AcceptAsync(first), AcceptAsync(second)); monitoring = MonitorAsync(); return Task.CompletedTask;
    }
    private NamedPipeServerStream NewListener()
    {
        lock (pipeSync)
        {
            lifetime.Token.ThrowIfCancellationRequested();
            var pipe = new NamedPipeServerStream(name, PipeDirection.InOut, 2, PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly | (pipes.IsEmpty ? PipeOptions.FirstPipeInstance : PipeOptions.None), 4096, 4096);
            pipes.TryAdd(pipe, 0); return pipe;
        }
    }
    private void ClosePipe(NamedPipeServerStream pipe)
    {
        lock (pipeSync) { if (pipes.TryRemove(pipe, out _)) pipe.Dispose(); }
    }
    private async Task AcceptAsync(NamedPipeServerStream pipe)
    {
        try
        {
            while (!lifetime.IsCancellationRequested)
            {
                await pipe.WaitForConnectionAsync(lifetime.Token);
                var client = new Client(pipe, lifetime.Token, clock, ClosePipe);
                await HandleAsync(client);
                pipe = NewListener();
            }
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
        catch (ObjectDisposedException) when (lifetime.IsCancellationRequested) { }
        finally { ClosePipe(pipe); }
    }
    private async Task HandleAsync(Client client)
    {
        bool owns = false;
        try
        {
            using var firstDeadline = CancellationTokenSource.CreateLinkedTokenSource(client.Stop.Token); firstDeadline.CancelAfter(TimeSpan.FromSeconds(5));
            var hello = await client.Reader.ReadAsync(firstDeadline.Token) ?? throw new LauncherFault("IPC_PROTOCOL_ERROR");
            PipeIdentity.ValidateClient(client.Pipe);
            if (FrameCodec.Text(hello, "kind") != "hello") throw new LauncherFault("IPC_PROTOCOL_ERROR");
            client.Id = FrameCodec.Text(hello, "connectionId");
            lock (sync) { if (active is null) { active = client; owns = true; } }
            if (!owns)
            {
                try { ConnectionRejected?.Invoke("CLIENT_ALREADY_CONNECTED"); } catch { }
                await ErrorAsync(client, hello, "CLIENT_ALREADY_CONNECTED"); return;
            }
            await StatusAsync(client, FrameCodec.Text(hello, "requestId"));
            var seen = new HashSet<string>(StringComparer.Ordinal) { FrameCodec.Text(hello, "requestId") }; var order = new Queue<string>(seen);
            while (await client.Reader.ReadAsync(client.Stop.Token) is { } frame)
            {
                if (FrameCodec.Text(frame, "connectionId") != client.Id) throw new LauncherFault("IPC_IDENTITY_MISMATCH");
                var id = FrameCodec.Text(frame, "requestId");
                if (!seen.Add(id)) throw new LauncherFault("IPC_DUPLICATE_REQUEST");
                order.Enqueue(id); if (order.Count > 256) seen.Remove(order.Dequeue());
                switch (FrameCodec.Text(frame, "kind"))
                {
                    case "initialized":
                        if (client.Initialized) throw new LauncherFault("IPC_PROTOCOL_ERROR");
                        client.Initialized = true; client.LastHeartbeat = clock.GetTimestamp();
                        await controller.SetMcpConnectedAsync(true); await StatusAsync(client, id); break;
                    case "heartbeat": client.LastHeartbeat = clock.GetTimestamp(); await StatusAsync(client, id); break;
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
            if (!lifetime.IsCancellationRequested && !client.Stop.IsCancellationRequested)
                try { ConnectionRejected?.Invoke(error is LauncherFault fault ? fault.Code : "IPC_CONNECTION_REJECTED"); } catch { }
            // Protocol/identity failures close only this connection; no raw data logging.
        }
        finally
        {
            client.Close();
            if (owns && client.Initialized) await controller.SetMcpConnectedAsync(false);
            await Task.WhenAll(client.Calls.Values);
            lock (sync) { if (ReferenceEquals(active, client)) active = null; }
            client.Dispose(); client.Finished.TrySetResult();
        }
    }
    private async Task CallAsync(Client client, JsonElement frame)
    {
        try { var result = await controller.CallAsync(frame, client.Stop.Token); await client.Writer.WriteAsync(result, client.Stop.Token); }
        catch (Exception error) { await ErrorAsync(client, frame, error is LauncherFault fault ? fault.Code : "DISCONNECTED"); }
        finally { Interlocked.Decrement(ref client.InFlight); }
    }
    private async Task ErrorAsync(Client client, JsonElement request, string code)
    {
        try { await client.Writer.WriteAsync(FrameCodec.Make("error", FrameCodec.Text(request, "generation"), client.Id, FrameCodec.Text(request, "requestId"), ("code", code)), client.Stop.Token); }
        catch { client.Close(); }
    }
    private async Task StatusAsync(Client client, string requestId)
    {
        var status = controller.Status;
        var state = new Dictionary<string, object?> { ["bridge"] = status.Bridge, ["browser"] = status.Browser, ["mcp"] = status.Mcp, ["origin"] = status.Origin, ["relay"] = status.Relay };
        if (status.ErrorCode is not null) state["errorCode"] = status.ErrorCode;
        try { await client.Writer.WriteAsync(FrameCodec.Make("status", status.Generation, client.Id, requestId, ("state", state)), client.Stop.Token); }
        catch { client.Close(); }
    }
    private void StatusChanged(LauncherStatus ignored)
    {
        Client? client; lock (sync) client = active;
        if (client is null || client.Stop.IsCancellationRequested) return;
        long id = Interlocked.Increment(ref serial); var task = StatusAsync(client, Guid.NewGuid().ToString("N")); client.Calls.TryAdd(id, task);
        _ = task.ContinueWith(_ => { client.Calls.TryRemove(id, out var removed); }, TaskScheduler.Default);
    }
    public async Task CheckHeartbeatAsync()
    {
        Client? client; lock (sync) client = active;
        if (client is null) return;
        bool stale = client.Initialized ? clock.GetElapsedTime(client.LastHeartbeat) >= TimeSpan.FromSeconds(15) : clock.GetElapsedTime(client.Created) >= TimeSpan.FromSeconds(5);
        if (stale) { client.Close(); await client.Finished.Task; }
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
        Client? client; lock (sync) client = active; client?.Close();
        if (accepting is not null) await accepting;
        if (monitoring is not null) await monitoring;
        lifetime.Dispose();
    }
}
