using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

namespace Krakinai.BridgeLauncher.UI;

/** Owner-only desktop coordination. This event can focus a window, never control a bridge. */
internal sealed class SingleInstance : IDisposable
{
    private readonly SafeWaitHandle mutex;
    private readonly EventWaitHandle focus = new(false, EventResetMode.AutoReset);
    private RegisteredWaitHandle? registration;
    public bool Primary { get; }
    public SingleInstance(string id)
    {
        using var identity = WindowsIdentity.GetCurrent();
        var sid = identity.User?.Value ?? throw new InvalidOperationException("IDENTITY_UNAVAILABLE");
        if (!ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;;GA;;;" + sid + ")", 1, out var descriptor, out _)) throw new Win32Exception();
        try
        {
            var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = descriptor };
            mutex = CreateMutex(ref attributes, false, @"Local\KRAKINAI.BridgeLauncher.Window." + id);
            int error = Marshal.GetLastWin32Error();
            if (mutex.IsInvalid) throw new Win32Exception(error);
            Primary = error != 183;
            var handle = CreateEvent(ref attributes, false, false, @"Local\KRAKINAI.BridgeLauncher.Focus." + id);
            if (handle.IsInvalid) { mutex.Dispose(); throw new Win32Exception(); }
            focus.SafeWaitHandle = handle;
            if (!Primary) focus.Set();
        }
        finally { LocalFree(descriptor); }
    }
    public void OnFocus(Action callback) => registration = ThreadPool.RegisterWaitForSingleObject(focus, (_, _) => callback(), null, Timeout.Infinite, false);
    public void Dispose() { registration?.Unregister(null); focus.Dispose(); mutex.Dispose(); }
    [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string value, uint revision, out IntPtr descriptor, out uint size);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeWaitHandle CreateMutex(ref SecurityAttributes attributes, bool initialOwner, string name);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeWaitHandle CreateEvent(ref SecurityAttributes attributes, bool manualReset, bool initialState, string name);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}
