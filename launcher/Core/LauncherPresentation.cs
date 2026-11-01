using System.Text.Json;

namespace Krakinai.BridgeLauncher.Core;

public sealed record LauncherPresentation(bool CanStart, bool CanStop, bool CanRestart, bool CanEditSettings, string Bridge, string Browser, string Mcp, string Message)
{
    public static LauncherPresentation From(LauncherStatus status) => new(
        status.Bridge is "stopped" or "error", status.Bridge is "starting" or "running", status.Bridge == "running", status.Bridge is "stopped" or "error",
        status.Bridge switch { "running" => "Running", "starting" => "Starting", "stopping" => "Stopping", "error" => "Needs attention", _ => "Stopped" },
        status.Browser switch { "paired" => "Paired", "pairing" => "Awaiting your verification", "expired" => "Expired — pair again", _ => "Not paired" },
        status.Mcp ? "Connected" : "Not connected", Explain(status.ErrorCode));
    public static bool ShouldQuit(bool explicitQuit) => explicitQuit;
    public static string Explain(string? code) => code switch
    {
        null or "" => "Start the bridge, then connect in your existing KRAKINAI browser/profile. Each proposal still requires your browser review.",
        "PORT_IN_USE" => "That relay port is already occupied. Stop your other bridge in its own terminal, or choose a different explicit port in Settings. No other process was stopped.",
        "PUBLISHER_NOT_TRUSTED" or "HELPER_PUBLISHER_UNTRUSTED" => "The signature is valid but Windows does not trust its publisher for this account. Review the exact public certificate in your normal Windows account. This launcher never installs trust or changes AllSigned.",
        "SIGNATURE_INVALID" or "NATIVE_SIGNATURE_INVALID" => "The launcher or verification helper is unsigned or its signature is invalid. Use the reviewed signed release; rebuilds need signing again. Do not weaken your execution policy.",
        "SIGNER_MISMATCH" => "The file signer differs from the approved public thumbprint in Settings. Verify both files and their signer before changing it.",
        "NODE_VERSION" or "NODE_VERSION_UNSUPPORTED" => "Select an installed Node.js 22 executable in Settings. Other major versions are not supported by this release.",
        "FILE_MISSING" => "A configured runtime, bridge build, adapter or verification helper is missing. Check the exact local paths in Settings and the release folder.",
        "SIGNER_NOT_CONFIGURED" => "Set the approved public code-signing thumbprint in Settings. No private key is needed here.",
        "CLIENT_ALREADY_CONNECTED" => "Another MCP adapter already controls this launcher. Close that client before connecting this one; the existing client was preserved.",
        "CONFIGURATION_ACCESS_UNSAFE" => "The settings file or its folder can be controlled by another Windows account. Use a dedicated private configuration directory owned by your account. Existing folder permissions were not changed.",
        "POLICY_BLOCKED" => "The effective Windows PowerShell policy blocks script files, including the signed verification helper. Ask your administrator for an approved policy; this launcher will not change it.",
        "IPC_IDENTITY_MISMATCH" or "IPC_REMOTE_DENIED" => "The channel identity did not match. Run Codex and this launcher normally under the same Windows account, session and elevation; use the same installed launcher executable.",
        "CONFIGURATION_INVALID" or "ORIGIN_INVALID" or "PORT_INVALID" or "PATH_INVALID" => "Review Settings: use the exact localhost or 127.0.0.1 application origin, an explicit relay port other than 80, and local absolute paths. Origins use separate browser libraries.",
        "START_CANCELLED" => "Startup was cancelled. Press Start when you are ready; no pairing permission was granted.",
        "HOST_CHANGED" or "DISCONNECTED" => "The previous connection ended. Press Start if needed and pair again in your browser. Previous permissions cannot be resumed.",
        _ => "The local bridge could not continue. Check the reviewed release, Windows policy and configured paths, then start again. Diagnostic code: " + code,
    };
    public static string McpConfiguration(LauncherSettings settings, string configPath) =>
        "[mcp_servers.krakinai]\ncommand = " + JsonSerializer.Serialize(settings.NodePath) +
        "\nargs = [" + JsonSerializer.Serialize(settings.AdapterEntry) + ", \"--config\", " + JsonSerializer.Serialize(configPath) + "]\n";
}
