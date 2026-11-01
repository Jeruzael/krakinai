using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

public sealed record LauncherStatus(string Bridge, string Browser, bool Mcp, string Origin, string Relay, string Generation, string? ErrorCode = null, string Policy = "");
public sealed class LauncherFault(string code) : Exception(code) { public string Code { get; } = code; }
public interface IManagedHost : IAsyncDisposable
{
    event Action<string>? BrowserChanged;
    event Action<string>? Failed;
    Task ActivateAsync(LauncherSettings settings, string generation, CancellationToken token);
    Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token);
    Task StopAsync(CancellationToken token);
}
public interface IManagedHostFactory { IManagedHost Create(); }

public sealed class BridgeController : IAsyncDisposable
{
    private readonly object sync = new();
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly IReadinessProbe readiness;
    private readonly IManagedHostFactory factory;
    private LauncherSettings settings;
    private LauncherStatus status;
    private IManagedHost? host;
    private CancellationTokenSource? starting;
    private Task? startTask;
    private long ticket;
    private bool wantedRunning;
    private volatile bool acceptCalls;
    private bool disposed;
    public event Action<LauncherStatus>? StatusChanged;
    public LauncherStatus Status => Volatile.Read(ref status);
    public LauncherSettings Settings => settings;

    public BridgeController(LauncherSettings settings, IReadinessProbe readiness, IManagedHostFactory factory)
    {
        this.settings = settings; this.readiness = readiness; this.factory = factory;
        status = new("stopped", "not-paired", false, settings.AppOrigin, settings.RelayAddress, "none");
    }
    public void UpdateSettings(LauncherSettings value, string? path = null)
    {
        lock (sync)
        {
            if (Status.Bridge is not ("stopped" or "error") || wantedRunning) throw new LauncherFault("STOP_BEFORE_SETTINGS");
            if (value.Validate() is { } error) throw new LauncherFault(error);
            if (value.InstallationId != settings.InstallationId) throw new LauncherFault("INSTALLATION_ID_CHANGED");
            // Serialize persistence with Start: rejection or write failure leaves both
            // the active configuration and the existing file unchanged.
            if (path is not null) value.Save(path);
            settings = value;
            Publish(current => current with { Origin = value.AppOrigin, Relay = value.RelayAddress, ErrorCode = null });
        }
    }
    public Task StartAsync()
    {
        lock (sync)
        {
            if (disposed) throw new ObjectDisposedException(nameof(BridgeController));
            if (wantedRunning && startTask is not null) return startTask;
            wantedRunning = true;
            return startTask = RunStartAsync(++ticket, false);
        }
    }
    public Task RestartAsync()
    {
        lock (sync)
        {
            if (disposed) throw new ObjectDisposedException(nameof(BridgeController));
            wantedRunning = true; acceptCalls = false; starting?.Cancel();
            return startTask = RunStartAsync(++ticket, true);
        }
    }
    public Task StopAsync()
    {
        lock (sync)
        {
            wantedRunning = false; acceptCalls = false; starting?.Cancel();
            return RunStopAsync(++ticket);
        }
    }
    public async Task SetMcpConnectedAsync(bool connected)
    {
        bool lost;
        lock (sync) { lost = Status.Mcp && !connected; Publish(current => current with { Mcp = connected }); }
        if (lost) await StopAsync();
    }
    public async Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token)
    {
        var current = Volatile.Read(ref host); var snapshot = Status;
        if (!acceptCalls || current is null || snapshot.Bridge != "running") throw new LauncherFault("DISCONNECTED");
        if (frame.GetProperty("generation").GetString() != snapshot.Generation) throw new LauncherFault("HOST_CHANGED");
        var result = await current.CallAsync(frame, token);
        if (!acceptCalls || !ReferenceEquals(current, Volatile.Read(ref host)) || Status.Generation != snapshot.Generation) throw new LauncherFault("HOST_CHANGED");
        return result;
    }
    private bool Current(long command) => Volatile.Read(ref ticket) == command;
    private void Publish(Func<LauncherStatus, LauncherStatus> update)
    {
        lock (sync)
        {
            var value = update(status);
            Volatile.Write(ref status, value);
            try { StatusChanged?.Invoke(value); } catch { /* Views enqueue work, never alter consent. */ }
        }
    }
    private async Task RunStartAsync(long command, bool restart)
    {
        await gate.WaitAsync();
        try
        {
            if (!Current(command)) return;
            if (restart) await StopCoreAsync();
            if (host is not null && Status.Bridge == "running") return;
            using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            lock (sync) starting = cancellation;
            string generation = Guid.NewGuid().ToString("N");
            Publish(current => current with { Bridge = "starting", Browser = "not-paired", Generation = generation, ErrorCode = null });
            try
            {
                var check = await readiness.CheckAsync(settings, cancellation.Token);
                if (!Current(command)) return;
                if (!check.Ready)
                {
                    lock (sync) wantedRunning = false;
                    Publish(current => current with { Bridge = "error", ErrorCode = check.Code }); return;
                }
                var created = factory.Create(); host = created;
                created.BrowserChanged += browser =>
                {
                    lock (sync)
                    {
                        if (ReferenceEquals(host, created) && Status.Generation == generation &&
                            Status.Bridge is "starting" or "running" && browser is "not-paired" or "pairing" or "paired" or "expired")
                            Publish(current => current with { Browser = browser });
                    }
                };
                created.Failed += code => { if (ReferenceEquals(host, created) && Status.Generation == generation) _ = HostFailedAsync(created, generation, code); };
                await created.ActivateAsync(settings, generation, cancellation.Token);
                if (!Current(command)) { await StopCoreAsync(); return; }
                acceptCalls = true;
                Publish(current => current with { Bridge = "running", ErrorCode = null, Policy = check.Policy });
            }
            catch (OperationCanceledException)
            {
                await StopCoreAsync();
                if (Current(command)) { lock (sync) wantedRunning = false; Publish(current => current with { Bridge = "stopped", Browser = "not-paired", ErrorCode = "START_CANCELLED" }); }
            }
            catch (Exception error)
            {
                await StopCoreAsync();
                if (Current(command)) { lock (sync) wantedRunning = false; Publish(current => current with { Bridge = "error", Browser = "not-paired", ErrorCode = error is LauncherFault fault ? fault.Code : "HOST_START_FAILED" }); }
            }
            finally { lock (sync) { if (ReferenceEquals(starting, cancellation)) starting = null; } }
        }
        finally { gate.Release(); }
    }
    private async Task RunStopAsync(long command)
    {
        await gate.WaitAsync();
        try
        {
            if (!Current(command)) return;
            Publish(current => current with { Bridge = "stopping", ErrorCode = null });
            await StopCoreAsync();
            Publish(current => current with { Bridge = "stopped", Browser = "not-paired", Generation = "none", ErrorCode = null });
        }
        finally { gate.Release(); }
    }
    private async Task StopCoreAsync()
    {
        acceptCalls = false; IManagedHost? previous; lock (sync) { previous = host; host = null; }
        if (previous is null) return;
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try { await previous.StopAsync(deadline.Token); } catch { /* Dispose closes the owned job. */ }
        finally { await previous.DisposeAsync(); }
    }
    private async Task HostFailedAsync(IManagedHost failed, string generation, string code)
    {
        long command;
        lock (sync)
        {
            if (!ReferenceEquals(host, failed) || Status.Generation != generation) return;
            wantedRunning = false; acceptCalls = false; starting?.Cancel(); command = ++ticket;
        }
        await gate.WaitAsync();
        try { if (Current(command)) { await StopCoreAsync(); Publish(current => current with { Bridge = "error", Browser = "not-paired", ErrorCode = code }); } }
        finally { gate.Release(); }
    }
    public async ValueTask DisposeAsync()
    {
        lock (sync) { if (disposed) return; disposed = true; }
        await StopAsync(); gate.Dispose();
    }
}
