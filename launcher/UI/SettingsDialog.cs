using Krakinai.BridgeLauncher.Core;

namespace Krakinai.BridgeLauncher.UI;

internal sealed class SettingsDialog : Form
{
    private readonly TextBox node = Input("Node.js 22 executable"), bridge = Input("Bridge release directory"), origin = Input("Exact application origin"), signer = Input("Approved public signer thumbprint");
    private readonly NumericUpDown port = new() { Minimum = 1, Maximum = 65535, AccessibleName = "Explicit relay port", Width = 150 };
    private readonly LauncherSettings initial;
    private readonly Action<LauncherSettings> commit;
    public SettingsDialog(LauncherSettings settings, Action<LauncherSettings> commit)
    {
        initial = settings; this.commit = commit;
        Text = "KRAKINAI — Launcher Settings"; StartPosition = FormStartPosition.CenterParent;
        AutoScaleMode = AutoScaleMode.Dpi; ClientSize = new(690, 510); MinimumSize = new(600, 500); MaximizeBox = false; MinimizeBox = false;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new(18), ColumnCount = 2, RowCount = 10, AutoScroll = true };
        layout.ColumnStyles.Add(new(SizeType.Percent, 100)); layout.ColumnStyles.Add(new(SizeType.AutoSize)); Controls.Add(layout);
        var note = new Label { Text = "Use your existing browser origin. localhost and 127.0.0.1 have separate libraries. No certificate trust or execution-policy changes are made here.", AutoSize = true, MaximumSize = new(620, 0), Margin = new(0, 0, 0, 14) };
        layout.Controls.Add(note, 0, 0); layout.SetColumnSpan(note, 2);
        Add(layout, 1, "&Node.js 22 executable", node, "Browse Node", () => BrowseExecutable(node));
        Add(layout, 2, "&Bridge release directory", bridge, "Browse bridge", BrowseBridge);
        Add(layout, 3, "Exact application &origin", origin);
        Add(layout, 4, "Relay &port (80 is unsupported)", port);
        Add(layout, 5, "Approved public &signer thumbprint", signer);
        var own = new Label { AutoSize = true, Text = "Launcher: " + settings.NativeExecutable, MaximumSize = new(620, 0), Margin = new(0, 12, 0, 10) };
        layout.Controls.Add(own, 0, 6); layout.SetColumnSpan(own, 2);
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var cancel = new Button { Text = "Cancel", AutoSize = true, DialogResult = DialogResult.Cancel };
        var save = new Button { Text = "&Save settings", AutoSize = true }; save.Click += Save;
        actions.Controls.Add(cancel); actions.Controls.Add(save); layout.Controls.Add(actions, 0, 7); layout.SetColumnSpan(actions, 2);
        AcceptButton = save; CancelButton = cancel;
        node.Text = settings.NodePath; bridge.Text = settings.BridgeDirectory; origin.Text = settings.AppOrigin; signer.Text = settings.ApprovedSignerThumbprint;
        port.Value = Math.Clamp(settings.RelayPort, 1, 65535);
    }
    private static TextBox Input(string name) => new() { AccessibleName = name, Dock = DockStyle.Fill, Margin = new(0, 0, 6, 10) };
    private static void Add(TableLayoutPanel layout, int row, string caption, Control input, string? browse = null, Action? action = null)
    {
        var field = new TableLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, RowCount = 2, ColumnCount = 1, Margin = new(0) };
        field.Controls.Add(new Label { Text = caption, AutoSize = true }, 0, 0); field.Controls.Add(input, 0, 1); layout.Controls.Add(field, 0, row);
        if (browse is not null) { var button = new Button { Text = "Browse…", AccessibleName = browse, AutoSize = true, Anchor = AnchorStyles.Bottom, Margin = new(2, 0, 0, 10) }; button.Click += (_, _) => action?.Invoke(); layout.Controls.Add(button, 1, row); }
    }
    private void BrowseExecutable(TextBox input)
    {
        using var picker = new OpenFileDialog { Title = "Select installed Node.js 22", Filter = "Windows executable (*.exe)|*.exe", CheckFileExists = true };
        if (picker.ShowDialog(this) == DialogResult.OK) input.Text = picker.FileName;
    }
    private void BrowseBridge()
    {
        using var picker = new FolderBrowserDialog { Description = "Select the packaged bridge directory", ShowNewFolderButton = false };
        if (picker.ShowDialog(this) == DialogResult.OK) bridge.Text = picker.SelectedPath;
    }
    private void Save(object? sender, EventArgs args)
    {
        var value = initial with { NodePath = node.Text.Trim(), BridgeDirectory = bridge.Text.Trim(), AppOrigin = origin.Text.Trim(), RelayPort = (int)port.Value, ApprovedSignerThumbprint = signer.Text.Trim().ToUpperInvariant() };
        if (value.Validate() is { } error) { MessageBox.Show(this, LauncherPresentation.Explain(error), error, MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
        try { commit(value); DialogResult = DialogResult.OK; Close(); }
        catch (LauncherFault fault) { MessageBox.Show(this, LauncherPresentation.Explain(fault.Code), fault.Code, MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        catch { MessageBox.Show(this, "Settings could not be saved. Check this Windows account's access to the selected configuration directory.", "Settings not saved", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
}
