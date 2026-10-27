// Restore a specifically identified synthetic native-picker export, read-only at source.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [k, ...v] = arg.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
if (!args.case || !args.file || process.env.CI) throw new Error('Manual --case=<owned case> --file=<explicit synthetic export> required.');
const folder = resolve(args.case); assert.equal(await readFile(join(folder, '.krakinai-recovery-owned'), 'utf8'), 'synthetic-recovery-only-v1\n');
const expected = JSON.parse(await readFile(join(folder, 'expected-source.json'), 'utf8'));
const userFile = resolve(args.file); const before = await stat(userFile, { bigint: true });
if (before.size > 64n * 1024n * 1024n) throw new Error('Not the known small synthetic export.');
const sourceSha256 = createHash('sha256').update(await readFile(userFile)).digest('hex');
const profile = join(folder, 'native-export-restored-profile'); await mkdir(profile, { recursive: false });
const staticRoot = join(folder, 'static'); const origin = 'http://127.0.0.1:4199';
const server = createServer(async (request, response) => { try { const path = resolve(staticRoot, decodeURIComponent(new URL(request.url, origin).pathname).replace(/^\//, '') || 'index.html'); if (!path.toLowerCase().startsWith((staticRoot + sep).toLowerCase())) throw new Error('Outside root'); const bytes = await readFile(path); response.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream' }); response.end(bytes); } catch { response.writeHead(404); response.end(); } });
await new Promise((done, reject) => { server.once('error', reject); server.listen(4199, '127.0.0.1', done); });
let context; const started = performance.now(); const proof = { sourceReadOnly: true, sourceSha256, sourceBytes: Number(before.size), largeRestoreCertified: false, profileRetained: true };
async function launch() { context = await chromium.launchPersistentContext(profile, { headless: true }); await context.addInitScript(() => { window.__recovery = () => import('/__recovery-api.mjs'); }); const page = await context.newPage(); await page.goto(origin); await page.getByText('Your reusable video creation toolkit').waitFor(); return page; }
try {
  let page = await launch(); proof.browserVersion = context.browser().version();
  await page.evaluate(async () => { const a = await window.__recovery(); const snap = await a.db.getAllSnapshot(); if (snap.assets.length || snap.media.length || snap.scenes.length) throw new Error('Fresh profile required.'); await a.db.savePromptAsset({ title: 'Synthetic native-restore sentinel', category: 'styles', promptText: 'Replace only after confirmation.', tags: [] }); });
  await page.getByRole('button', { name: 'Open Settings and ZIP Backup' }).click(); await page.getByLabel('Choose a backup to stage for restore').setInputFiles(userFile);
  await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).waitFor();
  const stillPrevious = await page.evaluate(async () => (await (await window.__recovery()).db.getAllSnapshot()).assets.some(asset => asset.title === 'Synthetic native-restore sentinel'));
  assert.equal(stillPrevious, true); await page.getByRole('button', { name: 'Confirm & Replace Current Library' }).click(); await page.getByText(/Library replacement committed/).waitFor();
  await context.close(); page = await launch();
  const restored = await page.evaluate(async () => { const a = await window.__recovery(); return { snapshot: await a.fixtures.describeRecoverySnapshot(a.db, a.backupArchive), decoded: await a.fixtures.decodeRecoveryMedia(a.db) }; });
  assert.deepEqual(restored.snapshot, expected); assert.equal(restored.decoded.filter(media => media.playable).length, 1);
  const after = await stat(userFile, { bigint: true }); assert.equal(after.size, before.size); assert.equal(after.mtimeNs, before.mtimeNs); assert.equal(createHash('sha256').update(await readFile(userFile)).digest('hex'), sourceSha256);
  proof.pass = true; proof.explicitConfirmation = true; proof.browserRestart = true; proof.counts = restored.snapshot.counts; proof.allMetadataAndMediaExact = true; proof.decoded = restored.decoded; proof.sourceUnmodified = true;
} catch (error) { proof.pass = false; proof.error = error.stack || String(error); process.exitCode = 1; }
finally { if (context) await context.close().catch(() => {}); await new Promise(done => server.close(done)); proof.elapsedMs = Math.round(performance.now() - started); await writeFile(join(folder, 'native-full-restore-proof.json'), JSON.stringify(proof, null, 2)); }
console.log(JSON.stringify({ ...proof, decoded: proof.decoded?.length }));
