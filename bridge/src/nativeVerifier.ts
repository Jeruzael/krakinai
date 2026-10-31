import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { McpError, MCP_LIMITS } from '../../src/domain/mcpProtocol';
import type { NativeVerification, VerificationRequest } from './relay';

export function windowsVerifier(helperPath: string, info: VerificationRequest): NativeVerification {
  if (process.platform !== 'win32') throw new McpError('UNSUPPORTED_PLATFORM', 'Native pairing is currently supported on Windows only.');
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const child = spawn(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-File', helperPath], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { SystemRoot: systemRoot, WINDIR: systemRoot, TEMP: process.env.TEMP ?? '', TMP: process.env.TMP ?? '' },
  });
  let finished = false, resolveDecision: (allowed: boolean) => void, output = '';
  const decision = new Promise<boolean>(resolve => { resolveDecision = resolve; });
  const finish = (allowed: boolean) => { if (finished) return; finished = true; clearTimeout(timer); resolveDecision(allowed); };
  const timer = setTimeout(() => { finish(false); child.kill(); }, MCP_LIMITS.challengeMs); timer.unref();
  child.stdout.on('data', part => { output += String(part); if (output.length > 1024) { finish(false); child.kill(); } });
  child.stderr.resume(); // Never echo PowerShell diagnostics, arguments or stdin.
  child.on('error', () => finish(false)); child.stdin.on('error', () => finish(false));
  child.on('exit', code => { try { const result = JSON.parse(output); finish(code === 0 && Object.keys(result).length === 2 && result.challengeId === info.challengeId && result.allowed === true); } catch { finish(false); } });
  child.stdin.end(JSON.stringify(info) + '\n');
  return { decision, close() { finish(false); if (child.exitCode === null) child.kill(); } };
}
