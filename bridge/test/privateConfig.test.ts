import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
describe('Windows adapter configuration access', () => {
  it.skipIf(process.platform !== 'win32')('rejects a real permissive existing folder and accepts it after exact ACL restoration', async () => {
    expect(existsSync('src/windowsPrivateConfig.ts'), 'private config guard implemented').toBe(true);
    const { verifyConfigurationAccess } = await import('../src/windowsPrivateConfig');
    const parent = resolve(process.env.KRAKINAI_PRIVATE_CONFIG_TEST_ROOT ?? 'qa-results/desktop-launcher-private-config', 'acl'); await mkdir(parent, { recursive: true });
    const folder = await mkdtemp(join(parent, 'owned-')), config = join(folder, 'settings.json'); await writeFile(config, '{}');
    await verifyConfigurationAccess(config);
    const powershell = resolve(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    const run = (script: string, extra: Record<string, string> = {}) => promisify(execFile)(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...env, KRAKINAI_TEST_CONFIG_FOLDER: folder, ...extra }, windowsHide: true, timeout: 10000, maxBuffer: 8192 });
    const original = (await run("$ErrorActionPreference='Stop'; $d=[IO.DirectoryInfo]$env:KRAKINAI_TEST_CONFIG_FOLDER; $a=$d.GetAccessControl(); $old=$a.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access); $r=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),[Security.AccessControl.FileSystemRights]::Write,[Security.AccessControl.AccessControlType]::Allow); $a.AddAccessRule($r); $d.SetAccessControl($a); Write-Output $old")).stdout.trim();
    try { await expect(verifyConfigurationAccess(config)).rejects.toThrow('CONFIGURATION_ACCESS_UNSAFE'); }
    finally { await run("$ErrorActionPreference='Stop'; $d=[IO.DirectoryInfo]$env:KRAKINAI_TEST_CONFIG_FOLDER; $a=[Security.AccessControl.DirectorySecurity]::new(); $a.SetSecurityDescriptorSddlForm($env:KRAKINAI_TEST_ORIGINAL_ACL,[Security.AccessControl.AccessControlSections]::Access); $d.SetAccessControl($a)", { KRAKINAI_TEST_ORIGINAL_ACL: original }); }
    await verifyConfigurationAccess(config);
  });
});
