using System.Security.Principal;
using System.Security.Cryptography;
using System.Text;
using Krakinai.BridgeLauncher.Core;
using Krakinai.BridgeLauncher.UI;

namespace Krakinai.BridgeLauncher;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        using var identity = WindowsIdentity.GetCurrent();
        bool elevated = new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        if (args.Length == 2 && args[0] == "--stdio-channel")
            return elevated ? 1 : NativeChannel.RunAsync(args[1], Console.OpenStandardInput(), Console.OpenStandardOutput(), CancellationToken.None).GetAwaiter().GetResult();
        ApplicationConfiguration.Initialize();
        if (elevated) { MessageBox.Show("Run the launcher normally under the same Windows account as Codex. Administrator mode is not supported.", "KRAKINAI — account mismatch"); return 1; }
        if (args.Length != 0 && (args.Length != 2 || args[0] != "--config")) return 1;
        var path = args.Length == 2 ? Path.GetFullPath(args[1]) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KRAKINAI", "BridgeLauncher", "launcher-settings.json");
        try
        {
            var executable = Environment.ProcessPath ?? throw new LauncherFault("PATH_INVALID");
            if (path.StartsWith(@"\\", StringComparison.Ordinal)) throw new LauncherFault("PATH_INVALID");
            var settings = File.Exists(path) ? LauncherSettings.Load(path) : new LauncherSettings { InstallationId = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(path.ToUpperInvariant())))[..32], NativeExecutable = executable, BridgeDirectory = Path.Combine(AppContext.BaseDirectory, "bridge") };
            if (!Path.GetFullPath(settings.NativeExecutable).Equals(executable, StringComparison.OrdinalIgnoreCase)) throw new LauncherFault("NATIVE_PATH_MISMATCH");
            using var instance = new SingleInstance(settings.InstallationId);
            if (!instance.Primary) return 0;
            var controller = new BridgeController(settings, new ReadinessProbe(new WindowsPlatformProbe()), new ManagedNodeHostFactory());
            var pipe = new LauncherPipeServer(settings.PipeName, controller);
            try
            {
                pipe.StartAsync().GetAwaiter().GetResult();
                using var form = new LauncherForm(controller, path);
                instance.OnFocus(form.FocusLauncher); pipe.ConnectionRejected += form.ShowChannelError;
                Application.Run(form);
            }
            finally { pipe.DisposeAsync().AsTask().GetAwaiter().GetResult(); controller.DisposeAsync().AsTask().GetAwaiter().GetResult(); }
            return 0;
        }
        catch (Exception error)
        {
            var code = error is LauncherFault fault ? fault.Code : "LAUNCHER_SETUP_FAILED";
            MessageBox.Show(LauncherPresentation.Explain(code), "KRAKINAI — " + code, MessageBoxButtons.OK, MessageBoxIcon.Warning); return 1;
        }
    }
}
