namespace Krakinai.BridgeLauncher.Core;

public sealed record SignatureInfo(string Status, bool PublisherTrusted, string Thumbprint, string Policy);
public sealed record ReadinessResult(bool Ready, string Code, string Policy = "")
{
    public static ReadinessResult Failure(string code) => new(false, code);
}
public interface IPlatformProbe
{
    bool FileExists(string path);
    Task<string> GetNodeVersionAsync(string path, CancellationToken token);
    Task<SignatureInfo> GetSignatureAsync(string path, CancellationToken token);
}
public interface IReadinessProbe
{
    Task<ReadinessResult> CheckAsync(LauncherSettings settings, CancellationToken token);
}
public sealed class ReadinessProbe(IPlatformProbe platform) : IReadinessProbe
{
    public async Task<ReadinessResult> CheckAsync(LauncherSettings settings, CancellationToken token)
    {
        if (settings.Validate() is { } error) return ReadinessResult.Failure(error);
        foreach (var path in new[] { settings.NodePath, settings.ManagedEntry, settings.AdapterEntry, settings.VerificationHelper, settings.NativeExecutable })
            if (!platform.FileExists(path)) return ReadinessResult.Failure("FILE_MISSING");
        var version = (await platform.GetNodeVersionAsync(settings.NodePath, token)).Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(version, @"^v22\.\d+\.\d+$")) return ReadinessResult.Failure("NODE_VERSION");
        string policy = "";
        foreach (var path in new[] { settings.VerificationHelper, settings.NativeExecutable })
        {
            var signature = await platform.GetSignatureAsync(path, token);
            if (signature.Status != "Valid") return ReadinessResult.Failure("SIGNATURE_INVALID");
            if (!signature.Thumbprint.Equals(settings.ApprovedSignerThumbprint, StringComparison.OrdinalIgnoreCase)) return ReadinessResult.Failure("SIGNER_MISMATCH");
            if (!signature.PublisherTrusted) return ReadinessResult.Failure("PUBLISHER_NOT_TRUSTED");
            if (signature.Policy is not ("AllSigned" or "RemoteSigned" or "Unrestricted" or "Bypass")) return ReadinessResult.Failure("POLICY_BLOCKED");
            policy = signature.Policy;
        }
        return new(true, "READY", policy);
    }
}
