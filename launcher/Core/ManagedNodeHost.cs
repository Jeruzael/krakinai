using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

public sealed class ManagedNodeHostFactory : IManagedHostFactory { public IManagedHost Create() => new ManagedNodeHost(); }
public sealed class ManagedNodeHost : IManagedHost
{
    private readonly CancellationTokenSource lifetime = new();
    private readonly ConcurrentDictionary<(string, string), TaskCompletionSource<JsonElement>> pending = new();
    private readonly ConcurrentDictionary<(string, string), bool> retired = new();
    private readonly ConcurrentQueue<(string, string)> retirementOrder = new();
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource stopped = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private Process? process;
    private OwnedJobProcess? job;
    private FrameReader? reader;
    private FrameWriter? writer;
    private Task? reading, draining;
    private string generation = "none", activationId = "none", origin = "", relay = "";
    private int failed, pendingCount;
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
        writer = new(process.StandardInput.BaseStream, FrameDirection.HostRequest);
        reading = ReadAsync(); draining = DrainDiagnosticsAsync(process.StandardError.BaseStream);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.Token); deadline.CancelAfter(TimeSpan.FromSeconds(10));
        await writer.WriteAsync(FrameCodec.Make("activate", generation, "host", activationId), deadline.Token);
        await ready.Task.WaitAsync(deadline.Token);
    }
    public async Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token)
    {
        if (closing || writer is null || !ready.Task.IsCompletedSuccessfully) throw new LauncherFault("DISCONNECTED");
        FrameCodec.Validate(frame, FrameDirection.HostRequest);
        if (FrameCodec.Text(frame, "kind") != "call" || FrameCodec.Text(frame, "generation") != generation) throw new LauncherFault("HOST_CHANGED");
        var key = (FrameCodec.Text(frame, "connectionId"), FrameCodec.Text(frame, "requestId"));
        if (Interlocked.Increment(ref pendingCount) > 16) { Interlocked.Decrement(ref pendingCount); throw new LauncherFault("QUEUE_FULL"); }
        var completion = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        bool completed = false;
        if (!pending.TryAdd(key, completion)) { Interlocked.Decrement(ref pendingCount); throw new LauncherFault("IPC_DUPLICATE_REQUEST"); }
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.Token); deadline.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            await writer.WriteAsync(frame, deadline.Token);
            var result = await completion.Task.WaitAsync(deadline.Token); completed = true; return result;
        }
        finally
        {
            pending.TryRemove(key, out _); Interlocked.Decrement(ref pendingCount);
            retired[key] = completed; retirementOrder.Enqueue(key);
            while (retirementOrder.Count > 128 && retirementOrder.TryDequeue(out var old)) retired.TryRemove(old, out _);
        }
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
                    var key = (FrameCodec.Text(frame, "connectionId"), FrameCodec.Text(frame, "requestId"));
                    if (pending.TryRemove(key, out var completion)) completion.TrySetResult(frame);
                    else if (!retired.TryGetValue(key, out var wasCompleted) || wasCompleted) throw new LauncherFault("IPC_UNEXPECTED_RESULT");
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
        foreach (var item in pending.Values) item.TrySetException(error);
        try { Failed?.Invoke(code); } catch { }
    }
    public async Task StopAsync(CancellationToken token)
    {
        if (closing) return; CapturePeak(); closing = true;
        foreach (var item in pending.Values) item.TrySetException(new LauncherFault("DISCONNECTED"));
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
        foreach (var item in pending.Values) item.TrySetException(new LauncherFault("DISCONNECTED"));
        CapturePeak(); job?.Dispose();
        if (process is not null)
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            try { await process.WaitForExitAsync(deadline.Token); } catch (InvalidOperationException) { }
            CapturePeak();
        }
        if (reading is not null) await reading;
        if (draining is not null) await draining;
        reader?.Dispose(); writer?.Dispose(); process?.Dispose(); lifetime.Dispose();
    }
}
