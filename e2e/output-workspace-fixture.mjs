// Deterministic synthetic records only, in Playwright's isolated browser context.
export async function seedOutputWorkspace(page) {
  await page.goto('/#/');
  const ids = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts'),
      { legacyDraft, legacyScene } = await import(
        '/src/__tests__/fixtures/legacyScene.ts'
      ),
      { assembleScenePrompt } = await import('/src/domain/promptAssembler.ts');
    const draft = structuredClone(legacyDraft),
      now = '2026-10-28T00:00:00.000Z';
    draft.id = 'draft_output_workspace_fixture';
    draft.title = 'Synthetic Scene — Café';
    draft.createdAt = now;
    draft.updatedAt = now;
    draft.sceneInstructions =
      '  Hold the final frame.\nHuwag baguhin ang linya. 雨 😊\n\tKeep this exact spacing.  ';
    draft.dialogue = {
      speaker: 'Ari',
      line: '  “Sandali lang—wait!”\nTara na, Ari. 😊  ',
      mode: 'on_camera',
      language: 'Tagalog / English',
      deliveryNotes: 'Keep the last pause.',
      performanceDirection: {
        version: 2,
        emotion: { primary: 'joyful', intensity: 'gentle' },
      },
    };
    // Use supported metadata without inferring traits from the generated image.
    delete draft.dialogue.performanceDirection;
    draft.manualOutputs = {};
    draft.resultMediaLinks = [];
    draft.reviewNotes = '';
    draft.reviewStatus = 'unreviewed';
    const categories = {
      character: 'characters',
      wardrobe: 'wardrobe',
      environment: 'environments',
      action: 'actions',
      camera: 'camera',
      lighting: 'lighting',
      style: 'styles',
    };
    const assets = Object.entries(draft.slots).map(([slot, snapshot]) => {
      snapshot.mediaLinks = [];
      snapshot.sourceId = 'asset_output_' + slot;
      snapshot.sourceTitle =
        slot === 'character' ? 'Ari / Base Identity' : snapshot.sourceTitle;
      if (slot === 'character') {
        snapshot.promptText =
          'Ari is a fictional adult with brown eyes and short black hair. ' +
          'Preserve the authoritative identity and every recorded detail. '.repeat(
            18
          );
        snapshot.compactText = snapshot.promptText;
        snapshot.identityRevision = 1;
        snapshot.sourceRevision = 1;
        snapshot.identityAnchor = {
          text: 'Ari, fictional adult with brown eyes and short black hair.',
          approvedText:
            'Ari, fictional adult with brown eyes and short black hair.',
          approvedMasterIdentityRevision: 1,
          approvedAt: now,
        };
      }
      return {
        id: snapshot.sourceId,
        title: snapshot.sourceTitle,
        category: categories[slot],
        promptText: snapshot.promptText,
        compactText: snapshot.compactText,
        tags: [],
        mediaLinks: [],
        favorite: false,
        isStarter: false,
        reviewStatus: 'unreviewed',
        revision: 1,
        createdAt: now,
        updatedAt: now,
        ...(slot === 'character'
          ? {
              identityRevision: 1,
              identityAnchor: structuredClone(snapshot.identityAnchor),
            }
          : {}),
      };
    });
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e6eefb';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#315cf6';
    ctx.fillRect(70, 70, 190, 340);
    ctx.fillStyle = '#152b53';
    ctx.font = '26px sans-serif';
    ctx.fillText('Synthetic scene', 290, 210);
    ctx.font = '18px sans-serif';
    ctx.fillText('Reference media fixture', 290, 250);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    const media = {
      id: 'media_output_reference',
      filename: 'synthetic-scene-reference.png',
      safeFilename: 'synthetic-scene-reference.png',
      mimeType: 'image/png',
      byteSize: blob.size,
      blob,
      width: 640,
      height: 480,
      createdAt: now,
    };
    const link = {
      mediaId: media.id,
      role: 'reference',
      altText: 'Synthetic blue reference guide',
      filename: media.filename,
      mimeType: media.mimeType,
      order: 0,
    };
    draft.slots.character.mediaLinks = [link];
    draft.slots.environment.mediaLinks = [
      { ...link, role: 'sample', altText: 'Synthetic environment sample' },
    ];
    const assembled = assembleScenePrompt(draft);
    const scene = {
      ...structuredClone(legacyScene),
      id: 'scene_output_workspace_fixture',
      title: draft.title,
      slots: structuredClone(draft.slots),
      settings: structuredClone(draft.settings),
      dialogue: structuredClone(draft.dialogue),
      sceneInstructions: draft.sceneInstructions,
      outputs: assembled.outputs,
      avoidText: assembled.avoidText,
      references: assembled.references,
      manualOutputs: {},
      resultMediaLinks: [],
      reviewNotes: '',
      reviewStatus: 'unreviewed',
      createdAt: now,
      updatedAt: now,
    };
    await db.replaceAllStoresTransactionally({
      assets,
      variants: [],
      media: [media],
      drafts: [draft],
      scenes: [scene],
      collections: [],
      templates: [],
      preferences: {
        id: 'app_preferences',
        schemaVersion: 1,
        starterLoaded: true,
        updatedAt: now,
      },
    });
    return { draftId: draft.id, sceneId: scene.id };
  });
  await page.reload();
  return ids;
}

export async function outputBaseline(page, id) {
  return page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      a = await import('/src/domain/promptAssembler.ts'),
      s = await import('/src/domain/sceneDocument.ts'),
      g = await import('/src/domain/generationDocument.ts'),
      e = await import('/src/domain/exportPresets.ts'),
      i = await import('/src/domain/identityAnchors.ts');
    const snapshot = await db.getAllSnapshot(),
      saved = id.startsWith('scene_'),
      source = (saved ? snapshot.scenes : snapshot.drafts).find(
        (x) => x.id === id
      ),
      master = snapshot.assets.find(
        (x) => x.id === source.slots.character?.sourceId
      ),
      options = {
        identity: i.resolveGenerationIdentity(source, master, saved).identity,
      },
      assembled = saved ? null : a.assembleScenePrompt(source),
      outputs = saved ? source.outputs : assembled.outputs;
    const text = {
      full: outputs.full,
      structured: outputs.structured,
      compact: outputs.compact,
      json: s.serializeSceneJson(source),
      generation_json: g.serializeGenerationJson(source, options),
      generic_structured: e.formatGenerationText(
        source,
        'generic_structured',
        options
      ),
      gemini_omni_flash: e.formatGenerationText(
        source,
        'gemini_omni_flash',
        options
      ),
      custom: e.formatGenerationText(source, 'custom', options),
    };
    const specifications = Object.fromEntries(
      ['full', 'structured', 'compact'].map((mode) => [
        mode,
        a.formatSceneExportTxt({
          title: source.title,
          mode,
          promptText: text[mode],
          settings: source.settings,
          avoidText: saved ? source.avoidText : assembled.avoidText,
          references: saved ? source.references : assembled.references,
        }),
      ])
    );
    return { text, specifications };
  }, id);
}
