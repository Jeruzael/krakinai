using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

public sealed class ManagedNodeHostFactory(FrameQueueBudget? budget = null) : IManagedHostFactory { public IManagedHost Create() => new ManagedNodeHost(outgoingBudget: budget); }
public sealed class ManagedNodeHost : IManagedHost
{
    private readonly HostRequestLedger requests;
    private readonly FrameQueueBudget outgoingBudget;
    public ManagedNodeHost(TimeProvider? clock = null, FrameQueueBudget? outgoingBudget = null)
    { requests = new(clock); this.outgoingBudget = outgoingBudget ?? new(); }
    private readonly CancellationTokenSource lifetime = new();
    private readonly ConcurrentDictionary<long, Task> writes = new();
    private long writeSerial;
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource stopped = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Process? process;
    private OwnedJobProcess? job;
    private FrameReader? reader;
    private FrameWriter? writer;
    private Task? reading, draining, monitoring;
    private string generation = "none", activationId = "none", origin = "", relay = "";
    private int failed;
    private volatile bool closing;
    private bool disposed;
    public long PeakWorkingSetBytes { get; private set; }
    public event Action<string>? BrowserChanged;
    public event Action<string>? Failed;

    public async Task ActivateAsync(LauncherSettings settings, string generation, CancellationToken token)
    {
        if (process is not null || closing) throw new LauncherFault("HOST_ALREADY_STARTED");
        this.generation = generation; activationId = Guid.NewGuid().ToString("N"); origin = settings.AppOrigin; relay = settings.RelayAddress;
        var start = new ProcessStartInfo(settings.NodePath)
        {
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            WorkingDirectory = settings.BridgeDirectory,
        };
        foreach (var arg in new[] { settings.ManagedEntry, "--app-origin", settings.AppOrigin, "--port", settings.RelayPort.ToString(System.Globalization.CultureInfo.InvariantCulture), "--generation", generation }) start.ArgumentList.Add(arg);
        WindowsEnvironment.Apply(start);
        job = new OwnedJobProcess();
        process = Process.Start(start) ?? throw new LauncherFault("HOST_START_FAILED");
        try { job.Attach(process); }
        catch
        {
            // This is the process handle just created above; it has not been activated.
            try { if (!process.HasExited) process.Kill(); } catch (InvalidOperationException) { }
            throw;
        }
        reader = new(process.StandardOutput.BaseStream, FrameDirection.HostResponse);
        writer = new(process.StandardInput.BaseStream, FrameDirection.HostRequest, outgoingBudget);
        reading = ReadAsync(); draining = DrainDiagnosticsAsync(process.StandardError.BaseStream); monitoring = MonitorAsync();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.Token); deadline.CancelAfter(TimeSpan.FromSeconds(10));
        await writer.WriteAsync(FrameCodec.Make("activate", generation, "host", activationId), deadline.Token);
        try { await ready.Task.WaitAsync(deadline.Token); }
        catch (OperationCanceledException) when (ready.Task.IsFaulted) { await ready.Task; throw; }
    }
    public async Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token)
    {
        if (closing || writer is null || !ready.Task.IsCompletedSuccessfully) throw new LauncherFault("DISCONNECTED");
        FrameCodec.Validate(frame, FrameDirection.HostRequest);
        if (FrameCodec.Text(frame, "kind") != "call" || FrameCodec.Text(frame, "generation") != generation) throw new LauncherFault("HOST_CHANGED");
        token.ThrowIfCancellationRequested();
        var pending = requests.Reserve(frame);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.Token); deadline.CancelAfter(TimeSpan.FromSeconds(15));
        using var registration = deadline.Token.Register(() => requests.CancelCaller(pending, deadline.Token));
        long id = Interlocked.Increment(ref writeSerial); var send = SendCallAsync(frame, pending); writes.TryAdd(id, send);
        _ = send.ContinueWith(_ => { writes.TryRemove(id, out var removed); }, TaskScheduler.Default);
        return await pending.Completion;
    }
    private async Task SendCallAsync(JsonElement frame, HostRequestLedger.Pending pending)
    {
        try
        {
            // Once the guard admits a write, only host shutdown may interrupt it.
            // Caller cancellation still cancels its wait, never a partial shared frame.
            await writer!.WriteIfAsync(frame, lifetime.Token, () => requests.TryBeginWrite(pending));
        }
        catch (Exception error)
        {
            if (pending.WritingBegan) { if (!closing) Fail("HOST_WRITE_FAILED"); }
            else requests.RejectUnsent(pending, error is LauncherFault { Code: "IPC_QUEUE_LIMIT" } ? new LauncherFault("QUEUE_FULL") : error);
        }
    }
    private async Task MonitorAsync()
    {
        try
        {
            while (!lifetime.IsCancellationRequested)
            {
                await Task.Delay(250, lifetime.Token);
                if (requests.HasExpired()) { Fail("HOST_REQUEST_TIMEOUT"); return; }
            }
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
    }
    private async Task ReadAsync()
    {
        try
        {
            while (await reader!.ReadAsync(lifetime.Token) is { } frame)
            {
                if (FrameCodec.Text(frame, "generation") != generation) throw new LauncherFault("HOST_CHANGED");
                var kind = FrameCodec.Text(frame, "kind");
                if (kind == "result")
                {
                    requests.Complete(frame);
                    continue;
                }
                if (FrameCodec.Text(frame, "connectionId") != "host") throw new LauncherFault("IPC_IDENTITY_MISMATCH");
                switch (kind)
                {
                    case "ready":
                        if (FrameCodec.Text(frame, "requestId") != activationId || FrameCodec.Text(frame, "origin") != origin || FrameCodec.Text(frame, "relay") != relay || ready.Task.IsCompleted) throw new LauncherFault("HOST_CHANGED");
                        ready.TrySetResult(); break;
                    case "state": BrowserChanged?.Invoke(FrameCodec.Text(frame.GetProperty("state"), "browser")); break;
                    case "stopped": stopped.TrySetResult(); break;
                    case "error": Fail(FrameCodec.Text(frame, "code")); break;
                    default: throw new LauncherFault("IPC_METHOD_DENIED");
                }
            }
            if (!closing) Fail("HOST_EXITED");
        }
        catch (OperationCanceledException) when (closing) { }
        catch (Exception error) { if (!closing) Fail(error is LauncherFault fault ? fault.Code : "HOST_PROTOCOL_ERROR"); }
    }
    private async Task DrainDiagnosticsAsync(Stream stream)
    {
        var bytes = new byte[1024]; int total = 0;
        try
        {
            while (true)
            {
                int count = await stream.ReadAsync(bytes, lifetime.Token); if (count == 0) return;
                total += count; if (total > 65536) { Fail("HOST_DIAGNOSTIC_LIMIT"); return; }
                Array.Clear(bytes); // Never record or display raw child diagnostics.
            }
        }
        catch (OperationCanceledException) when (closing) { }
        catch { if (!closing) Fail("HOST_EXITED"); }
    }
    private void Fail(string code)
    {
        if (closing || Interlocked.Exchange(ref failed, 1) != 0) return;
        var error = new LauncherFault(code); ready.TrySetException(error); stopped.TrySetException(error);
        requests.Close(error); lifetime.Cancel();
        try { Failed?.Invoke(code); } catch { }
    }
    public async Task StopAsync(CancellationToken token)
    {
        if (closing) return; CapturePeak(); closing = true;
        requests.Close(new LauncherFault("DISCONNECTED"));
        if (process is null || process.HasExited) return;
        if (writer is not null)
        {
            await writer.WriteAsync(FrameCodec.Make("shutdown", generation, "host", Guid.NewGuid().ToString("N")), token);
            await stopped.Task.WaitAsync(token); await process.WaitForExitAsync(token);
        }
        CapturePeak();
    }
    private void CapturePeak() { try { process?.Refresh(); PeakWorkingSetBytes = Math.Max(PeakWorkingSetBytes, process?.PeakWorkingSet64 ?? 0); } catch (InvalidOperationException) { } }
    public async ValueTask DisposeAsync()
    {
        if (disposed) return; disposed = true; closing = true; lifetime.Cancel();
        requests.Close(new LauncherFault("DISCONNECTED"));
        CapturePeak(); job?.Dispose();
        if (process is not null)
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            try { await process.WaitForExitAsync(deadline.Token); } catch (InvalidOperationException) { }
            CapturePeak();
        }
        if (reading is not null) await reading;
        if (draining is not null) await draining;
        if (monitoring is not null) await monitoring;
        await Task.WhenAll(writes.Values);
        reader?.Dispose(); writer?.Dispose(); process?.Dispose(); lifetime.Dispose();
    }
}
