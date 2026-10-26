import { beforeEach, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { clearAllStoresForTesting, getAllSnapshot, initializeDatabase, reopenDatabaseAfterPageReloadForTesting, saveMediaAsset } from '../storage/db';
import { updateMediaNames } from '../storage/mediaMetadata';
import { exportFullBackupZip, restoreFullBackupZip, validateBackupZip } from '../storage/backup';

beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });

async function changedBackup(change: (manifest: any) => void) {
  const files = unzipSync(await exportFullBackupZip());
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  change(manifest);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files);
}

it('persists names through reload and full backup restore without changing source identity or bytes', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const original = await saveMediaAsset({ filename: 'original.png', mimeType: 'image/png', blob: new Blob([bytes], { type: 'image/png' }) });
  const renamed = await updateMediaNames({ mediaId: original.id, displayName: 'Aya portrait', exportFilename: 'aya.png' });
  expect(renamed).toMatchObject({ id: original.id, filename: original.filename, safeFilename: original.safeFilename, mimeType: original.mimeType, displayName: 'Aya portrait', exportFilename: 'aya.png' });
  expect(new Uint8Array(await renamed.blob.arrayBuffer())).toEqual(bytes);
  const zip = await exportFullBackupZip();
  expect((await validateBackupZip(zip)).valid).toBe(true);
  await clearAllStoresForTesting();
  await restoreFullBackupZip(zip);
  const restored = (await getAllSnapshot()).media.find(item => item.id === original.id)!;
  expect(restored).toMatchObject({ id: original.id, filename: original.filename, safeFilename: original.safeFilename, mimeType: original.mimeType, displayName: 'Aya portrait', exportFilename: 'aya.png' });
  expect(new Uint8Array(await restored.blob.arrayBuffer())).toEqual(bytes);
  await reopenDatabaseAfterPageReloadForTesting();
  const cleared = await updateMediaNames({ mediaId: original.id, exportFilename: '' });
  expect(cleared.exportFilename).toBeUndefined();
});

it('rejects invalid name metadata in media, nested associations and scene lineage before restore', async () => {
  const media = await saveMediaAsset({ filename: 'original.png', mimeType: 'image/png', blob: new Blob(['bytes'], { type: 'image/png' }) });
  const link = { mediaId: media.id, role: 'reference', altText: 'Accessible description', order: 0, mimeType: 'image/jpeg' };
  const cases: Array<(manifest: any) => void> = [
    manifest => { manifest.media[0].exportFilename = 'CON.png'; },
    manifest => { manifest.assets = [{ id: 'asset_a', title: 'A', category: 'characters', promptText: 'A', mediaLinks: [{ ...link, exportFilename: 'wrong.jpg' }] }]; },
    manifest => { manifest.templates = [{ id: 'template_a', slots: { character: { mediaLinks: [{ ...link, displayName: '' }] } } }]; },
    manifest => { manifest.scenes = [{ id: 'scene_a', sourceDraftInputRevision: -1 }]; },
  ];
  for (const change of cases) {
    const before = await getAllSnapshot();
    const zip = await changedBackup(change);
    expect((await validateBackupZip(zip)).valid).toBe(false);
    await expect(restoreFullBackupZip(zip)).rejects.toThrow();
    expect(await getAllSnapshot()).toEqual(before);
  }
});
