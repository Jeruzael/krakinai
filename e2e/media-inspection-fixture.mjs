import { seedStoryboardFixture } from './storyboard-fixture.mjs';
export async function seedMediaInspection(page) {
  const ids = await seedStoryboardFixture(page);
  const more = await page.evaluate(async (ids) => {
    const db = await import('/src/storage/db.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const c = canvas.getContext('2d');
    c.fillStyle = '#dbeafe';
    c.fillRect(0, 0, 1600, 900);
    c.fillStyle = '#2563eb';
    c.fillRect(120, 120, 700, 600);
    c.fillStyle = '#172554';
    c.font = '48px sans-serif';
    c.fillText('Synthetic 1600 x 900 image', 850, 450);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    const image = await db.saveMediaAsset({
      filename: '景色_Camera_Reference_'.repeat(8) + '.png',
      mimeType: 'image/png',
      blob,
    });
    const link = (id, role = 'sample') => ({
      mediaId: id,
      role,
      order: 0,
      altText: 'Synthetic reference',
    });
    const videoAsset = await db.savePromptAsset({
      category: 'camera',
      title: 'Motion study — カメラ ' + '長'.repeat(60),
      promptText: 'Track left with stable framing.',
      tags: [],
      mediaLinks: [link(ids.mediaId)],
    });
    const imageAsset = await db.savePromptAsset({
      category: 'camera',
      title: 'Image study',
      promptText: 'Wide framing.',
      tags: [],
      mediaLinks: [link(image.id)],
    });
    const variant = await db.saveVariant({
      parentCharacterId: ids.characterId,
      type: 'Camera Angle',
      title: 'Variant motion study',
      promptText: 'A low tracking angle.',
      tags: [],
      mediaLinks: [link(ids.mediaId)],
    });
    const snapshot = await db.getAllSnapshot();
    const draft = await db.createDraftFromSavedScene(ids.sceneIds[0]);
    const handle = await db.openDatabase(),
      tx = handle.transaction(['scenes', 'collections'], 'readwrite');
    const scene = snapshot.scenes.find((s) => s.id === ids.sceneIds[0]);
    tx.objectStore('scenes').put({
      ...scene,
      referencePack: {
        version: 1,
        entries: Array.from({ length: 50 }, (_, i) => ({
          associationId: 'synthetic-association-' + i,
          mediaId: i % 2 ? ids.mediaId : image.id,
          sourceSlot: i % 2 ? 'camera' : 'character',
          sourceId: i % 2 ? videoAsset.id : ids.characterId,
          sourceTitle: 'Association ' + i,
          role: i % 2 ? 'sample' : 'reference',
          altText: 'Synthetic association ' + i,
          filename: i % 2 ? 'synthetic-storyboard-motion.webm' : image.filename,
          purpose: i % 2 ? 'motion' : 'identity',
          order: i,
        })),
      },
    });
    const collection = snapshot.collections.find(
      (c) => c.id === ids.collectionId
    );
    collection.project.shots[0].title =
      '待って—Sandali lang 😊 ' + '長いシーン'.repeat(12);
    tx.objectStore('collections').put(collection);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return {
      draftId: draft.id,
      imageId: image.id,
      imageAssetId: imageAsset.id,
      videoAssetId: videoAsset.id,
      videoTitle: videoAsset.title,
      variantId: variant.id,
      shotTitle: collection.project.shots[0].title,
    };
  }, ids);
  await page.reload();
  return { ...ids, ...more };
}
export async function openInspectionPicker(page, ids) {
  await page.goto('/#/builder/' + ids.draftId);
  await page
    .getByRole('button', { name: 'Change Camera', exact: true })
    .click();
}
