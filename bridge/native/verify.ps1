$ErrorActionPreference = 'Stop'
try {
  $pairingRequest = [Console]::In.ReadLine() | ConvertFrom-Json
  if (-not $pairingRequest -or $pairingRequest.secret.Length -ne 43) { throw 'Invalid pairing input' }
  Add-Type -AssemblyName PresentationFramework
  [xml]$pairingMarkup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="KRAKINAI Local Bridge Verification" Width="590" Height="650" WindowStartupLocation="CenterScreen" WindowState="Normal" ShowActivated="True" ShowInTaskbar="True" Topmost="True" Background="#F5F8FF" ResizeMode="CanResize">
 <ScrollViewer VerticalScrollBarVisibility="Auto"><StackPanel Margin="24">
  <TextBlock Text="Verify your local KRAKINAI bridge" FontSize="21" FontWeight="Bold" TextWrapping="Wrap" Margin="0,0,0,14"/>
  <TextBlock Text="Continue only if you deliberately started this bridge. Compare this origin and verification code with AI Connections in your browser." TextWrapping="Wrap" Margin="0,0,0,14"/>
  <TextBlock Text="Compiled bridge" FontWeight="Bold"/><TextBox x:Name="BridgePath" IsReadOnly="True" TextWrapping="Wrap" Margin="0,4,0,12"/>
  <TextBlock Text="Application origin and relay" FontWeight="Bold"/><TextBox x:Name="Origins" IsReadOnly="True" TextWrapping="Wrap" Margin="0,4,0,12"/>
  <TextBlock Text="Verification code" FontWeight="Bold"/><TextBox x:Name="VerificationCode" IsReadOnly="True" FontSize="19" Margin="0,4,0,12"/>
  <TextBlock Text="One-time pairing key" FontWeight="Bold"/><TextBox x:Name="PairingKey" AutomationProperties.AutomationId="KrakinaiPairingKey" IsReadOnly="True" Text="Hidden. Choose Show pairing key." FontFamily="Consolas" Margin="0,4,0,8"/>
  <Button x:Name="Reveal" AutomationProperties.AutomationId="KrakinaiRevealKey" Content="Show pairing key" HorizontalAlignment="Left" Padding="12,7" Margin="0,0,0,12"/>
  <TextBlock Text="Enter the key only in the matching KRAKINAI pairing form. It expires in two minutes. Do not paste it into a chat. This window does not copy to the clipboard." TextWrapping="Wrap" Margin="0,0,0,12"/>
  <CheckBox x:Name="Compared" AutomationProperties.AutomationId="KrakinaiComparedOrigin" Content="I verified the origin, code and bridge path" Margin="0,0,0,16"/>
  <StackPanel Orientation="Horizontal"><Button x:Name="Allow" AutomationProperties.AutomationId="KrakinaiAllowPairing" Content="Allow pairing" IsEnabled="False" Padding="16,9" Margin="0,0,12,0"/><Button x:Name="Deny" Content="Deny" Padding="16,9"/></StackPanel>
 </StackPanel></ScrollViewer>
</Window>
'@
  $pairingWindow = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $pairingMarkup))
  $pairingWindow.FindName('BridgePath').Text = [string]$pairingRequest.bridgePath
  $pairingWindow.FindName('Origins').Text = ([string]$pairingRequest.origin + "`n" + [string]$pairingRequest.relay)
  $pairingWindow.FindName('VerificationCode').Text = [string]$pairingRequest.verificationCode
  $pairingWindow.Add_ContentRendered({
    $null = $pairingWindow.Activate()
    # Non-secret display diagnostics only. Never emit the request, key or code.
    [Console]::Error.WriteLine('NATIVE_WINDOW_STATE ' + ((@{ visible = $pairingWindow.IsVisible; active = $pairingWindow.IsActive; topmost = $pairingWindow.Topmost; taskbar = $pairingWindow.ShowInTaskbar; state = [string]$pairingWindow.WindowState } | ConvertTo-Json -Compress)))
  })
  $pairingWindow.FindName('Reveal').Add_Click({ $pairingWindow.FindName('PairingKey').Text = [string]$pairingRequest.secret; $pairingWindow.Topmost = $false })
  $updatePairingConsent = { $pairingWindow.FindName('Allow').IsEnabled = $pairingWindow.FindName('Compared').IsChecked -eq $true }
  $pairingWindow.FindName('Compared').Add_Checked($updatePairingConsent)
  $pairingWindow.FindName('Compared').Add_Unchecked($updatePairingConsent)
  $script:pairingAllowed = $false
  $pairingWindow.FindName('Allow').Add_Click({ $script:pairingAllowed = $true; $pairingWindow.Close() })
  $pairingWindow.FindName('Deny').Add_Click({ $pairingWindow.Close() })
  $null = $pairingWindow.ShowDialog()
  [Console]::Out.WriteLine((@{ challengeId = [string]$pairingRequest.challengeId; allowed = [bool]$script:pairingAllowed } | ConvertTo-Json -Compress))
} catch {
  [Console]::Error.WriteLine("NATIVE_VERIFICATION_FAILED $($_.InvocationInfo.ScriptLineNumber) $($_.Exception.GetType().Name)")
  exit 1
}
