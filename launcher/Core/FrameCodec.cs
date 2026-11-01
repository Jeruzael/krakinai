using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Krakinai.BridgeLauncher.Core;

public enum FrameDirection { AdapterRequest, AdapterResponse, HostRequest, HostResponse }
public static class FrameCodec
{
    public const string Version = "krakinai.launcher.v1";
    public const int FrameBytes = 1310720, ResultBytes = 524288, QueueBytes = 8388608;
    public static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly Regex Identifier = new("^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$", RegexOptions.CultureInvariant);
    private static readonly Regex Code = new("^[A-Z][A-Z0-9_]{1,63}$", RegexOptions.CultureInvariant);
    private static readonly string[] Base = ["version", "kind", "generation", "connectionId", "requestId"];
    public static JsonElement Parse(ReadOnlyMemory<byte> bytes, FrameDirection direction)
    {
        if (bytes.Length >= FrameBytes) throw new LauncherFault("IPC_FRAME_LIMIT");
        try
        {
            var text = Utf8.GetString(bytes.Span);
            using var document = JsonDocument.Parse(text, new JsonDocumentOptions { MaxDepth = 64 });
            Validate(document.RootElement, direction); return document.RootElement.Clone();
        }
        catch (LauncherFault) { throw; }
        catch (Exception error) when (error is JsonException or DecoderFallbackException or InvalidOperationException)
        { throw new LauncherFault("IPC_PROTOCOL_ERROR"); }
    }
    public static byte[] Encode(JsonElement frame, FrameDirection direction)
    {
        Validate(frame, direction); return Utf8.GetBytes(frame.GetRawText() + "\n");
    }
    public static string Text(JsonElement value, string key)
    {
        if (!value.TryGetProperty(key, out var item) || item.ValueKind != JsonValueKind.String) throw new LauncherFault("IPC_PROTOCOL_ERROR");
        return item.GetString() ?? throw new LauncherFault("IPC_PROTOCOL_ERROR");
    }
    private static void Exact(JsonElement value, params string[] fields)
    {
        if (value.ValueKind != JsonValueKind.Object) throw new LauncherFault("IPC_PROTOCOL_ERROR");
        var names = value.EnumerateObject().Select(p => p.Name).ToArray();
        if (names.Length != names.Distinct(StringComparer.Ordinal).Count() || names.Any(n => !fields.Contains(n, StringComparer.Ordinal)) || fields.Any(n => !value.TryGetProperty(n, out _)))
            throw new LauncherFault("IPC_PROTOCOL_ERROR");
    }
    public static void Validate(JsonElement value, FrameDirection direction)
    {
        if (value.ValueKind != JsonValueKind.Object || Text(value, "version") != Version) throw new LauncherFault("IPC_VERSION_MISMATCH");
        var kind = Text(value, "kind");
        string[] allowed = direction switch
        {
            FrameDirection.AdapterRequest => ["hello", "initialized", "heartbeat", "call"],
            FrameDirection.AdapterResponse => ["status", "result", "error"],
            FrameDirection.HostRequest => ["activate", "shutdown", "call"],
            _ => ["ready", "state", "result", "error", "stopped"],
        };
        if (!allowed.Contains(kind, StringComparer.Ordinal)) throw new LauncherFault("IPC_METHOD_DENIED");
        foreach (var id in new[] { "generation", "connectionId", "requestId" }) if (!Identifier.IsMatch(Text(value, id))) throw new LauncherFault("IPC_PROTOCOL_ERROR");
        if (direction == FrameDirection.AdapterRequest && Text(value, "connectionId") == "host") throw new LauncherFault("IPC_IDENTITY_MISMATCH");
        string[] extra = kind switch { "call" => ["tool", "args"], "result" => ["result"], "ready" => ["origin", "relay"], "status" or "state" => ["state"], "error" => ["code"], _ => [] };
        Exact(value, [.. Base, .. extra]);
        if (Utf8.GetByteCount(value.GetRawText()) + 1 > FrameBytes) throw new LauncherFault("IPC_FRAME_LIMIT");
        if (kind == "call" && (Text(value, "tool").Length > 100 || value.GetProperty("args").ValueKind != JsonValueKind.Object)) throw new LauncherFault("IPC_PROTOCOL_ERROR");
        if (kind == "error" && !Code.IsMatch(Text(value, "code"))) throw new LauncherFault("IPC_PROTOCOL_ERROR");
        if (kind == "ready") { Origin(Text(value, "origin"), false); Origin(Text(value, "relay"), true); }
        if (kind == "result")
        {
            var result = value.GetProperty("result");
            if (result.ValueKind != JsonValueKind.Object || Text(result, "apiVersion") != "krakinai.mcp.v1" || !result.TryGetProperty("ok", out var ok) || ok.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) throw new LauncherFault("IPC_PROTOCOL_ERROR");
            Exact(result, ok.GetBoolean() ? ["apiVersion", "ok", "data"] : ["apiVersion", "ok", "error"]);
            if (Utf8.GetByteCount(result.GetRawText()) > ResultBytes) throw new LauncherFault("IPC_RESULT_LIMIT");
        }
        if (kind is "state" or "status")
        {
            var state = value.GetProperty("state");
            if (state.ValueKind != JsonValueKind.Object || Text(state, "browser") is not ("not-paired" or "pairing" or "paired" or "expired")) throw new LauncherFault("IPC_PROTOCOL_ERROR");
            if (kind == "state") Exact(state, "browser");
            else
            {
                var hasError = state.TryGetProperty("errorCode", out _);
                Exact(state, hasError ? ["bridge", "browser", "mcp", "origin", "relay", "errorCode"] : ["bridge", "browser", "mcp", "origin", "relay"]);
                if (Text(state, "bridge") is not ("stopped" or "starting" or "running" or "stopping" or "error") || state.GetProperty("mcp").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) throw new LauncherFault("IPC_PROTOCOL_ERROR");
                Origin(Text(state, "origin"), false); Origin(Text(state, "relay"), true);
                if (hasError && !Code.IsMatch(Text(state, "errorCode"))) throw new LauncherFault("IPC_PROTOCOL_ERROR");
            }
        }
    }
    private static void Origin(string value, bool relay)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != "http" || uri.UserInfo.Length != 0 || value != uri.GetLeftPart(UriPartial.Authority) ||
            (relay ? uri.Host != "127.0.0.1" || uri.IsDefaultPort : uri.Host is not ("localhost" or "127.0.0.1"))) throw new LauncherFault("IPC_PROTOCOL_ERROR");
    }
    public static JsonElement Make(string kind, string generation, string connectionId, string requestId, params (string Key, object? Value)[] extra)
    {
        var data = new Dictionary<string, object?> { ["version"] = Version, ["kind"] = kind, ["generation"] = generation, ["connectionId"] = connectionId, ["requestId"] = requestId };
        foreach (var pair in extra) data.Add(pair.Key, pair.Value);
        return JsonSerializer.SerializeToElement(data);
    }
}

/** A bounded byte reader; StreamReader.ReadLine would buffer unbounded input. */
public sealed class FrameReader(Stream stream, FrameDirection direction) : IDisposable
{
    private readonly byte[] frame = new byte[FrameCodec.FrameBytes];
    private readonly byte[] input = new byte[8192];
    private int start, end, used;
    public async Task<JsonElement?> ReadAsync(CancellationToken token)
    {
        while (true)
        {
            if (start == end)
            {
                start = 0; end = await stream.ReadAsync(input, token);
                if (end == 0) { if (used != 0) throw new LauncherFault("IPC_TRUNCATED"); return null; }
            }
            int newline = Array.IndexOf(input, (byte)10, start, end - start);
            int next = newline < 0 ? end : newline + 1, count = next - start;
            if (used + count > frame.Length) throw new LauncherFault("IPC_FRAME_LIMIT");
            Buffer.BlockCopy(input, start, frame, used, count); used += count; start = next;
            if (newline >= 0)
            {
                var result = FrameCodec.Parse(frame.AsMemory(0, used - 1), direction); Array.Clear(frame, 0, used); used = 0; return result;
            }
        }
    }
    public void Dispose() { Array.Clear(frame); Array.Clear(input); }
}

public sealed class FrameWriter(Stream stream, FrameDirection direction) : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private long queued;
    public async Task WriteAsync(JsonElement frame, CancellationToken token)
    {
        FrameCodec.Validate(frame, direction);
        string text = frame.GetRawText() + "\n"; int count = FrameCodec.Utf8.GetByteCount(text);
        if (Interlocked.Add(ref queued, count) > FrameCodec.QueueBytes) { Interlocked.Add(ref queued, -count); throw new LauncherFault("IPC_QUEUE_LIMIT"); }
        try
        {
            await gate.WaitAsync(token);
            try { await stream.WriteAsync(FrameCodec.Utf8.GetBytes(text), token); await stream.FlushAsync(token); }
            finally { gate.Release(); }
        }
        finally { Interlocked.Add(ref queued, -count); }
    }
    public void Dispose() => gate.Dispose();
}
