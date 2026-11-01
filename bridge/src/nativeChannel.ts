import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { open } from 'node:fs/promises';
import { win32 } from 'node:path';
import { promisify } from 'node:util';
import { validateOrigin, validateRelayAddress } from '../../src/domain/mcpProtocol';
import { LauncherLineDecoder, LauncherQueueBudget, validateLauncherFrame, type LauncherFrame } from './launcherProtocol';
import type { AdapterChannel } from './stdioAdapter';
import { verifyConfigurationAccess } from './windowsPrivateConfig';

export interface AdapterSettings { nativeExecutable: string; approvedSignerThumbprint: string; installationId: string; appOrigin: string; relayPort: number }
export async function readAdapterSettings(path: string): Promise<AdapterSettings> {
  if (!localPath(path)) throw Error('CONFIGURATION_INVALID');
  await verifyConfigurationAccess(path);
  const file = await open(path, 'r'); let value: unknown;
  try { const info = await file.stat(); if (!info.isFile() || info.size > 16384) throw Error('CONFIGURATION_INVALID'); value = JSON.parse(await file.readFile('utf8')); }
  finally { await file.close(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('CONFIGURATION_INVALID');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !['formatVersion', 'installationId', 'nodePath', 'bridgeDirectory', 'nativeExecutable', 'approvedSignerThumbprint', 'appOrigin', 'relayPort'].includes(key)) || record.formatVersion !== 1) throw Error('CONFIGURATION_INVALID');
  const settings = value as AdapterSettings;
  if (!localPath(settings.nativeExecutable) || !settings.nativeExecutable.toLowerCase().endsWith('.exe') || !/^[a-f0-9]{32}$/.test(settings.installationId) || !/^[a-fA-F0-9]{40}$/.test(settings.approvedSignerThumbprint)) throw Error('CONFIGURATION_INVALID');
  validateOrigin(settings.appOrigin);
  if (!Number.isSafeInteger(settings.relayPort) || settings.relayPort < 1 || settings.relayPort > 65535) throw Error('CONFIGURATION_INVALID');
  validateRelayAddress('http://127.0.0.1:' + settings.relayPort); return settings;
}
function localPath(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value) && value.length < 1500 && !/[\x00-\x1f]/.test(value); }
function environment(): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) if (process.env[key]) result[key] = process.env[key];
  return result;
}
async function verifyExecutable(settings: AdapterSettings) {
  const root = process.env.SystemRoot;
  if (process.platform !== 'win32' || !localPath(root)) throw Error('WINDOWS_REQUIRED');
  const script = "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath $env:KRAKINAI_CHANNEL_EXE; $t=$s.SignerCertificate.Thumbprint; $trusted=($t -and ((Test-Path ('Cert:\\CurrentUser\\TrustedPublisher\\'+$t)) -or (Test-Path ('Cert:\\LocalMachine\\TrustedPublisher\\'+$t)))); if($s.Status -ne 'Valid' -or $t -ne $env:KRAKINAI_CHANNEL_SIGNER -or -not $trusted){exit 1}; Write-Output 'VERIFIED'";
  const result = await promisify(execFile)(win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...environment(), KRAKINAI_CHANNEL_EXE: settings.nativeExecutable, KRAKINAI_CHANNEL_SIGNER: settings.approvedSignerThumbprint }, timeout: 4000, maxBuffer: 8192, windowsHide: true });
  if (result.stdout.trim() !== 'VERIFIED') throw Error('NATIVE_SIGNATURE_OR_TRUST');
}
class ProcessChannel implements AdapterChannel {
  private decoder = new LauncherLineDecoder('adapter-response');
  private budget = new LauncherQueueBudget();
  private frame?: (frame: LauncherFrame) => void;
  private ended?: () => void;
  private closed = false;
  constructor(private child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', bytes => { try { for (const frame of this.decoder.push(bytes)) { if (!this.frame) throw Error('channel'); this.frame(frame); } } catch { this.close(); } });
    child.stderr.resume(); child.stdin.on('error', () => this.close()); child.stdout.on('error', () => this.close());
    child.on('error', () => this.close()); child.once('exit', () => this.close());
  }
  onFrame(callback: (frame: LauncherFrame) => void) { this.frame = callback; }
  onClose(callback: () => void) { this.ended = callback; if (this.closed) queueMicrotask(callback); }
  send(frame: LauncherFrame) {
    if (this.closed) throw Error('channel'); validateLauncherFrame(frame, 'adapter-request');
    const bytes = Buffer.from(JSON.stringify(frame) + '\n'); this.budget.add(bytes.length);
    this.child.stdin.write(bytes, error => { this.budget.release(bytes.length); if (error) this.close(); });
  }
  close() {
    if (this.closed) return; this.closed = true;
    this.child.stdin.destroy(); this.child.stdout.destroy(); this.child.stderr.destroy(); this.child.kill(); this.ended?.();
  }
}
/** Fixed native headless role only. No GUI launch, startup flag, trust modification or model-supplied command. */
export async function openNativeChannel(settings: AdapterSettings): Promise<AdapterChannel> {
  await verifyExecutable(settings);
  return new ProcessChannel(spawn(settings.nativeExecutable, ['--stdio-channel', 'KRAKINAI.BridgeLauncher.v1.' + settings.installationId], { env: environment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }));
}
