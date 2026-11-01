import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { win32 } from 'node:path';

// Mirror native SettingsAccess at the other execution boundary. No trust/ACL mutation.
// Direct CLR reads avoid filesystem-cmdlet discovery under the restricted environment.
const probe = String.raw`
$ErrorActionPreference='Stop'
$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
$control=[long]([Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership)
$write=$control -bor [long][Security.AccessControl.FileSystemRights]::Write
function AssertPrivate($item,[long]$mask) {
  if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'CONFIGURATION_ACCESS_UNSAFE'}
  $acl=$item.GetAccessControl()
  if($allowed -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value){throw 'CONFIGURATION_ACCESS_UNSAFE'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
    if($rule.AccessControlType -ne 'Allow' -or ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0){continue}
    if($allowed -notcontains $rule.IdentityReference.Value -and (([long]$rule.FileSystemRights -band ($mask -bor 0x50000000)) -ne 0)){throw 'CONFIGURATION_ACCESS_UNSAFE'}
  }
}
$file=[IO.FileInfo]::new($env:KRAKINAI_CONFIGURATION_PATH)
if(-not $file.Exists -or ($file.Attributes -band [IO.FileAttributes]::Directory) -ne 0){throw 'CONFIGURATION_ACCESS_UNSAFE'}
AssertPrivate $file $write
$parent=$file.Directory; $first=$true
while($null -ne $parent){if($first){AssertPrivate $parent $write}else{AssertPrivate $parent $control};$first=$false;$parent=$parent.Parent}
[Console]::Out.WriteLine('PRIVATE_CONFIGURATION')
`;
export async function verifyConfigurationAccess(path: string) {
  if (process.platform !== 'win32') throw Error('WINDOWS_REQUIRED');
  const root = process.env.SystemRoot;
  if (!root || !/^[A-Za-z]:[\\/]/.test(root)) throw Error('WINDOWS_REQUIRED');
  const env: NodeJS.ProcessEnv = { KRAKINAI_CONFIGURATION_PATH: path };
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  try {
    const result = await promisify(execFile)(win32.join(root, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', probe], { env, timeout: 10000, maxBuffer: 8192, windowsHide: true });
    if (result.stdout.trim() !== 'PRIVATE_CONFIGURATION') throw Error('CONFIGURATION_ACCESS_UNSAFE');
  } catch { throw Error('CONFIGURATION_ACCESS_UNSAFE'); }
}
