using Krakinai.BridgeLauncher.Core;
using System.Text.Json;
using System.Net;
using System.Net.Sockets;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;

namespace Krakinai.BridgeLauncher.Tests;

internal static class Program
{
    private static int passed;
    private static async Task<int> Main()
    {
        try
        {
            await Check("settings reject remote origins, paths and invalid ports", SettingsValidation);
            await Check("settings preserve installation identity and contain no secrets", SettingsRoundTrip);
            await Check("settings persistence is serialized with Start and failed saves preserve active settings", AtomicSettings);
            await Check("valid signature without publisher trust blocks Start", PublisherTrust);
            await Check("invalid signature and wrong approved signer block Start", SignatureValidation);
            await Check("Node 22 and existing managed build are required", RuntimeValidation);
            await Check("duplicate Start creates one host and Stop is idempotent", DuplicateLifecycle);
            await Check("process, browser and MCP status remain independent", IndependentStatus);
            await Check("Stop cancels a delayed readiness check", StopDuringStart);
            await Check("restart ignores old host status and revokes pairing", RestartGeneration);
            await Check("preflight rejection starts no process", RejectedStart);
            await Check("native IPC rejects adapter process-control and unknown fields", NativeFrameRoles);
            await Check("native IPC preserves exact Unicode payloads and rejects malformed input", NativeFrameBytes);
            await Check("real owned host activates, dispatches and releases its port", OwnedHostLifecycle);
            await Check("port conflict leaves an unrelated listener untouched", OwnedHostPortConflict);
            await Check("owned job cleanup releases a running host without a PID lookup", OwnedHostJobCleanup);
            await Check("protected pipe connects the same identity and keeps indicators independent", PrivatePipeConnection);
            await Check("second pipe controller cannot replace the first", PrivatePipeSecondClient);
            await Check("invalid adapter control closes its session without starting a process", PrivatePipeControl);
            await Check("stale initialized client stops the host and revokes its session", PrivatePipeHeartbeat);
            await Check("native presentation separates indicators and explains actionable failures", Presentation);
            await Check("an existing shared settings directory is rejected on Load and Save", SharedSettingsRejected);
            await Check("Restricted script policy blocks readiness without changing policy", RestrictedPolicyRejected);
            Console.WriteLine($"NATIVE_HARNESS_RESULT passed={passed} failed=0");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"NATIVE_HARNESS_RESULT passed={passed} failed=1 type={error.GetType().Name} message={error.Message}");
            return 1;
        }
    }

    private static async Task Check(string name, Func<Task> action)
    {
        await action(); passed++; Console.WriteLine("PASS " + name);
    }
    internal static void Require(bool condition, string label) { if (!condition) throw new InvalidOperationException(label); }
    private static LauncherSettings Settings() => new()
    {
        InstallationId = "0123456789abcdef0123456789abcdef",
        NodePath = @"C:\synthetic\node.exe",
        BridgeDirectory = @"C:\synthetic\bridge",
        NativeExecutable = @"C:\synthetic\Krakinai.BridgeLauncher.exe",
        ApprovedSignerThumbprint = new string('A', 40),
        AppOrigin = "http://localhost:5173", RelayPort = 4180,
    };

    private static Task SettingsValidation()
    {
        Require(Settings().Validate() is null, "valid settings rejected");
        foreach (var origin in new[] { "https://evil.test", "http://0.0.0.0:5173", "http://localhost:5173/", "http://user@localhost:5173", "http://localhost:5173/#/" })
            Require((Settings() with { AppOrigin = origin }).Validate() is not null, "invalid origin accepted");
        foreach (var port in new[] { 0, -1, 80, 65536 }) Require((Settings() with { RelayPort = port }).Validate() is not null, "invalid port accepted");
        Require((Settings() with { NodePath = @"\\remote\share\node.exe" }).Validate() is not null, "remote executable accepted");
        Require((Settings() with { InstallationId = "../other" }).Validate() is not null, "invalid pipe identity accepted");
        Require((Settings() with { ApprovedSignerThumbprint = "anything" }).Validate() is not null, "invalid signer accepted");
        return Task.CompletedTask;
    }
    private static Task SettingsRoundTrip()
    {
        var directory = Path.Combine(Environment.GetEnvironmentVariable("KRAKINAI_TEST_ROOT") ?? AppContext.BaseDirectory, "settings-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "launcher-settings.json");
        Settings().Save(path);
        var loaded = LauncherSettings.Load(path);
        Require(loaded == Settings(), "settings changed after persistence");
        Require(!File.ReadAllText(path).Contains("secret", StringComparison.OrdinalIgnoreCase), "settings contain secret fields");
        Require(loaded.PipeName.StartsWith("KRAKINAI.BridgeLauncher.v1.", StringComparison.Ordinal), "invalid private pipe prefix");
        Require(loaded.PipeName == Settings().PipeName, "installation identity changed");
        return Task.CompletedTask;
    }
    private static async Task PublisherTrust()
    {
        var platform = new FakePlatform { Trusted = false };
        var result = await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None);
        Require(!result.Ready && result.Code == "PUBLISHER_NOT_TRUSTED", "untrusted publisher accepted");
        Require(platform.SignatureChecks > 0, "actual signature check omitted");
    }
    private static async Task AtomicSettings()
    {
        var directory = Path.Combine(Environment.GetEnvironmentVariable("KRAKINAI_TEST_ROOT") ?? AppContext.BaseDirectory, "atomic-settings-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(directory, "settings.json"); var original = Settings(); original.Save(path);
        await using var controller = new BridgeController(original, new FakeReadiness(), new FakeHostFactory());
        var revised = original with { RelayPort = 54181 };
        controller.UpdateSettings(revised, path);
        Require(controller.Settings == revised && LauncherSettings.Load(path) == revised, "settings did not commit together");
        await controller.StartAsync();
        bool rejected = false;
        try { controller.UpdateSettings(original, path); } catch (LauncherFault error) when (error.Code == "STOP_BEFORE_SETTINGS") { rejected = true; }
        Require(rejected && controller.Settings == revised && LauncherSettings.Load(path) == revised, "Start/settings race changed disk or active settings");
        await controller.StopAsync();
        var blocked = Path.Combine(directory, "blocked-directory"); Directory.CreateDirectory(blocked);
        bool failed = false;
        try { controller.UpdateSettings(original, blocked); } catch (Exception error) when (error is IOException or UnauthorizedAccessException) { failed = true; }
        Require(failed && controller.Settings == revised && LauncherSettings.Load(path) == revised, "failed save changed active settings");
    }
    private static async Task SignatureValidation()
    {
        var platform = new FakePlatform { SignatureStatus = "HashMismatch" };
        Require((await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None)).Code == "SIGNATURE_INVALID", "invalid signature accepted");
        platform.SignatureStatus = "Valid"; platform.Thumbprint = new string('B', 40);
        Require((await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None)).Code == "SIGNER_MISMATCH", "unapproved signer accepted");
        platform.Thumbprint = new string('A', 40);
        Require((await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None)).Ready, "valid trusted setup rejected");
    }
    private static async Task RuntimeValidation()
    {
        var platform = new FakePlatform { NodeVersion = "v24.0.0" };
        Require((await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None)).Code == "NODE_VERSION", "unsupported Node accepted");
        platform.NodeVersion = "v22.23.3"; platform.FilesExist = false;
        Require((await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None)).Code == "FILE_MISSING", "missing build accepted");
    }

    private static async Task DuplicateLifecycle()
    {
        var factory = new FakeHostFactory();
        await using var controller = new BridgeController(Settings(), new FakeReadiness(), factory);
        await Task.WhenAll(controller.StartAsync(), controller.StartAsync());
        Require(factory.Hosts.Count == 1 && controller.Status.Bridge == "running", "duplicate host created");
        await Task.WhenAll(controller.StopAsync(), controller.StopAsync());
        Require(controller.Status.Bridge == "stopped" && factory.Hosts[0].Stops == 1, "Stop was not idempotent");
    }
    private static async Task IndependentStatus()
    {
        var factory = new FakeHostFactory();
        await using var controller = new BridgeController(Settings(), new FakeReadiness(), factory);
        await controller.StartAsync();
        Require(controller.Status.Browser == "not-paired" && !controller.Status.Mcp, "Start implied consent/client");
        await controller.SetMcpConnectedAsync(true);
        Require(controller.Status.Mcp && controller.Status.Browser == "not-paired", "MCP implied browser consent");
        factory.Hosts[0].Browser("paired");
        Require(controller.Status.Browser == "paired", "browser event not reflected");
        await controller.StopAsync();
        Require(controller.Status.Browser == "not-paired" && controller.Status.Mcp, "Stop confused persistent MCP registration with pairing");
    }
    private static async Task StopDuringStart()
    {
        var readiness = new FakeReadiness { Delay = true }; var factory = new FakeHostFactory();
        await using var controller = new BridgeController(Settings(), readiness, factory);
        var starting = controller.StartAsync(); await readiness.Entered.Task;
        await controller.StopAsync(); await starting;
        Require(controller.Status.Bridge == "stopped" && factory.Hosts.Count == 0, "cancelled Start created a host");
    }
    private static async Task RestartGeneration()
    {
        var factory = new FakeHostFactory();
        await using var controller = new BridgeController(Settings(), new FakeReadiness(), factory);
        await controller.StartAsync(); var old = factory.Hosts[0]; old.Browser("paired"); var generation = controller.Status.Generation;
        await controller.RestartAsync(); old.Browser("paired");
        Require(controller.Status.Generation != generation && controller.Status.Browser == "not-paired", "old host affected fresh session");
        await controller.SetMcpConnectedAsync(true); await controller.SetMcpConnectedAsync(false);
        Require(controller.Status.Bridge == "stopped", "lost MCP client left session active");
    }
    private static async Task RejectedStart()
    {
        var factory = new FakeHostFactory();
        await using var controller = new BridgeController(Settings(), new FakeReadiness { Rejection = "PUBLISHER_NOT_TRUSTED" }, factory);
        await controller.StartAsync();
        Require(controller.Status.Bridge == "error" && controller.Status.ErrorCode == "PUBLISHER_NOT_TRUSTED" && factory.Hosts.Count == 0, "failed readiness created process");
    }

    private static JsonElement Wire(string kind, string extra = "") => JsonDocument.Parse("{\"version\":\"krakinai.launcher.v1\",\"generation\":\"generation_1\",\"connectionId\":\"client_1\",\"requestId\":\"request_1\",\"kind\":\"" + kind + "\"" + extra + "}").RootElement.Clone();
    private static Task NativeFrameRoles()
    {
        var valid = Wire("call", ",\"tool\":\"krakinai_connection_status\",\"args\":{}");
        FrameCodec.Validate(valid, FrameDirection.AdapterRequest);
        foreach (var kind in new[] { "activate", "shutdown", "start", "stop", "approve" })
        {
            bool rejected = false; try { FrameCodec.Validate(Wire(kind), FrameDirection.AdapterRequest); } catch (LauncherFault) { rejected = true; }
            Require(rejected, "adapter control was accepted");
        }
        bool extraRejected = false;
        try { FrameCodec.Validate(Wire("hello", ",\"approved\":true"), FrameDirection.AdapterRequest); } catch (LauncherFault) { extraRejected = true; }
        Require(extraRejected, "unknown field accepted");
        return Task.CompletedTask;
    }
    private static Task NativeFrameBytes()
    {
        var value = Wire("call", ",\"tool\":\"krakinai_get_project\",\"args\":{\"projectId\":\"synthetic\",\"text\":\"日本語 🎬\\r\\nexact\"}");
        // Native transport treats the body as opaque; existing Node validation remains authoritative.
        var bytes = FrameCodec.Encode(value, FrameDirection.AdapterRequest);
        var parsed = FrameCodec.Parse(bytes.AsMemory(0, bytes.Length - 1), FrameDirection.AdapterRequest);
        Require(parsed.GetProperty("args").GetProperty("text").GetString() == "日本語 🎬\r\nexact", "payload text changed");
        foreach (var bad in new[] { new byte[] { 0x7b, 0xff, 0x7d }, new byte[FrameCodec.FrameBytes + 1] })
        {
            bool rejected = false; try { FrameCodec.Parse(bad, FrameDirection.AdapterRequest); } catch (LauncherFault) { rejected = true; }
            Require(rejected, "bad frame bytes accepted");
        }
        return Task.CompletedTask;
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop(); return port;
    }
    private static LauncherSettings ActualHostSettings(int port) => Settings() with
    {
        NodePath = Environment.GetEnvironmentVariable("KRAKINAI_TEST_NODE") ?? @"C:\nvm4w\nodejs\node.exe",
        BridgeDirectory = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "bridge", "qa-results", "desktop-launcher-dist")),
        AppOrigin = "http://localhost:5183", RelayPort = port,
    };
    private static async Task OwnedHostLifecycle()
    {
        int port = FreePort(); var generation = Guid.NewGuid().ToString("N");
        await using var owned = new ManagedNodeHost();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await owned.ActivateAsync(ActualHostSettings(port), generation, deadline.Token);
        var frame = FrameCodec.Make("call", generation, "synthetic_client", Guid.NewGuid().ToString("N"),
            ("tool", "krakinai_connection_status"), ("args", new Dictionary<string, string>()));
        var result = await owned.CallAsync(frame, deadline.Token);
        Require(!result.GetProperty("result").GetProperty("data").GetProperty("connected").GetBoolean(), "unpaired host reported connected");
        await owned.StopAsync(deadline.Token);
        Require(owned.PeakWorkingSetBytes > 0, "owned process memory was not measured");
        var after = new TcpListener(IPAddress.Loopback, port); after.Start(); after.Stop();
        Console.WriteLine("OWNED_NODE_PEAK_WORKING_SET_BYTES=" + owned.PeakWorkingSetBytes);
    }
    private static async Task OwnedHostPortConflict()
    {
        var foreign = new TcpListener(IPAddress.Loopback, 0); foreign.Start();
        int port = ((IPEndPoint)foreign.LocalEndpoint).Port;
        try
        {
            await using var owned = new ManagedNodeHost(); bool rejected = false;
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            try { await owned.ActivateAsync(ActualHostSettings(port), Guid.NewGuid().ToString("N"), deadline.Token); }
            catch (LauncherFault fault) { rejected = fault.Code == "PORT_IN_USE"; }
            Require(rejected, "port conflict was not classified");
            Require(foreign.Server.IsBound, "unrelated listener was stopped");
            using var client = new TcpClient(); await client.ConnectAsync(IPAddress.Loopback, port, deadline.Token);
        }
        finally { foreign.Stop(); }
    }
    private static async Task OwnedHostJobCleanup()
    {
        int port = FreePort(); var owned = new ManagedNodeHost();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await owned.ActivateAsync(ActualHostSettings(port), Guid.NewGuid().ToString("N"), deadline.Token);
        await owned.DisposeAsync();
        var after = new TcpListener(IPAddress.Loopback, port); after.Start(); after.Stop();
    }

    private static async Task<NamedPipeClientStream> ConnectPipe(string name, CancellationToken token) => await NativeChannel.ConnectAsync(name, token);
    private static async Task<JsonElement> ReadKind(FrameReader reader, string kind, CancellationToken token)
    {
        while (await reader.ReadAsync(token) is { } frame) if (FrameCodec.Text(frame, "kind") == kind) return frame;
        throw new InvalidOperationException("pipe closed before expected metadata");
    }
    private static async Task PrivatePipeConnection()
    {
        var settings = Settings() with { InstallationId = Guid.NewGuid().ToString("N") }; var factory = new FakeHostFactory();
        await using var controller = new BridgeController(settings, new FakeReadiness(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller);
        server.ConnectionRejected += code => Console.WriteLine("SYNTHETIC_PIPE_REJECTED=" + code);
        await server.StartAsync(); using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var pipe = await ConnectPipe(settings.PipeName, deadline.Token);
        using var reader = new FrameReader(pipe, FrameDirection.AdapterResponse); using var writer = new FrameWriter(pipe, FrameDirection.AdapterRequest);
        await writer.WriteAsync(FrameCodec.Make("hello", "none", "client_one", "hello_1"), deadline.Token);
        Require(!(await ReadKind(reader, "status", deadline.Token)).GetProperty("state").GetProperty("mcp").GetBoolean(), "hello implied MCP initialization");
        await writer.WriteAsync(FrameCodec.Make("initialized", "none", "client_one", "init_1"), deadline.Token);
        await ReadKind(reader, "status", deadline.Token);
        Require(controller.Status.Mcp && controller.Status.Bridge == "stopped" && factory.Hosts.Count == 0, "MCP initialization started host");
        await controller.StartAsync();
        Require(controller.Status.Mcp && controller.Status.Browser == "not-paired", "Start implied pairing");
    }
    private static async Task PrivatePipeSecondClient()
    {
        var settings = Settings() with { InstallationId = Guid.NewGuid().ToString("N") };
        await using var controller = new BridgeController(settings, new FakeReadiness(), new FakeHostFactory());
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        var conflict = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        server.ConnectionRejected += code => conflict.TrySetResult(code);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var one = await ConnectPipe(settings.PipeName, deadline.Token);
        using var firstReader = new FrameReader(one, FrameDirection.AdapterResponse); using var firstWriter = new FrameWriter(one, FrameDirection.AdapterRequest);
        await firstWriter.WriteAsync(FrameCodec.Make("hello", "none", "one", "hello1"), deadline.Token); await ReadKind(firstReader, "status", deadline.Token);
        await using var two = await ConnectPipe(settings.PipeName, deadline.Token);
        using var secondReader = new FrameReader(two, FrameDirection.AdapterResponse); using var secondWriter = new FrameWriter(two, FrameDirection.AdapterRequest);
        await secondWriter.WriteAsync(FrameCodec.Make("hello", "none", "two", "hello2"), deadline.Token);
        var rejected = await ReadKind(secondReader, "error", deadline.Token);
        Require(FrameCodec.Text(rejected, "code") == "CLIENT_ALREADY_CONNECTED", "second controller was accepted");
        Require(await conflict.Task.WaitAsync(deadline.Token) == "CLIENT_ALREADY_CONNECTED", "second-client conflict was not surfaced to the operator");
        await firstWriter.WriteAsync(FrameCodec.Make("initialized", "none", "one", "init1"), deadline.Token); await ReadKind(firstReader, "status", deadline.Token);
        Require(controller.Status.Mcp, "second controller displaced first");
    }
    private static async Task PrivatePipeControl()
    {
        var settings = Settings() with { InstallationId = Guid.NewGuid().ToString("N") }; var factory = new FakeHostFactory();
        await using var controller = new BridgeController(settings, new FakeReadiness(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var pipe = await ConnectPipe(settings.PipeName, deadline.Token);
        using var reader = new FrameReader(pipe, FrameDirection.AdapterResponse); using var writer = new FrameWriter(pipe, FrameDirection.AdapterRequest);
        await writer.WriteAsync(FrameCodec.Make("hello", "none", "one", "hello1"), deadline.Token); await ReadKind(reader, "status", deadline.Token);
        var invalid = FrameCodec.Make("activate", "none", "one", "bad_control").GetRawText() + "\n";
        await pipe.WriteAsync(FrameCodec.Utf8.GetBytes(invalid), deadline.Token); await pipe.FlushAsync(deadline.Token);
        Require(await reader.ReadAsync(deadline.Token) is null && factory.Hosts.Count == 0, "adapter could start a process");
    }

    private sealed class TestClock : TimeProvider
    {
        public long Tick;
        public override long TimestampFrequency => 1000;
        public override long GetTimestamp() => Tick;
    }
    private static async Task PrivatePipeHeartbeat()
    {
        var settings = Settings() with { InstallationId = Guid.NewGuid().ToString("N") }; var clock = new TestClock(); var factory = new FakeHostFactory();
        await using var controller = new BridgeController(settings, new FakeReadiness(), factory);
        await using var server = new LauncherPipeServer(settings.PipeName, controller, clock); await server.StartAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var pipe = await ConnectPipe(settings.PipeName, deadline.Token);
        using var reader = new FrameReader(pipe, FrameDirection.AdapterResponse); using var writer = new FrameWriter(pipe, FrameDirection.AdapterRequest);
        await writer.WriteAsync(FrameCodec.Make("hello", "none", "one", "hello1"), deadline.Token); await ReadKind(reader, "status", deadline.Token);
        await writer.WriteAsync(FrameCodec.Make("initialized", "none", "one", "init1"), deadline.Token); await ReadKind(reader, "status", deadline.Token);
        await controller.StartAsync(); factory.Hosts[0].Browser("paired"); clock.Tick = 14999;
        await server.CheckHeartbeatAsync(); Require(controller.Status.Bridge == "running", "client expired too early");
        clock.Tick = 15000; await server.CheckHeartbeatAsync();
        Require(!controller.Status.Mcp && controller.Status.Bridge == "stopped" && controller.Status.Browser == "not-paired" && factory.Hosts[0].Stops == 1, "stale client preserved consent or host");
    }

    private static Task Presentation()
    {
        var stopped = LauncherPresentation.From(new("stopped", "not-paired", false, "http://localhost:5173", "http://127.0.0.1:4180", "none"));
        Require(stopped.CanStart && !stopped.CanStop && !stopped.CanRestart && stopped.CanEditSettings, "stopped controls wrong");
        var running = LauncherPresentation.From(new("running", "not-paired", true, "http://localhost:5173", "http://127.0.0.1:4180", "g1"));
        Require(!running.CanStart && running.CanStop && running.CanRestart && !running.CanEditSettings, "running controls wrong");
        Require(running.Browser == "Not paired" && running.Mcp == "Connected", "indicators conflated");
        foreach (var code in new[] { "PORT_IN_USE", "HELPER_PUBLISHER_UNTRUSTED", "NATIVE_SIGNATURE_INVALID", "NODE_VERSION_UNSUPPORTED", "CLIENT_ALREADY_CONNECTED" })
            Require(LauncherPresentation.Explain(code).Length > code.Length && !LauncherPresentation.Explain(code).Contains("ExecutionPolicy Bypass"), "missing actionable safe message");
        Require(!LauncherPresentation.ShouldQuit(false) && LauncherPresentation.ShouldQuit(true), "window close should hide, explicit Quit should stop");
        return Task.CompletedTask;
    }

    private static Task SharedSettingsRejected()
    {
        var directory = Path.Combine(Environment.GetEnvironmentVariable("KRAKINAI_TEST_ROOT") ?? AppContext.BaseDirectory, "shared-settings-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(directory, "settings.json"); Settings().Save(path);
        var info = new DirectoryInfo(directory); var original = info.GetAccessControl();
        try
        {
            var shared = info.GetAccessControl(); shared.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.WorldSid, null), FileSystemRights.Write, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow)); info.SetAccessControl(shared);
            foreach (var action in new Action[] { () => LauncherSettings.Load(path), () => Settings().Save(path) })
            {
                bool rejected = false; try { action(); } catch (LauncherFault fault) { rejected = fault.Code == "CONFIGURATION_ACCESS_UNSAFE"; }
                Require(rejected, "permissive existing configuration was accepted");
            }
        }
        finally
        {
            var restored = new DirectorySecurity(); restored.SetSecurityDescriptorSddlForm(original.GetSecurityDescriptorSddlForm(AccessControlSections.Access), AccessControlSections.Access);
            info.SetAccessControl(restored); // Mark the DACL modified before Persist; retain all synthetic files.
        }
        Require(LauncherSettings.Load(path) == Settings(), "restoring private settings access failed"); return Task.CompletedTask;
    }
    private static async Task RestrictedPolicyRejected()
    {
        var platform = new FakePlatform { Policy = "Restricted" };
        var result = await new ReadinessProbe(platform).CheckAsync(Settings(), CancellationToken.None);
        Require(!result.Ready && result.Code == "POLICY_BLOCKED", "Restricted policy was reported ready");
    }

    private sealed class FakeReadiness : IReadinessProbe
    {
        public bool Delay; public string? Rejection;
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task<ReadinessResult> CheckAsync(LauncherSettings settings, CancellationToken token)
        {
            Entered.TrySetResult(); if (Delay) await Task.Delay(Timeout.InfiniteTimeSpan, token);
            return Rejection is null ? new(true, "READY", "AllSigned") : ReadinessResult.Failure(Rejection);
        }
    }
    private sealed class FakeHostFactory : IManagedHostFactory
    {
        public List<FakeHost> Hosts { get; } = [];
        public IManagedHost Create() { var host = new FakeHost(); Hosts.Add(host); return host; }
    }
    private sealed class FakeHost : IManagedHost
    {
        public event Action<string>? BrowserChanged;
        public event Action<string>? Failed { add { } remove { } }
        public int Stops;
        public void Browser(string state) => BrowserChanged?.Invoke(state);
        public Task ActivateAsync(LauncherSettings settings, string generation, CancellationToken token) => Task.CompletedTask;
        public Task<JsonElement> CallAsync(JsonElement frame, CancellationToken token) => throw new NotSupportedException();
        public Task StopAsync(CancellationToken token) { Stops++; return Task.CompletedTask; }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    private sealed class FakePlatform : IPlatformProbe
    {
        public bool Trusted = true, FilesExist = true;
        public string SignatureStatus = "Valid", Thumbprint = new('A', 40), NodeVersion = "v22.23.3", Policy = "AllSigned";
        public int SignatureChecks;
        public bool FileExists(string path) => FilesExist;
        public Task<string> GetNodeVersionAsync(string path, CancellationToken token) => Task.FromResult(NodeVersion);
        public Task<SignatureInfo> GetSignatureAsync(string path, CancellationToken token)
        { SignatureChecks++; return Task.FromResult(new SignatureInfo(SignatureStatus, Trusted, Thumbprint, Policy)); }
    }
}
