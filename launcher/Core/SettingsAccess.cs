using System.Security.AccessControl;
using System.Security.Principal;

namespace Krakinai.BridgeLauncher.Core;

public static class SettingsAccess
{
    private const FileSystemRights Control = FileSystemRights.Delete | FileSystemRights.DeleteSubdirectoriesAndFiles | FileSystemRights.ChangePermissions | FileSystemRights.TakeOwnership;
    private const FileSystemRights Write = Control | FileSystemRights.WriteData | FileSystemRights.AppendData | FileSystemRights.WriteExtendedAttributes | FileSystemRights.WriteAttributes;
    public static void Validate(string path, bool existingFile)
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent(); var user = identity.User ?? throw new LauncherFault("CONFIGURATION_ACCESS_UNSAFE");
            var file = new FileInfo(path); var directory = file.Directory ?? throw new LauncherFault("CONFIGURATION_ACCESS_UNSAFE");
            if (existingFile) Check(file, file.GetAccessControl(), user, Write);
            bool immediate = true;
            for (var parent = directory; parent is not null; parent = parent.Parent)
            {
                Check(parent, parent.GetAccessControl(), user, immediate ? Write : Control); immediate = false;
            }
        }
        catch (LauncherFault) { throw; }
        catch { throw new LauncherFault("CONFIGURATION_ACCESS_UNSAFE"); }
    }
    private static bool Trusted(SecurityIdentifier sid, SecurityIdentifier user) => sid == user ||
        sid.IsWellKnown(WellKnownSidType.LocalSystemSid) || sid.IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid) ||
        sid.Value == "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"; // Windows TrustedInstaller.
    private static void Check(FileSystemInfo item, FileSystemSecurity acl, SecurityIdentifier user, FileSystemRights denied)
    {
        if ((item.Attributes & FileAttributes.ReparsePoint) != 0 || acl.GetOwner(typeof(SecurityIdentifier)) is not SecurityIdentifier owner || !Trusted(owner, user)) throw new LauncherFault("CONFIGURATION_ACCESS_UNSAFE");
        foreach (FileSystemAccessRule rule in acl.GetAccessRules(true, true, typeof(SecurityIdentifier)))
        {
            if (rule.AccessControlType != AccessControlType.Allow || (rule.PropagationFlags & PropagationFlags.InheritOnly) != 0) continue;
            if (!Trusted((SecurityIdentifier)rule.IdentityReference, user) && (rule.FileSystemRights & (denied | (FileSystemRights)0x50000000)) != 0) throw new LauncherFault("CONFIGURATION_ACCESS_UNSAFE");
        }
    }
}
