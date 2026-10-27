import { seedPolishFixture } from './uiux-fixture.mjs';
export const exactDialogue = '  “Sandali lang—wait!”\nTara na, Ari. 😊  ';
export async function seedDialogueCoverFixture(page) {
  const ids = await seedPolishFixture(page);
  const extra = await page.evaluate(
    async ({ ids, exactDialogue }) => {
      const db = await import('/src/storage/db.ts');
      const snap = await db.getAllSnapshot(),
        draft = snap.drafts.find((d) => d.id === ids.draftId);
      await db.saveSceneDraft({
        ...draft,
        dialogue: {
          speaker: 'Ari',
          line: exactDialogue,
          deliveryNotes: 'Keep the last pause.\nHuwag baguhin ang linya.',
        },
      });
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 135;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e7eefc';
      ctx.fillRect(0, 0, 240, 135);
      ctx.fillStyle = '#315cf6';
      ctx.fillRect(15, 20, 85, 95);
      ctx.fillStyle = '#263650';
      ctx.font = '16px sans-serif';
      ctx.fillText('Synthetic cover', 108, 70);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      const names = [
        'Project result.png',
        'Existing cover.png',
        'Other collection cover.png',
        'Unrelated image.png',
        ...Array.from({ length: 58 }, (_, i) =>
          i === 0
            ? '景色・カフェ・'.repeat(22) + 'original.png'
            : `Synthetic library image ${String(i + 1).padStart(2, '0')}.png`
        ),
      ];
      const media = [];
      for (const name of names)
        media.push(
          await db.saveMediaAsset({
            filename: name,
            mimeType: 'image/png',
            blob,
          })
        );
      await db.updateSavedSceneReviewAndResults({
        sceneId: ids.sceneId,
        resultMediaLinks: [
          {
            mediaId: media[0].id,
            role: 'result',
            order: 0,
            altText: 'Synthetic project result',
          },
        ],
        reviewNotes: '',
        reviewStatus: 'unreviewed',
      });
      const collection = (await db.getAllSnapshot()).collections.find(
        (c) => c.id === ids.collectionId
      );
      await db.updateCollection({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverMediaId: media[1].id,
      });
      const other = await db.createCollection({
        name: 'Synthetic other project',
        coverMediaId: media[2].id,
      });
      return {
        resultId: media[0].id,
        coverId: media[1].id,
        otherCoverId: media[2].id,
        unrelatedId: media[3].id,
        unicodeId: media[4].id,
        unicodeFilename: media[4].filename,
        otherCollectionId: other.id,
      };
    },
    { ids, exactDialogue }
  );
  await page.reload();
  return { ...ids, ...extra };
}

export async function openDialogue(page, ids) {
  await page.goto(`/#/builder/${ids.draftId}`);
  await page
    .locator('summary')
    .filter({ hasText: /^Dialogue/ })
    .click();
  await page
    .getByLabel('Exact Spoken Line (Preserved verbatim)')
    .scrollIntoViewIfNeeded();
}
export async function openCoverPicker(page, ids) {
  await page.goto(`/#/collections/${ids.collectionId}?tab=details`);
  await page
    .getByRole('button', { name: 'Edit Project Details', exact: true })
    .click();
  await page.getByRole('button', { name: 'Choose Cover', exact: true }).click();
}
