using System.IO.Pipes;
using System.Security.Principal;
using System.Text.RegularExpressions;

namespace Krakinai.BridgeLauncher.Core;

/** This role only connects/forwards. It cannot create a launcher or start a host. */
public static class NativeChannel
{
    public static async Task<NamedPipeClientStream> ConnectAsync(string name, CancellationToken token)
    {
        if (!Regex.IsMatch(name, "^KRAKINAI\\.BridgeLauncher\\.v1\\.[a-f0-9]{32}$")) throw new LauncherFault("IPC_NAME_INVALID");
        var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut,
            PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly, TokenImpersonationLevel.Identification);
        try { await pipe.ConnectAsync(2000, token); PipeIdentity.ValidateServer(pipe); return pipe; }
        catch { await pipe.DisposeAsync(); throw; }
    }
    public static async Task<int> RunAsync(string name, Stream input, Stream output, CancellationToken token)
    {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(token);
        try
        {
            await using var pipe = await ConnectAsync(name, lifetime.Token);
            var outward = PumpAsync(input, pipe, FrameDirection.AdapterRequest, lifetime.Token);
            var inward = PumpAsync(pipe, output, FrameDirection.AdapterResponse, lifetime.Token);
            var completed = await Task.WhenAny(outward, inward);
            await completed;
            lifetime.Cancel(); await pipe.DisposeAsync(); input.Dispose();
            try { await Task.WhenAll(outward, inward); } catch (OperationCanceledException) { } catch (ObjectDisposedException) { } catch (IOException) { }
            return 0;
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { return 0; }
        catch { return 1; } // No raw diagnostics, payloads, paths or keys on either stream.
    }
    private static async Task PumpAsync(Stream input, Stream output, FrameDirection direction, CancellationToken token)
    {
        using var reader = new FrameReader(input, direction); using var writer = new FrameWriter(output, direction);
        while (await reader.ReadAsync(token) is { } frame) await writer.WriteAsync(frame, token);
    }
}
