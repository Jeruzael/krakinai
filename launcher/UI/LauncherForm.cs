using Krakinai.BridgeLauncher.Core;

namespace Krakinai.BridgeLauncher.UI;

internal sealed class LauncherForm : Form
{
    private readonly BridgeController controller;
    private readonly string configPath;
    private readonly NotifyIcon tray;
    private readonly Button start = ActionButton("&Start bridge"), stop = ActionButton("S&top bridge"), restart = ActionButton("&Restart bridge"), settings = ActionButton("S&ettings");
    private readonly Label bridge = StatusLabel("Bridge status"), browser = StatusLabel("Browser pairing status"), mcp = StatusLabel("MCP client status"), origin = StatusLabel("Application origin"), relay = StatusLabel("Local relay address");
    private readonly Label message = new() { AutoSize = true, Dock = DockStyle.Fill, MaximumSize = new(730, 0), AccessibleName = "Connection guidance", Padding = new(10), Margin = new(0, 15, 0, 12) };
    private readonly ToolStripMenuItem trayStart = new("Start bridge"), trayStop = new("Stop bridge"), trayRestart = new("Restart bridge");
    private readonly ToolStripMenuItem trayQuit = new("Quit & Stop Bridge");
    private bool explicitQuit, quitting, trayNotice, editingSettings;
    public LauncherForm(BridgeController controller, string configPath)
    {
        this.controller = controller; this.configPath = configPath;
        Text = "KRAKINAI Bridge Launcher"; AccessibleName = Text; StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi; ClientSize = new(800, 590); MinimumSize = new(680, 590);
        BackColor = SystemColors.Window; ForeColor = SystemColors.WindowText;
        if (!SystemInformation.HighContrast) { start.UseVisualStyleBackColor = false; start.BackColor = Color.FromArgb(37, 99, 235); start.ForeColor = Color.White; }
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new(22), ColumnCount = 2, RowCount = 12, AutoScroll = true };
        layout.ColumnStyles.Add(new(SizeType.Percent, 36)); layout.ColumnStyles.Add(new(SizeType.Percent, 64)); Controls.Add(layout);
        var title = new Label { Text = "KRAKINAI  ·  Local Bridge", Font = new(Font.FontFamily, 16, FontStyle.Bold), AutoSize = true, Margin = new(0, 0, 0, 10) };
        layout.Controls.Add(title, 0, 0); layout.SetColumnSpan(title, 2);
        var subtitle = new Label { Text = "Manual control. Browser-owned permissions. Human-reviewed proposals.", AutoSize = true, MaximumSize = new(730, 0), Margin = new(0, 0, 0, 22) };
        layout.Controls.Add(subtitle, 0, 1); layout.SetColumnSpan(subtitle, 2);
        AddRow(layout, 2, "Bridge", bridge); AddRow(layout, 3, "Browser", browser); AddRow(layout, 4, "MCP client", mcp);
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, Margin = new(0, 14, 0, 20) };
        actions.Controls.AddRange([start, stop, restart]); layout.Controls.Add(actions, 0, 5); layout.SetColumnSpan(actions, 2);
        AddRow(layout, 6, "Application origin", origin); AddRow(layout, 7, "Local bridge address", relay);
        layout.Controls.Add(message, 0, 8); layout.SetColumnSpan(message, 2);
        var setup = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill };
        Button copyAddress = ActionButton("Copy &app address"), copyMcp = ActionButton("Review &MCP configuration");
        copyAddress.Click += (_, _) => Copy(controller.Status.Origin + "/#/connections/ai"); copyMcp.Click += (_, _) => ReviewConfiguration();
        var quit = ActionButton("&Quit && stop bridge"); quit.Click += async (_, _) => await QuitAsync();
        setup.Controls.AddRange([settings, copyAddress, copyMcp, quit]); layout.Controls.Add(setup, 0, 9); layout.SetColumnSpan(setup, 2);
        var footer = new Label { Text = "Window close hides to the system tray. Use Quit && Stop Bridge to exit.\nNo library content, pairing keys or proposals are stored in this launcher.", AutoSize = true, MaximumSize = new(730, 0), Margin = new(0, 20, 0, 0) };
        layout.Controls.Add(footer, 0, 10); layout.SetColumnSpan(footer, 2);
        var menu = new ContextMenuStrip(); menu.Items.Add("Open Launcher", null, (_, _) => FocusLauncher()); menu.Items.AddRange([trayStart, trayStop, trayRestart, new ToolStripSeparator(), trayQuit]); trayQuit.Click += async (_, _) => await QuitAsync();
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "KRAKINAI — bridge stopped", ContextMenuStrip = menu, Visible = true };
        tray.DoubleClick += (_, _) => FocusLauncher();
        start.Click += async (_, _) => await RunAsync(controller.StartAsync); stop.Click += async (_, _) => await RunAsync(controller.StopAsync); restart.Click += async (_, _) => await RunAsync(controller.RestartAsync);
        trayStart.Click += async (_, _) => await RunAsync(controller.StartAsync); trayStop.Click += async (_, _) => await RunAsync(controller.StopAsync); trayRestart.Click += async (_, _) => await RunAsync(controller.RestartAsync);
        settings.Click += (_, _) => EditSettings();
        controller.StatusChanged += UpdateStatus; Shown += (_, _) => { UpdateStatus(controller.Status); start.Focus(); };
        FormClosing += (_, args) =>
        {
            if (LauncherPresentation.ShouldQuit(explicitQuit)) return;
            args.Cancel = true; Hide();
            if (!trayNotice) { trayNotice = true; tray.ShowBalloonTip(4000, "KRAKINAI is in the system tray", "The bridge keeps its current state. Right-click the tray icon for Quit & Stop Bridge.", ToolTipIcon.Info); }
        };
    }
    private static Button ActionButton(string text) => new() { Text = text, AccessibleName = text.Replace("&", "", StringComparison.Ordinal), AutoSize = true, Padding = new(7, 4, 7, 4), Margin = new(0, 0, 8, 6) };
    private static Label StatusLabel(string name) => new() { AccessibleName = name, AutoSize = true, Dock = DockStyle.Fill, Margin = new(0, 5, 0, 9), MaximumSize = new(460, 0) };
    private static void AddRow(TableLayoutPanel layout, int row, string title, Label value) { layout.Controls.Add(new Label { Text = title, AutoSize = true, Margin = new(0, 5, 0, 9) }, 0, row); layout.Controls.Add(value, 1, row); }
    private void OnUi(Action action)
    {
        if (IsDisposed || !IsHandleCreated) return;
        if (InvokeRequired) { try { BeginInvoke(action); } catch (InvalidOperationException) { } } else action();
    }
    public void FocusLauncher() => OnUi(() => { Show(); WindowState = FormWindowState.Normal; Activate(); });
    public void ShowChannelError(string code) => OnUi(() => { message.Text = LauncherPresentation.Explain(code); message.AccessibleName = "Connection guidance: " + message.Text; });
    private void UpdateStatus(LauncherStatus status) => OnUi(() =>
    {
        var view = LauncherPresentation.From(status);
        bridge.Text = view.Bridge; browser.Text = view.Browser; mcp.Text = view.Mcp; origin.Text = status.Origin; relay.Text = status.Relay; message.Text = view.Message;
        bridge.AccessibleName = "Bridge: " + view.Bridge; browser.AccessibleName = "Browser: " + view.Browser; mcp.AccessibleName = "MCP client: " + view.Mcp;
        origin.AccessibleName = "Application origin: " + status.Origin; relay.AccessibleName = "Local bridge address: " + status.Relay; message.AccessibleName = "Connection guidance: " + view.Message;
        start.Enabled = trayStart.Enabled = view.CanStart && !quitting && !editingSettings; stop.Enabled = trayStop.Enabled = view.CanStop && !quitting && !editingSettings; restart.Enabled = trayRestart.Enabled = view.CanRestart && !quitting && !editingSettings; settings.Enabled = view.CanEditSettings && !quitting && !editingSettings;
        trayQuit.Enabled = !quitting && !editingSettings;
        tray.Text = "KRAKINAI — bridge " + status.Bridge;
    });
    private async Task RunAsync(Func<Task> action)
    {
        if (editingSettings) return;
        try { await action(); } catch { ShowChannelError("HOST_START_FAILED"); }
        if (!IsDisposed) UpdateStatus(controller.Status);
    }
    private void EditSettings()
    {
        if (editingSettings || quitting || !LauncherPresentation.From(controller.Status).CanEditSettings) return;
        editingSettings = true; UpdateStatus(controller.Status);
        try { using var dialog = new SettingsDialog(controller.Settings, value => controller.UpdateSettings(value, configPath)); dialog.ShowDialog(this); }
        finally { editingSettings = false; UpdateStatus(controller.Status); settings.Focus(); }
    }
    private void ReviewConfiguration()
    {
        if (!File.Exists(configPath) || controller.Settings.Validate() is not null) { ShowChannelError("CONFIGURATION_INVALID"); return; }
        using var dialog = new Form { Text = "Review Codex MCP configuration", StartPosition = FormStartPosition.CenterParent, ClientSize = new(700, 400), MinimumSize = new(600, 350), AutoScaleMode = AutoScaleMode.Dpi };
        var content = LauncherPresentation.McpConfiguration(controller.Settings, configPath);
        var text = new TextBox { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Both, WordWrap = false, Dock = DockStyle.Fill, Text = content.Replace("\n", Environment.NewLine, StringComparison.Ordinal), AccessibleName = "Reviewed MCP configuration" };
        var panel = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 72, Padding = new(8) };
        Button copy = ActionButton("&Copy configuration"), close = ActionButton("Close"); copy.Click += (_, _) => Copy(content); close.DialogResult = DialogResult.Cancel;
        panel.Controls.AddRange([copy, close]); dialog.Controls.Add(text); dialog.Controls.Add(panel); dialog.CancelButton = close; dialog.ShowDialog(this);
    }
    private void Copy(string text) { try { Clipboard.SetText(text); } catch { MessageBox.Show(this, "The clipboard is busy. Try again.", "Copy unavailable"); } }
    private async Task QuitAsync()
    {
        if (quitting || editingSettings) return; quitting = true; UpdateStatus(controller.Status);
        await RunAsync(controller.StopAsync); explicitQuit = true; tray.Visible = false; Close();
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { controller.StatusChanged -= UpdateStatus; tray.Visible = false; tray.Dispose(); }
        base.Dispose(disposing);
    }
}
