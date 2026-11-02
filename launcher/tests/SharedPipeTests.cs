using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Text.Json;
using Krakinai.BridgeLauncher.Core;

namespace Krakinai.BridgeLauncher.Tests;

internal static class SharedPipeTests
{
    private static void Require(bool value, string message) => Program.Require(value, message);
    private static LauncherSettings Settings() => new() { InstallationId = Guid.NewGuid().ToString("N"), AppOrigin = "http://localhost:5183", RelayPort = 54186 };
    private sealed class Ready : IReadinessProbe
    { public Task<ReadinessResult> CheckAsync(LauncherSettings settings, CancellationToken token) => Task.FromResult(new ReadinessResult(true, "READY", "AllSigned")); }
    private sealed class Factory : IManagedHostFactory
    {
        public readonly List<Host> Hosts = [];
        public bool HoldStop;
        public IManagedHost Create() { var host = new Host { HoldStop = HoldStop }; Hosts.Add(host); return host; }
    }
    private sealed class Host : IManagedHost
    {
        public event Action<string>? BrowserChanged;
        public event Action<string>? Failed { add { } remove { } }
        public readonly ConcurrentQueue<(JsonElement Frame, TaskCompletionSource<JsonElement> Reply)> Calls = new();
        public readonly TaskCompletionSource Stopping = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public readonly TaskCompletionSource ReleaseStop = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public bool HoldStop; public int Stops; public bool Echo;
        public void Pair() => BrowserChanged?.Invoke("paired");
        public Task ActivateAsync(LauncherSettings settings, string generation, CancellationToken token) => Task.CompletedTask;
        public Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token)
        {
            if (Echo) return Task.FromResult(Reply(frame));
            var reply = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously); Calls.Enqueue((frame, reply));
            return reply.Task.WaitAsync(token);
        }
        public static JsonElement Reply(JsonElement frame) => FrameCodec.Make("result", FrameCodec.Text(frame, "generation"), FrameCodec.Text(frame, "connectionId"), FrameCodec.Text(frame, "requestId"),
            ("result", new { apiVersion = "krakinai.mcp.v1", ok = true, data = frame.GetProperty("args").Clone() }));
        public async Task StopAsync(CancellationToken token) { Stops++; Stopping.TrySetResult(); if (HoldStop) await ReleaseStop.Task.WaitAsync(token); }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
    private sealed class Peer(NamedPipeClientStream pipe, string id) : IAsyncDisposable
    {
        public readonly NamedPipeClientStream Pipe = pipe;
        public readonly FrameReader Reader = new(pipe, FrameDirection.AdapterResponse);
        public readonly FrameWriter Writer = new(pipe, FrameDirection.AdapterRequest);
        public readonly string Id = id;
        private int serial;
        public string Next() => "r" + Interlocked.Increment(ref serial);
        public Task Send(string kind, string generation, string request, CancellationToken token, params (string, object?)[] extra) => Writer.WriteAsync(FrameCodec.Make(kind, generation, Id, request, extra), token);
        public async Task<JsonElement> Read(string request, CancellationToken token)
        {
            while (await Reader.ReadAsync(token) is { } frame) if (FrameCodec.Text(frame, "requestId") == request) return frame;
            throw new InvalidOperationException("peer closed before " + request);
        }
        public async Task Initialize(CancellationToken token)
        {
            var id = Next(); await Send("initialized", "none", id, token);
            var response = await Read(id, token); Require(FrameCodec.Text(response, "kind") == "status", "initialization rejected");
        }
        public async ValueTask DisposeAsync() { await Pipe.DisposeAsync(); Reader.Dispose(); Writer.Dispose(); }
    }
    private static async Task<Peer> Connect(string name, CancellationToken token, bool initialize = true)
    {
        var peer = new Peer(await NativeChannel.ConnectAsync(name, token), "same_external_id");
        var id = peer.Next(); await peer.Send("hello", "none", id, token);
        var response = await peer.Read(id, token);
        if (FrameCodec.Text(response, "kind") == "error") { await peer.DisposeAsync(); throw new LauncherFault(FrameCodec.Text(response, "code")); }
        Require(FrameCodec.Text(response, "kind") == "status", "hello not acknowledged");
        if (initialize) await peer.Initialize(token); return peer;
    }
    private static async Task Until(Func<bool> condition, CancellationToken token)
    { while (!condition()) await Task.Delay(10, token); }
    public static async Task MembershipAndRouting()
    {
        var settings = Settings(); var factory = new Factory();
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10)); var token = deadline.Token;
        await using var one = await Connect(settings.PipeName, token); await using var two = await Connect(settings.PipeName, token);
        await using var three = await Connect(settings.PipeName, token, false);
        Require(controller.Status.McpClients == 2 && factory.Hosts.Count == 0, "hello inflated count or initialization started host");
        await three.Initialize(token); Require(controller.Status.McpClients == 3, "three initialized peers not counted");
        await controller.StartAsync(); var host = factory.Hosts.Single(); host.Pair();
        var peers = new[] { one, two, three };
        for (int i = 0; i < peers.Length; i++) await peers[i].Send("call", controller.Status.Generation, "same_request", token, ("tool", "synthetic"), ("args", new { marker = i }));
        await Until(() => host.Calls.Count == 3, token);
        var calls = host.Calls.ToArray();
        Require(calls.Select(c => FrameCodec.Text(c.Frame, "connectionId")).Distinct().Count() == 3, "external ID collision reached host");
        Require(calls.All(c => FrameCodec.Text(c.Frame, "connectionId") != one.Id), "route was caller-controlled");
        foreach (var call in calls.Reverse()) call.Reply.TrySetResult(Host.Reply(call.Frame));
        for (int i = 0; i < peers.Length; i++)
        {
            var response = await peers[i].Read("same_request", token);
            Require(FrameCodec.Text(response, "connectionId") == peers[i].Id && response.GetProperty("result").GetProperty("data").GetProperty("marker").GetInt32() == i, "response crossed peers");
        }
        host.Echo = true; await one.Pipe.DisposeAsync(); await Until(() => controller.Status.McpClients == 2, token);
        Require(controller.Status.Bridge == "running" && controller.Status.Browser == "paired" && host.Stops == 0, "one client globally revoked others");
        await two.Send("call", controller.Status.Generation, "healthy", token, ("tool", "synthetic"), ("args", new { marker = "still-paired" }));
        Require(FrameCodec.Text(await two.Read("healthy", token), "kind") == "result", "surviving peer unusable");
    }
    public static async Task Capacity()
    {
        var settings = Settings(); var factory = new Factory();
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10)); var peers = new List<Peer>();
        try
        {
            for (int i = 0; i < 8; i++) peers.Add(await Connect(settings.PipeName, deadline.Token));
            try { await using var extra = await Connect(settings.PipeName, deadline.Token); throw new InvalidOperationException("ninth peer admitted"); }
            catch (LauncherFault error) when (error.Code == "MCP_CLIENT_LIMIT") { }
            Require(controller.Status.McpClients == 8 && factory.Hosts.Count == 0, "capacity rejection displaced clients or started host");
            System.Diagnostics.Process.GetCurrentProcess().Refresh();
            Console.WriteLine("EIGHT_CLIENT_NATIVE_PEAK_WORKING_SET_BYTES=" + System.Diagnostics.Process.GetCurrentProcess().PeakWorkingSet64);
            foreach (var peer in peers)
            {
                var id = peer.Next(); await peer.Send("heartbeat", "none", id, deadline.Token);
                FrameCodec.Validate(await peer.Read(id, deadline.Token), FrameDirection.AdapterResponse);
            }
        }
        finally { foreach (var peer in peers) await peer.DisposeAsync(); }
    }
    public static async Task FinalLossRace()
    {
        var settings = Settings(); var factory = new Factory { HoldStop = true };
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10)); var token = deadline.Token;
        await using var one = await Connect(settings.PipeName, token); await controller.StartAsync(); var host = factory.Hosts.Single(); host.Pair();
        await using var arriving = await Connect(settings.PipeName, token, false);
        await one.Pipe.DisposeAsync(); await host.Stopping.Task.WaitAsync(token);
        var initialized = arriving.Initialize(token); await Task.Delay(100, token);
        Require(!initialized.IsCompleted && !controller.Status.Mcp, "new initialization escaped final-client Stop");
        host.ReleaseStop.TrySetResult(); await initialized;
        Require(controller.Status.McpClients == 1 && controller.Status.Bridge == "stopped" && controller.Status.Browser == "not-paired" && controller.Status.Generation == "none" && factory.Hosts.Count == 1 && host.Stops == 1,
            "arriving client revived old generation or consent");
    }
    public static async Task IsolatedPeerFailures()
    {
        var settings = Settings(); var factory = new Factory(); var clock = new SharedSessionTests.Clock();
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller, clock); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10)); var token = deadline.Token;
        await using var healthy = await Connect(settings.PipeName, token); await using var stale = await Connect(settings.PipeName, token);
        await controller.StartAsync(); var host = factory.Hosts.Single(); host.Echo = true; host.Pair();
        clock.Tick = 10000;
        var beat = healthy.Next(); await healthy.Send("heartbeat", "none", beat, token); await healthy.Read(beat, token);
        clock.Tick = 15000; await server.CheckHeartbeatAsync();
        Require(controller.Status.McpClients == 1 && controller.Status.Browser == "paired" && host.Stops == 0, "stale peer revoked healthy peer");
        await using var malformed = await Connect(settings.PipeName, token);
        await malformed.Pipe.WriteAsync(FrameCodec.Utf8.GetBytes("{\"kind\":\"activate\"}\n"), token);
        await Until(() => controller.Status.McpClients == 1, token);
        await healthy.Send("call", controller.Status.Generation, "healthy", token, ("tool", "synthetic"), ("args", new { }));
        Require(FrameCodec.Text(await healthy.Read("healthy", token), "kind") == "result", "malformed peer damaged healthy peer");
        await healthy.Pipe.DisposeAsync(); await Until(() => controller.Status.Bridge == "stopped", token);
        Require(!controller.Status.Mcp && controller.Status.McpClients == 0 && controller.Status.Browser == "not-paired" && host.Stops == 1, "final peer did not stop once");
    }
    public static async Task SlowStatusReader()
    {
        var settings = Settings(); var factory = new Factory();
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(12)); var token = deadline.Token;
        await using var slow = await Connect(settings.PipeName, token); await using var healthy = await Connect(settings.PipeName, token);
        await controller.StartAsync(); var host = factory.Hosts.Single(); host.Echo = true;
        var healthyRead = healthy.Read("responsive", token);
        var elapsed = System.Diagnostics.Stopwatch.StartNew();
        while (controller.Status.McpClients == 2 && elapsed.Elapsed < TimeSpan.FromSeconds(8)) { host.Pair(); await Task.Delay(5, token); }
        await Until(() => controller.Status.McpClients == 1, token);
        Console.WriteLine("SLOW_READER_REMOVAL_MILLISECONDS=" + elapsed.ElapsedMilliseconds);
        await healthy.Send("call", controller.Status.Generation, "responsive", token, ("tool", "synthetic"), ("args", new { }));
        Require(FrameCodec.Text(await healthyRead, "kind") == "result", "status fanout blocked another peer");
        Require(controller.Status.McpClients == 1 && controller.Status.Bridge == "running" && controller.Status.Browser == "paired" && host.Stops == 0, "slow reader globally revoked healthy peer");
    }
    public static async Task ReconnectAndDuplicate()
    {
        var settings = Settings(); var factory = new Factory();
        await using var controller = new BridgeController(settings, new Ready(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10)); var token = deadline.Token;
        await using var survivor = await Connect(settings.PipeName, token); await using var departed = await Connect(settings.PipeName, token);
        await controller.StartAsync(); var host = factory.Hosts.Single(); host.Pair();
        await departed.Send("call", controller.Status.Generation, "reused", token, ("tool", "synthetic"), ("args", new { marker = "old" }));
        await Until(() => host.Calls.Count == 1, token); var old = host.Calls.Single();
        await departed.Pipe.DisposeAsync(); await Until(() => controller.Status.McpClients == 1, token);
        await using var replacement = await Connect(settings.PipeName, token);
        await replacement.Send("call", controller.Status.Generation, "reused", token, ("tool", "synthetic"), ("args", new { marker = "new" }));
        await Until(() => host.Calls.Count == 2, token); var fresh = host.Calls.Last();
        Require(FrameCodec.Text(old.Frame, "connectionId") != FrameCodec.Text(fresh.Frame, "connectionId"), "reconnect reused internal route");
        old.Reply.TrySetResult(Host.Reply(old.Frame));
        var received = replacement.Read("reused", token); await Task.Delay(50, token);
        Require(!received.IsCompleted, "late reply crossed into replacement");
        fresh.Reply.TrySetResult(Host.Reply(fresh.Frame));
        Require((await received).GetProperty("result").GetProperty("data").GetProperty("marker").GetString() == "new", "replacement got old response");
        await replacement.Send("call", controller.Status.Generation, "reused", token, ("tool", "synthetic"), ("args", new { marker = "duplicate" }));
        await Until(() => controller.Status.McpClients == 1, token);
        Require(host.Calls.Count == 2 && controller.Status.Browser == "paired" && host.Stops == 0, "duplicate ID reached host or revoked another client");
    }
}
