using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace Krakinai.BridgeLauncher.Core;

public static class PipeIdentity
{
    public static void ValidateServer(NamedPipeClientStream pipe)
    {
        if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var pid) ||
            !GetNamedPipeServerSessionId(pipe.SafePipeHandle, out var session)) throw new LauncherFault("IPC_IDENTITY_MISMATCH");
        ValidateLocalImage(pid, session);
    }
    public static void ValidateClient(NamedPipeServerStream pipe)
    {
        if (!GetNamedPipeClientProcessId(pipe.SafePipeHandle, out var pid) ||
            !GetNamedPipeClientSessionId(pipe.SafePipeHandle, out var session)) throw new LauncherFault("IPC_IDENTITY_MISMATCH");
        ValidateLocalImage(pid, session);
        var computer = new StringBuilder(256);
        bool remoteNameAvailable = GetNamedPipeClientComputerName(pipe.SafePipeHandle, computer, (uint)computer.Capacity);
        // ERROR_PIPE_LOCAL (229) is positive evidence of a local pipe, not a failed identity check.
        // Refuse remote names and every unknown query failure; never trust a supplied hostname.
        if (remoteNameAvailable || Marshal.GetLastWin32Error() != 229) throw new LauncherFault("IPC_REMOTE_DENIED");
        using var owner = WindowsIdentity.GetCurrent(); string? peer = null;
        pipe.RunAsClient(() => { using var identity = WindowsIdentity.GetCurrent(); peer = identity.User?.Value; });
        if (owner.User is null || peer != owner.User.Value) throw new LauncherFault("IPC_IDENTITY_MISMATCH");
    }
    private static void ValidateLocalImage(uint pid, uint session)
    {
        try
        {
            using var current = Process.GetCurrentProcess();
            using var peer = Process.GetProcessById(checked((int)pid));
            if (session != current.SessionId || peer.SessionId != current.SessionId || peer.MainModule?.FileName is not { } image ||
                Environment.ProcessPath is not { } expected || !Path.GetFullPath(image).Equals(Path.GetFullPath(expected), StringComparison.OrdinalIgnoreCase))
                throw new LauncherFault("IPC_IDENTITY_MISMATCH");
        }
        catch (LauncherFault) { throw; }
        catch { throw new LauncherFault("IPC_IDENTITY_MISMATCH"); }
    }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeServerSessionId(SafePipeHandle pipe, out uint session);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeClientSessionId(SafePipeHandle pipe, out uint session);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool GetNamedPipeClientComputerName(SafePipeHandle pipe, StringBuilder name, uint length);
}
