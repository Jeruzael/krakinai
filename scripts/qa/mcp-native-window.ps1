# Synthetic QA only: inspect the verifier belonging to the specified owned Node
# process. The one-time key returns solely through this driver's private pipe.
param([int]$BridgePid, [string]$ExpectedBridge, [string]$ExpectedOrigin, [string]$ExpectedRelay, [string]$ExpectedCode, [ValidateSet('Allow','Deny')][string]$Decision = 'Allow')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$driverStep = 'window'
try {
  if ($BridgePid -le 0) { throw 'Invalid owned process' }
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $verificationWindow = $null
  $driverDeadline = [DateTime]::UtcNow.AddSeconds(20)
  while (-not $verificationWindow -and [DateTime]::UtcNow -lt $driverDeadline) {
    $ownedChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $BridgePid" | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*native*verify.ps1*' }
    foreach ($ownedChild in $ownedChildren) {
      $condition = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$ownedChild.ProcessId)
      $verificationWindow = [Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Children, $condition)
      if ($verificationWindow) { break }
    }
    if (-not $verificationWindow) { Start-Sleep -Milliseconds 100 }
  }
  if (-not $verificationWindow -or $verificationWindow.Current.Name -ne 'KRAKINAI Local Bridge Verification') { throw 'Owned verifier window unavailable' }
  function Find-OwnedControl([string]$id) {
    $condition = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty, $id)
    $control = $verificationWindow.FindFirst([Windows.Automation.TreeScope]::Descendants, $condition)
    if (-not $control) { throw 'Owned control unavailable' }
    return $control
  }
  function Read-OwnedValue([string]$id) { return (Find-OwnedControl $id).GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern).Current.Value }
  $driverStep = 'transcript'
  if ((Read-OwnedValue 'BridgePath') -ne $ExpectedBridge -or (Read-OwnedValue 'VerificationCode') -ne $ExpectedCode -or (Read-OwnedValue 'Origins').Replace("`r", '') -ne "$ExpectedOrigin`n$ExpectedRelay") { throw 'Verifier transcript mismatch' }
  if ($Decision -eq 'Deny') {
    $condition = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty, 'Deny')
    $verificationWindow.FindFirst([Windows.Automation.TreeScope]::Descendants, $condition).GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke()
    [Console]::Out.WriteLine('{"denied":true,"verified":true}')
    exit 0
  }
  $driverStep = 'reveal'
  (Find-OwnedControl 'KrakinaiRevealKey').GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke()
  $driverSecret = Read-OwnedValue 'KrakinaiPairingKey'
  if ($driverSecret -notmatch '^[A-Za-z0-9_-]{43}$') { throw 'Invalid one-time key' }
  $driverStep = 'consent'
  (Find-OwnedControl 'KrakinaiComparedOrigin').GetCurrentPattern([Windows.Automation.TogglePattern]::Pattern).Toggle()
  (Find-OwnedControl 'KrakinaiAllowPairing').GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke()
  [Console]::Out.WriteLine((@{ secret = $driverSecret; verified = $true; allowed = $true } | ConvertTo-Json -Compress))
  $driverSecret = ''
} catch { [Console]::Error.WriteLine("SYNTHETIC_NATIVE_UI_CHECK_FAILED $driverStep $($_.InvocationInfo.ScriptLineNumber) $($_.Exception.GetType().Name)"); exit 1 }
