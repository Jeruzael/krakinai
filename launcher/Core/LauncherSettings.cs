using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Krakinai.BridgeLauncher.Core;

public sealed record LauncherSettings
{
    public int FormatVersion { get; init; } = 1;
    public string InstallationId { get; init; } = Guid.NewGuid().ToString("N");
    public string NodePath { get; init; } = "";
    public string BridgeDirectory { get; init; } = "";
    public string NativeExecutable { get; init; } = "";
    public string ApprovedSignerThumbprint { get; init; } = "";
    public string AppOrigin { get; init; } = "http://localhost:5173";
    public int RelayPort { get; init; } = 4180;
    [JsonIgnore] public string PipeName => "KRAKINAI.BridgeLauncher.v1." + InstallationId;
    [JsonIgnore] public string RelayAddress => "http://127.0.0.1:" + RelayPort;
    [JsonIgnore] public string ManagedEntry => Path.Combine(BridgeDirectory, "krakinai-managed-host.mjs");
    [JsonIgnore] public string AdapterEntry => Path.Combine(BridgeDirectory, "krakinai-stdio-adapter.mjs");
    [JsonIgnore] public string VerificationHelper => Path.Combine(BridgeDirectory, "native", "verify.ps1");

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };
    public string? Validate()
    {
        if (FormatVersion != 1 || !Regex.IsMatch(InstallationId, "^[a-f0-9]{32}$")) return "CONFIGURATION_INVALID";
        if (!Uri.TryCreate(AppOrigin, UriKind.Absolute, out var origin) || origin.Scheme != "http" ||
            origin.Host is not ("localhost" or "127.0.0.1") || origin.UserInfo.Length != 0 ||
            AppOrigin != origin.GetLeftPart(UriPartial.Authority)) return "ORIGIN_INVALID";
        if (RelayPort is < 1 or > 65535 or 80) return "PORT_INVALID";
        if (!LocalPath(NodePath) || !LocalPath(BridgeDirectory) || !LocalPath(NativeExecutable) ||
            !NodePath.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
            !NativeExecutable.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return "PATH_INVALID";
        if (!Regex.IsMatch(ApprovedSignerThumbprint, "^[a-fA-F0-9]{40}$")) return "SIGNER_NOT_CONFIGURED";
        return null;
    }
    private static bool LocalPath(string path) => path.Length is > 2 and < 1500 &&
        Path.IsPathFullyQualified(path) && !path.StartsWith(@"\\", StringComparison.Ordinal) &&
        !path.Any(char.IsControl);

    public static LauncherSettings Load(string path)
    {
        SettingsAccess.Validate(path, true);
        var info = new FileInfo(path);
        if (info.Length > 16384) throw new InvalidDataException("CONFIGURATION_INVALID");
        return JsonSerializer.Deserialize<LauncherSettings>(File.ReadAllText(path), Json) ?? throw new InvalidDataException("CONFIGURATION_INVALID");
    }
    public void Save(string path)
    {
        if (Validate() is { } error) throw new InvalidDataException(error);
        var target = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(target) ?? throw new InvalidDataException("PATH_INVALID");
        if (!Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            using var identity = WindowsIdentity.GetCurrent();
            var user = identity.User ?? throw new InvalidOperationException("IDENTITY_UNAVAILABLE");
            var acl = new DirectorySecurity();
            acl.SetAccessRuleProtection(true, false); acl.SetOwner(user);
            acl.AddAccessRule(new FileSystemAccessRule(user, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            new DirectoryInfo(directory).SetAccessControl(acl);
        }
        SettingsAccess.Validate(target, File.Exists(target));
        var temporary = Path.Combine(directory, ".settings-" + Guid.NewGuid().ToString("N") + ".tmp");
        using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            JsonSerializer.Serialize(stream, this, Json); stream.Flush(true);
        }
        File.Move(temporary, target, true);
    }
}
