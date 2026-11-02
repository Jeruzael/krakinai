using System.Text;
using System.Text.Json;
using Krakinai.BridgeLauncher.Core;

namespace Krakinai.BridgeLauncher.Tests;

internal static class SharedSessionTests
{
    private static void Require(bool condition, string message) => Program.Require(condition, message);
    private static void Fault(Action action, string code)
    {
        try { action(); } catch (LauncherFault error) when (error.Code == code) { return; }
        throw new InvalidOperationException("expected " + code);
    }
    internal static JsonElement Call(string route, string id) => FrameCodec.Make("call", "generation", route, id, ("tool", "krakinai_get_connection_status"), ("args", new { }));
    internal static JsonElement Result(string route, string id, string value = "value") => FrameCodec.Make("result", "generation", route, id,
        ("result", new { apiVersion = "krakinai.mcp.v1", ok = true, data = value }));

    public static Task QueueBudget()
    {
        var budget = new FrameQueueBudget();
        var first = budget.Reserve(4 * 1024 * 1024); using var second = budget.Reserve(4 * 1024 * 1024);
        Fault(() => budget.Reserve(1), "IPC_QUEUE_LIMIT");
        first.Dispose(); first.Dispose(); using var replacement = budget.Reserve(4 * 1024 * 1024);
        Fault(() => budget.Reserve(1), "IPC_QUEUE_LIMIT");
        Fault(() => budget.Reserve(0), "IPC_QUEUE_LIMIT");
        return Task.CompletedTask;
    }
    public static async Task SharedWriters()
    {
        var budget = new FrameQueueBudget(4096);
        using var stream = new BlockedStream(); using var peer = new MemoryStream();
        using var writer = new FrameWriter(stream, FrameDirection.AdapterResponse, budget);
        using var other = new FrameWriter(peer, FrameDirection.AdapterResponse, budget);
        using var cancel = new CancellationTokenSource();
        var frame = Result("route", "request", new string('x', 2300));
        var blocked = writer.WriteAsync(frame, cancel.Token); await stream.Entered.Task.WaitAsync(TimeSpan.FromSeconds(2));
        try { await other.WriteAsync(frame, CancellationToken.None); throw new InvalidOperationException("independent writer exceeded aggregate budget"); }
        catch (LauncherFault error) when (error.Code == "IPC_QUEUE_LIMIT") { }
        cancel.Cancel(); try { await blocked; } catch (OperationCanceledException) { }
        await other.WriteAsync(frame, CancellationToken.None);
        using var failed = new FrameWriter(new FailingStream(), FrameDirection.AdapterResponse, budget);
        try { await failed.WriteAsync(frame, CancellationToken.None); } catch (IOException) { }
        await other.WriteAsync(frame, CancellationToken.None);
    }
    public static async Task GuardedWriter()
    {
        using var stream = new MemoryStream(); using var writer = new FrameWriter(stream, FrameDirection.AdapterResponse);
        var frame = Result("route", "unicode", "exact\r\n日本語 🎥");
        Require(!await writer.WriteIfAsync(frame, CancellationToken.None, () => false) && stream.Length == 0, "cancelled queued frame was sent");
        Require(await writer.WriteIfAsync(frame, CancellationToken.None, () => true), "live frame omitted");
        Require(Encoding.UTF8.GetString(stream.ToArray()) == frame.GetRawText() + "\n", "writer changed payload bytes");
    }
    public static async Task LedgerLifetime()
    {
        var ledger = new HostRequestLedger();
        var pending = Enumerable.Range(0, 16).Select(i => ledger.Reserve(Call("route", "r" + i))).ToArray();
        Fault(() => ledger.Reserve(Call("route", "overflow")), "QUEUE_FULL");
        using var cancel = new CancellationTokenSource(); cancel.Cancel();
        ledger.CancelCaller(pending[0], cancel.Token);
        Require(!ledger.TryBeginWrite(pending[0]), "abandoned unsent call could begin writing");
        var extra = ledger.Reserve(Call("route", "extra"));
        Require(ledger.TryBeginWrite(extra) && extra.WritingBegan, "live call did not begin");
        ledger.CancelCaller(extra, cancel.Token);
        Fault(() => ledger.Reserve(Call("route", "still-full")), "QUEUE_FULL");
        ledger.Complete(Result("route", "extra"));
        Require(extra.Completion.IsCanceled, "abandoned call received success");
        var after = ledger.Reserve(Call("route", "after"));
        ledger.Close(new LauncherFault("DISCONNECTED"));
        foreach (var item in pending.Append(extra).Append(after)) try { await item.Completion; } catch (Exception) { }
    }
    public static async Task LedgerRoutes()
    {
        var ledger = new HostRequestLedger();
        var first = ledger.Reserve(Call("route-one", "same")); var second = ledger.Reserve(Call("route-two", "same"));
        ledger.TryBeginWrite(first); ledger.TryBeginWrite(second);
        ledger.Complete(Result("route-two", "same", "second"));
        Require(!first.Completion.IsCompleted, "response crossed routes");
        Require((await second.Completion).GetProperty("result").GetProperty("data").GetString() == "second", "wrong response delivered");
        Fault(() => ledger.Complete(Result("unknown", "same")), "IPC_UNEXPECTED_RESULT");
        Fault(() => ledger.Complete(Result("route-two", "same")), "IPC_UNEXPECTED_RESULT");
        var reconnect = ledger.Reserve(Call("route-three", "same")); ledger.TryBeginWrite(reconnect);
        Fault(() => ledger.Complete(Result("route-two", "same")), "IPC_UNEXPECTED_RESULT");
        Require(!reconnect.Completion.IsCompleted, "retired response satisfied reconnect");
        ledger.Complete(Result("route-one", "same", "first")); ledger.Complete(Result("route-three", "same", "new"));
        await first.Completion; await reconnect.Completion;
    }
    public static async Task LedgerDeadline()
    {
        var clock = new Clock(); var ledger = new HostRequestLedger(clock);
        var unsent = ledger.Reserve(Call("route", "queued")); clock.Tick = 25000;
        Require(!ledger.HasExpired(), "unsent call triggered forwarded deadline");
        var sent = ledger.Reserve(Call("route", "sent")); ledger.TryBeginWrite(sent);
        using var cancel = new CancellationTokenSource(); cancel.Cancel(); ledger.CancelCaller(sent, cancel.Token);
        clock.Tick += 19999; Require(!ledger.HasExpired(), "deadline fired early");
        clock.Tick++; Require(ledger.HasExpired(), "cancelled forwarded work lost health deadline");
        ledger.Complete(Result("route", "sent")); Require(!ledger.HasExpired(), "terminal reply retained expired credit");
        ledger.Close(new LauncherFault("DISCONNECTED"));
        foreach (var item in new[] { unsent, sent }) try { await item.Completion; } catch (Exception) { }
    }
    internal sealed class Clock : TimeProvider
    {
        public long Tick;
        public override long TimestampFrequency => 1000;
        public override long GetTimestamp() => Tick;
    }
    private static async Task<(LauncherSettings Settings, string Directory)> HostFixture(string mode)
    {
        string directory = Path.Combine(Environment.GetEnvironmentVariable("KRAKINAI_TEST_ROOT") ?? AppContext.BaseDirectory, "shared-host-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        await File.WriteAllTextAsync(Path.Combine(directory, "krakinai-managed-host.mjs"), """
            import readline from 'node:readline';
            import fs from 'node:fs';
            const args=process.argv, generation=args[args.indexOf('--generation')+1];
            const origin=args[args.indexOf('--app-origin')+1], relay='http://127.0.0.1:'+args[args.indexOf('--port')+1];
            const mode=MODE, directory=DIRECTORY, held=[];
            const send=f=>process.stdout.write(JSON.stringify(f)+'\n');
            const result=f=>send({version:f.version,generation,connectionId:f.connectionId,requestId:f.requestId,kind:'result',result:{apiVersion:'krakinai.mcp.v1',ok:true,data:f.requestId}});
            const timer=setInterval(()=>{
              if(fs.existsSync(directory+'/resume'))process.stdin.resume();
              if(fs.existsSync(directory+'/release')){for(const f of held.splice(0).reverse())result(f);}
            },20);
            readline.createInterface({input:process.stdin}).on('line',line=>{
              let f;try{f=JSON.parse(line);}catch{process.stdout.write('INVALID\n');return;}
              if(f.kind==='activate'){
                if(mode==='pause')process.stdin.pause();
                send({...f,kind:'ready',origin,relay});
              }else if(f.kind==='shutdown'){send({...f,kind:'stopped'});clearInterval(timer);process.exit(0);}
              else if(f.kind==='call'){
                fs.appendFileSync(directory+'/received',f.requestId+'\n');
                if(mode==='hold')held.push(f);
                else if(mode==='corrupt')process.stdout.write('INVALID\n');
                else result(f);
              }
            });
            """.Replace("MODE", JsonSerializer.Serialize(mode)).Replace("DIRECTORY", JsonSerializer.Serialize(directory)));
        return (new LauncherSettings { NodePath = Environment.GetEnvironmentVariable("KRAKINAI_TEST_NODE") ?? @"C:\nvm4w\nodejs\node.exe", BridgeDirectory = directory, AppOrigin = "http://localhost:5183", RelayPort = 54186 }, directory);
    }
    private static async Task WaitFor(Func<bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!condition()) await Task.Delay(20, timeout.Token);
    }
    private static string[] ReadFixtureLines(string path)
    {
        if (!File.Exists(path)) return [];
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream); return reader.ReadToEnd().Split('\n', StringSplitOptions.RemoveEmptyEntries);
    }
    public static async Task HostCancellation()
    {
        var fixture = await HostFixture("pause"); await using var host = new ManagedNodeHost();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await host.ActivateAsync(fixture.Settings, "generation", deadline.Token);
        using var caller = new CancellationTokenSource();
        var large = FrameCodec.Make("call", "generation", "one", "large", ("tool", "synthetic"), ("args", new { payload = new string('x', 900000) }));
        var first = host.CallAsync(large, caller.Token); await Task.Delay(100, deadline.Token); caller.Cancel();
        try { await first; throw new InvalidOperationException("cancelled caller received success"); } catch (OperationCanceledException) { }
        using var queuedCaller = new CancellationTokenSource();
        var queued = host.CallAsync(Call("queued", "must-not-send"), queuedCaller.Token); queuedCaller.Cancel();
        try { await queued; throw new InvalidOperationException("abandoned queued caller received success"); } catch (OperationCanceledException) { }
        var healthy = host.CallAsync(Call("two", "healthy"), deadline.Token);
        await File.WriteAllTextAsync(Path.Combine(fixture.Directory, "resume"), "synthetic");
        var second = await healthy;
        Require(second.GetProperty("result").GetProperty("data").GetString() == "healthy", "caller cancellation damaged shared host stream");
        var received = File.ReadAllLines(Path.Combine(fixture.Directory, "received"));
        Require(received.SequenceEqual(new[] { "large", "healthy" }), "shared host received a partial or redirected frame");
        await host.StopAsync(deadline.Token);
    }
    public static async Task HostRetainedAdmission()
    {
        var fixture = await HostFixture("hold"); await using var host = new ManagedNodeHost();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await host.ActivateAsync(fixture.Settings, "generation", deadline.Token);
        using var callers = new CancellationTokenSource();
        var calls = Enumerable.Range(0, 16).Select(i => host.CallAsync(Call("route" + i, "same"), callers.Token)).ToArray();
        await WaitFor(() => ReadFixtureLines(Path.Combine(fixture.Directory, "received")).Length == 16);
        callers.Cancel(); foreach (var call in calls) try { await call; } catch (OperationCanceledException) { }
        try { await host.CallAsync(Call("extra", "seventeenth"), deadline.Token); throw new InvalidOperationException("departed callers released dispatched reservations"); }
        catch (LauncherFault error) when (error.Code == "QUEUE_FULL") { }
        await File.WriteAllTextAsync(Path.Combine(fixture.Directory, "release"), "synthetic");
        await Task.Delay(150, deadline.Token);
        var result = await host.CallAsync(Call("extra", "after-release"), deadline.Token);
        Require(FrameCodec.Text(result, "requestId") == "after-release", "terminal replies did not release admission");
        await host.StopAsync(deadline.Token);
    }
    public static async Task HostHealthDeadline()
    {
        var fixture = await HostFixture("hold"); var clock = new Clock(); await using var host = new ManagedNodeHost(clock);
        var failure = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously); host.Failed += code => failure.TrySetResult(code);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await host.ActivateAsync(fixture.Settings, "generation", deadline.Token);
        using var caller = new CancellationTokenSource(); var call = host.CallAsync(Call("route", "orphan"), caller.Token);
        await WaitFor(() => File.Exists(Path.Combine(fixture.Directory, "received")));
        caller.Cancel(); try { await call; } catch (OperationCanceledException) { }
        clock.Tick = 20000;
        Require(await failure.Task.WaitAsync(deadline.Token) == "HOST_REQUEST_TIMEOUT", "expired forwarded work did not fail host");
    }
    public static async Task HostMalformedResponse()
    {
        var fixture = await HostFixture("corrupt"); await using var host = new ManagedNodeHost();
        var failure = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously); host.Failed += code => failure.TrySetResult(code);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await host.ActivateAsync(fixture.Settings, "generation", deadline.Token);
        try { await host.CallAsync(Call("route", "bad"), deadline.Token); throw new InvalidOperationException("corrupted shared stream accepted"); }
        catch (LauncherFault error) when (error.Code == "IPC_PROTOCOL_ERROR") { }
        Require(await failure.Task.WaitAsync(deadline.Token) == "IPC_PROTOCOL_ERROR", "protocol failure not escalated");
    }
    private sealed class BlockedStream : MemoryStream
    {
        public readonly TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
        { Entered.TrySetResult(); await Task.Delay(Timeout.Infinite, cancellationToken); }
    }
    private sealed class FailingStream : MemoryStream
    {
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) => ValueTask.FromException(new IOException("synthetic"));
    }
}
