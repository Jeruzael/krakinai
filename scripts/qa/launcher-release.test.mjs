import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { sameHelperBody, assertReleaseDestination } from './launcher-release.mjs';
test('only an identical helper body can reuse an existing signature', () => {
  assert(sameHelperBody('safe\n', '\uFEFFsafe\r\n# SIG # Begin signature block\r\nopaque signature'));
  assert(!sameHelperBody('changed\n', 'safe\n# SIG # Begin signature block\nopaque signature'));
});
test('release builds refuse existing or external destinations', () => {
  const root = resolve('.');
  for (const path of [root, resolve(root, 'bridge/dist'), resolve(root, 'qa-results/desktop-bridge-launcher/releases')]) assert.throws(() => assertReleaseDestination(root, path));
  assert.doesNotThrow(() => assertReleaseDestination(root, resolve(root, 'qa-results/desktop-bridge-launcher/releases/new-test-absent-destination')));
});
test('production bridge starts and shuts down outside the repository with only its declared dependencies', { timeout: 90000 }, async t => {
  const root = resolve('.'), fixture = await mkdtemp(join(tmpdir(), 'krakinai-standalone-'));
  const bridge = join(fixture, 'bridge'); await mkdir(bridge);
  t.diagnostic(`Retained synthetic standalone fixture: ${fixture}`);
  // Ancestor packages must not hide an undeclared production dependency.
  for (let parent = dirname(fixture); ; parent = dirname(parent)) {
    assert(!existsSync(join(parent, 'node_modules')), 'Standalone fixture has an ancestor node_modules');
    if (dirname(parent) === parent) break;
  }
  const run = promisify(execFile), options = { windowsHide: true, timeout: 60000, maxBuffer: 1048576 };
  await run(process.execPath, [join(root, 'bridge/build.mjs'), '--outdir', bridge], { ...options, cwd: join(root, 'bridge') });
  for (const file of ['package.json', 'package-lock.json']) await copyFile(join(root, 'bridge', file), join(bridge, file));
  const npm = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(path => path && existsSync(path));
  assert(npm, 'Installed npm CLI not found');
  // A portable build must also work with a cold cache on a fresh CI runner.
  await run(process.execPath, [npm, 'ci', '--omit=dev', '--cache', join(fixture, 'npm-cache'), '--prefer-offline', '--ignore-scripts', '--no-audit', '--no-fund'], { ...options, cwd: bridge });
  const reservation = createServer(); await new Promise((yes, no) => { reservation.once('error', no); reservation.listen(0, '127.0.0.1', yes); });
  const port = reservation.address().port; await new Promise((yes, no) => reservation.close(error => error ? no(error) : yes()));
  const generation = randomUUID().replaceAll('-', ''), origin = 'http://localhost:5184', env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  const child = spawn(process.execPath, [join(bridge, 'krakinai-managed-host.mjs'), '--app-origin', origin, '--port', String(port), '--generation', generation], { cwd: bridge, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '', ready, stopped = false;
  child.stdin.on('error', () => {});
  child.stderr.on('data', bytes => { stderr += String(bytes); if (stderr.length > 65536) child.kill(); });
  const lines = createInterface({ input: child.stdout });
  const timer = setTimeout(() => child.kill(), 10000);
  try {
    lines.on('line', line => {
      const frame = JSON.parse(line);
      if (frame.kind === 'ready') {
        ready = frame;
        child.stdin.write(JSON.stringify({ version: 'krakinai.launcher.v1', kind: 'shutdown', generation, connectionId: 'host', requestId: 'standalone_stop' }) + '\n');
      }
      if (frame.kind === 'stopped') stopped = true;
    });
    const exited = new Promise((yes, no) => { child.once('error', no); child.once('close', yes); });
    child.stdin.write(JSON.stringify({ version: 'krakinai.launcher.v1', kind: 'activate', generation, connectionId: 'host', requestId: 'standalone_start' }) + '\n');
    const code = await exited;
    assert.equal(code, 0, `Standalone host failed: ${stderr}`);
    assert.equal(ready?.generation, generation); assert.equal(ready?.origin, origin);
    assert.equal(ready?.relay, `http://127.0.0.1:${port}`); assert(stopped, 'Missing confirmed shutdown');
  } finally { clearTimeout(timer); lines.close(); child.stdin.destroy(); if (child.exitCode === null) child.kill(); }
});
