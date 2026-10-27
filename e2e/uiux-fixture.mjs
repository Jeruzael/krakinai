// Synthetic test data only; called in Playwright's fresh, disposable contexts.
export async function seedPolishFixture(page) {
  await page.goto('/#/');
  const ids = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts'),
      p = await import('/src/storage/projects.ts'),
      assembler = await import('/src/domain/promptAssembler.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#295cf4';
    ctx.fillRect(40, 40, 220, 280);
    ctx.fillStyle = '#17244a';
    ctx.font = '26px sans-serif';
    ctx.fillText('Synthetic reference', 280, 170);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    const media = await db.saveMediaAsset({
      filename: 'synthetic-reference-' + 'long-filename-'.repeat(12) + '.png',
      mimeType: 'image/png',
      blob,
    });
    const links = [
      {
        mediaId: media.id,
        role: 'reference',
        altText: 'Synthetic blue reference guide',
        order: 0,
        filename: media.filename,
        mimeType: 'image/png',
      },
    ];
    let character = await db.savePromptAsset({
      title: 'Ari / Base Identity',
      category: 'characters',
      promptText:
        'Ari is a fictional adult with brown eyes, short black hair and a calm expression. Preserve this complete authoritative identity.',
      tags: ['portrait', 'Portrait', 'cinematic'],
      mediaLinks: links,
    });
    character = await db.approveIdentityAnchor(
      character.id,
      'Ari, fictional adult with brown eyes and short black hair.',
      character.identityRevision
    );
    const environment = await db.savePromptAsset({
      title: 'Synthetic Café',
      category: 'environments',
      promptText: 'A quiet café with oak tables and morning light.',
      tags: ['cinematic', 'café'],
      mediaLinks: links,
    });
    const action = await db.savePromptAsset({
      title: 'Notebook action',
      category: 'actions',
      promptText: 'Ari closes a notebook and looks toward the window.',
      tags: ['cinematic', 'quiet'],
    });
    const style = await db.savePromptAsset({
      title: 'Synthetic illustrative style',
      category: 'styles',
      promptText: 'Illustrative animation with soft painted textures.',
      tags: ['soft', 'illustrative'],
      mediaLinks: links,
    });
    for (let i = 0; i < 14; i++)
      await db.savePromptAsset({
        title: `Synthetic preset ${i + 1}`,
        category: 'lighting',
        promptText: 'Soft neutral key light.',
        tags: ['cinematic', `tag-${String(i + 1).padStart(2, '0')}`],
      });
    const variant = await db.saveVariant({
      parentCharacterId: character.id,
      type: 'Outfit',
      title: 'Synthetic jacket',
      promptText: 'Wears a navy jacket.',
      tags: ['outfit'],
      mediaLinks: links,
    });
    const slots = {
      character: assembler.createSnapshotFromAsset(character),
      environment: assembler.createSnapshotFromAsset(environment),
      action: assembler.createSnapshotFromAsset(action),
      style: assembler.createSnapshotFromAsset(style),
    };
    const draft = await db.saveSceneDraft({
      title: 'Synthetic polish shot',
      slots,
      extraRequiredSlots: [],
      sceneInstructions: 'Hold the final frame.',
      settings: { aspectRatio: '16:9', durationSeconds: 8 },
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
    });
    const scene = await db.saveSceneFromDraft(draft.id),
      other = await db.saveSceneFromDraft(draft.id, {
        duplicateDecision: 'take',
        duplicateOfSceneId: scene.id,
      });
    let collection = await db.createCollection({
      name: 'Synthetic production',
    });
    collection = await p.addProjectShot({
      collectionId: collection.id,
      title: 'Opening',
      sceneId: scene.id,
    });
    const shot = collection.project.shots[0];
    collection = await p.addProjectTake({
      collectionId: collection.id,
      shotId: shot.id,
      sceneId: other.id,
    });
    return {
      characterId: character.id,
      variantId: variant.id,
      draftId: draft.id,
      sceneId: scene.id,
      otherSceneId: other.id,
      collectionId: collection.id,
      shotId: shot.id,
      mediaId: media.id,
      master: character.promptText,
    };
  });
  await page.reload();
  return ids;
}
