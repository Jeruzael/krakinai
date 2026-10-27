// Human-driven Windows Save As test. The original native picker is delegated to,
// never replaced with an OPFS/fake handle. Retains all artifacts and profile.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')]; }));
if (!args.case || process.env.CI) throw new Error('Manual --case=<owned successful recovery directory> required.');
const folder = resolve(args.case); assert.equal(await readFile(join(folder, '.krakinai-recovery-owned'), 'utf8'), 'synthetic-recovery-only-v1\n');
const expected = JSON.parse(await readFile(join(folder, 'recovery-results.json'), 'utf8')); assert.equal(expected.smallFixturePass, true);
const stamp = Date.now(); const name = `native-save-as-${stamp}.zip`; const target = join(folder, name);
try { await stat(target); throw new Error('Refusing to overwrite an existing file.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const staticRoot = join(folder, 'static'); const origin = 'http://127.0.0.1:4198';
const server = createServer(async (request, response) => { try { const path = resolve(staticRoot, decodeURIComponent(new URL(request.url, origin).pathname).replace(/^\//, '') || 'index.html'); if (!path.toLowerCase().startsWith((staticRoot + sep).toLowerCase())) throw new Error('Outside root'); const bytes = await readFile(path); response.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }); response.end(bytes); } catch { response.writeHead(404); response.end(); } });
await new Promise((done, reject) => { server.once('error', reject); server.listen(4198, '127.0.0.1', done); });
let context; const result = { test: 'actual installed Chrome, human Save As dialog, small representative fixture', largeFileCertified: false, pickerStubbed: false, expectedPath: target, artifactsDeleted: false };
try {
  context = await chromium.launchPersistentContext(join(folder, 'fresh-chromium-profile'), { channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 } });
  result.browserVersion = context.browser().version(); await context.addInitScript(() => { window.__recovery = () => import('/__recovery-api.mjs'); });
  const page = await context.newPage(); await page.goto(origin); await page.getByText('Your reusable video creation toolkit').waitFor();
  const actual = await page.evaluate(async () => { const a = await window.__recovery(); return a.fixtures.describeRecoverySnapshot(a.db, a.backupArchive); });
  assert.deepEqual(actual, expected.original, 'Owned synthetic profile changed; refusing to export unknown data.');
  await page.evaluate(filename => {
    document.title = 'KRAKINAI Synthetic Native Save As Test';
    const original = window.showSaveFilePicker;
    if (typeof original !== 'function') throw new Error('Native save picker unavailable.');
    window.__nativeOriginalSource = Function.prototype.toString.call(original); window.__nativeCalls = 0;
    window.showSaveFilePicker = async options => {
      window.__nativeCalls++; const handle = await original.call(window, { ...options, suggestedName: filename });
      window.__nativeSavedHandle = handle; return handle;
    };
  }, name);
  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click();
  await writeFile(join(folder, 'native-manual-ready.json'), JSON.stringify({ expectedPath: target, title: 'KRAKINAI Synthetic Native Save As Test', action: 'Click Export Full Library (ZIP64), paste expectedPath into native File name, Save a new file only.' }, null, 2));
  console.log(`READY ${target}`);
  await page.getByText(/Saved .* bytes\. Select the saved file/).waitFor({ timeout: 600_000 });
  const saved = await page.evaluate(async () => {
    const handle = window.__nativeSavedHandle; if (!handle || !window.__nativeOriginalSource.includes('[native code]')) throw new Error('No delegated native picker handle.');
    const file = await handle.getFile(); if (file.size > 64 * 1024 * 1024) throw new Error('Readback copy exceeds small-fixture bound.');
    return { filename: file.name, bytes: file.size, sha256: await (await window.__recovery()).backupArchive.hashBackupBlob(file), contents: Array.from(new Uint8Array(await file.arrayBuffer())), calls: window.__nativeCalls, nativeOriginalSource: window.__nativeOriginalSource };
  });
  const physical = await readFile(target); assert.equal(createHash('sha256').update(physical).digest('hex'), saved.sha256); assert.equal(physical.length, saved.bytes);
  const proof = join(folder, `native-verification-${stamp}`); await mkdir(proof, { recursive: false });
  await writeFile(join(proof, 'native-readback.zip'), Buffer.from(saved.contents)); await cp(join(folder, 'expected-source.json'), join(proof, 'expected-source.json'), { force: false, errorOnExist: true });
  await promisify(execFile)(args.python || 'python', [resolve('scripts/qa/recovery-inspect.py'), join(proof, 'native-readback.zip'), join(proof, 'expected-source.json')], { windowsHide: true });
  result.pass = true; result.file = { filename: saved.filename, bytes: saved.bytes, sha256: saved.sha256, nativeCalls: saved.calls, nativeOriginalSource: saved.nativeOriginalSource, pathConfirmedByDiskReadback: true };
  result.python = JSON.parse(await readFile(join(proof, 'python-inspection.json'), 'utf8')); result.proofDirectory = proof;
} catch (error) { result.pass = false; result.error = error.stack || String(error); process.exitCode = 1; }
finally { if (context) await context.close().catch(() => {}); await new Promise(done => server.close(done)); await writeFile(join(folder, 'native-manual-results.json'), JSON.stringify(result, null, 2)); }
console.log(JSON.stringify({ pass: result.pass, file: result.file, error: result.error }));
