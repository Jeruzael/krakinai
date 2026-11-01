using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

public static class WindowsEnvironment
{
    public static void Apply(ProcessStartInfo start, bool verification = false)
    {
        start.Environment.Clear();
        var names = verification ? new[] { "SystemRoot", "WINDIR", "TEMP", "TMP" } :
            new[] { "SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH", "USERNAME" };
        foreach (var name in names)
            if (Environment.GetEnvironmentVariable(name) is { } value) start.Environment[name] = value;
    }
}
public sealed class WindowsPlatformProbe : IPlatformProbe
{
    public bool FileExists(string path) => File.Exists(path);
    public async Task<string> GetNodeVersionAsync(string path, CancellationToken token) =>
        await RunAsync(path, ["--version"], false, token);

    public async Task<SignatureInfo> GetSignatureAsync(string path, CancellationToken token)
    {
        // Public metadata only, under the same restricted environment as windowsVerifier().
        var literal = path.Replace("'", "''", StringComparison.Ordinal);
        var command = "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath '" + literal +
            "'; $t=$s.SignerCertificate.Thumbprint; $trusted=($t -and ((Test-Path ('Cert:/CurrentUser/TrustedPublisher/'+$t)) -or (Test-Path ('Cert:/LocalMachine/TrustedPublisher/'+$t)))); " +
            "[pscustomobject]@{Status=[string]$s.Status;PublisherTrusted=[bool]$trusted;Thumbprint=[string]$t;Policy=[string](Get-ExecutionPolicy)} | ConvertTo-Json -Compress";
        var executable = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        var text = await RunAsync(executable, ["-NoProfile", "-NonInteractive", "-Command", command], true, token);
        using var json = JsonDocument.Parse(text);
        var root = json.RootElement;
        return new(root.GetProperty("Status").GetString() ?? "Unknown", root.GetProperty("PublisherTrusted").GetBoolean(),
            root.GetProperty("Thumbprint").GetString() ?? "", root.GetProperty("Policy").GetString() ?? "");
    }
    private static async Task<string> RunAsync(string executable, string[] arguments, bool verification, CancellationToken token)
    {
        var start = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8 };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        WindowsEnvironment.Apply(start, verification);
        using var process = Process.Start(start) ?? throw new IOException("PROBE_FAILED");
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token); deadline.CancelAfter(TimeSpan.FromSeconds(10));
        try
        {
            var output = ReadBoundedAsync(process.StandardOutput, deadline.Token);
            var errors = ReadBoundedAsync(process.StandardError, deadline.Token);
            await process.WaitForExitAsync(deadline.Token);
            var text = await output; await errors;
            if (process.ExitCode != 0) throw new IOException("PROBE_FAILED");
            return text;
        }
        catch
        {
            try { if (!process.HasExited) process.Kill(true); } catch (InvalidOperationException) { }
            throw;
        }
    }
    private static async Task<string> ReadBoundedAsync(StreamReader reader, CancellationToken token)
    {
        var result = new StringBuilder(); var buffer = new char[512];
        while (true)
        {
            int count = await reader.ReadAsync(buffer.AsMemory(), token);
            if (count == 0) return result.ToString();
            if (result.Length + count > 4096) throw new IOException("PROBE_OUTPUT_LIMIT");
            result.Append(buffer, 0, count);
        }
    }
}
