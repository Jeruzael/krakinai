// Synthetic records and generated media; only run in Playwright's isolated context.
export async function seedStoryboardFixture(page) {
  await page.goto('/#/');
  const ids = await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    const projects = await import('/src/storage/projects.ts');
    const { createSnapshotFromAsset } = await import(
      '/src/domain/promptAssembler.ts'
    );
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(0);
    const mimeType = 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    const done = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = resolve;
      recorder.onerror = () => reject(Error('Synthetic video encoding failed'));
    });
    recorder.start();
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `hsl(${210 + i * 2},55%,${36 + i}%)`;
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#fff';
      ctx.font = '22px sans-serif';
      ctx.fillText('Synthetic motion ' + i, 30 + i, 90);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    recorder.stop();
    await done;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob),
      probe = document.createElement('video');
    const decoded = await new Promise((resolve, reject) => {
      probe.onloadeddata = () =>
        resolve({ width: probe.videoWidth, height: probe.videoHeight });
      probe.onerror = () => reject(Error('Synthetic video did not decode'));
      probe.src = url;
    });
    probe.removeAttribute('src');
    probe.load();
    URL.revokeObjectURL(url);
    const media = await db.saveMediaAsset({
      filename: 'synthetic-storyboard-motion.webm',
      mimeType,
      blob,
    });
    const character = await db.savePromptAsset({
      title: 'Aya Santos / Base Identity',
      category: 'characters',
      promptText:
        'Photorealistic adult Aya Santos. Brown eyes and black hair. Keep this authoritative identity unchanged.',
      tags: [],
      mediaLinks: [],
    });
    const wardrobeText =
      'Navy tailored jacket, cream cotton blouse, straight trousers and low boots. Preserve the fabric, seam placement and outfit silhouette.\n'.repeat(
        12
      );
    const wardrobe = await db.savePromptAsset({
      title: 'Navy travel wardrobe',
      category: 'wardrobe',
      promptText: wardrobeText,
      tags: [],
      mediaLinks: [],
    });
    const camera = await db.savePromptAsset({
      title: 'Rear camera',
      category: 'camera',
      promptText:
        "Position the camera about 135 degrees from the subject's forward axis, toward the left-rear side.",
      tags: [],
      mediaLinks: [],
    });
    const action = await db.savePromptAsset({
      title: 'Lens contact',
      category: 'actions',
      promptText:
        'Aya maintains direct eye contact with the camera while speaking.\n' +
        'Exact source detail, with punctuation “unchanged”. '.repeat(30) +
        '\n' +
        'UnbrokenEvidence'.repeat(35),
      tags: [],
      mediaLinks: [],
    });
    const environment = await db.savePromptAsset({
      title: 'Station',
      category: 'environments',
      promptText: 'A quiet station platform at dusk.',
      tags: [],
      mediaLinks: [],
    });
    const style = await db.savePromptAsset({
      title: 'Feature animation',
      category: 'styles',
      promptText: 'High-craft stylized 3D feature animation',
      tags: [],
      mediaLinks: [],
    });
    const slots = Object.fromEntries(
      [
        ['character', character],
        ['wardrobe', wardrobe],
        ['action', action],
        ['environment', environment],
        ['camera', camera],
        ['style', style],
      ].map(([key, asset]) => [key, createSnapshotFromAsset(asset)])
    );
    let collection = await db.createCollection({
      name: 'Synthetic motion storyboard',
      description:
        'Eleven video-backed shots for interaction and layout verification.',
    });
    const sceneIds = [],
      shotIds = [];
    for (let i = 0; i < 11; i++) {
      const draft = await db.saveSceneDraft({
        title: `Synthetic take ${i + 1}`,
        slots,
        extraRequiredSlots: [],
        sceneInstructions:
          'Hold the final frame.\n' +
          'Long preserved source evidence. '.repeat(25),
        dialogue: {
          speaker: 'Joy',
          line: 'The train is arriving.',
          mode: 'on_camera',
        },
        settings: { aspectRatio: '16:9', durationSeconds: 8 },
        manualOutputs: {},
        resultMediaLinks: [
          {
            mediaId: media.id,
            role: 'result',
            order: 0,
            altText: 'Synthetic moving color frames',
          },
        ],
        reviewNotes: '',
        reviewStatus: 'unreviewed',
      });
      const scene = await db.saveSceneFromDraft(
        draft.id,
        i ? { duplicateDecision: 'take', duplicateOfSceneId: sceneIds[0] } : {}
      );
      sceneIds.push(scene.id);
      collection = await projects.addProjectShot({
        collectionId: collection.id,
        title: i === 0 ? 'Arrival at the station' : `Shot ${i + 1}`,
        sceneId: scene.id,
      });
      shotIds.push(collection.project.shots.at(-1).id);
    }
    // Current cover writes allow images only. Exercise rendering of an existing
    // video cover without changing that persistence rule or touching user data.
    const handle = await db.openDatabase(),
      tx = handle.transaction('collections', 'readwrite');
    tx.objectStore('collections').put({
      ...collection,
      coverMediaId: media.id,
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    return {
      collectionId: collection.id,
      sceneIds,
      shotIds,
      mediaId: media.id,
      characterId: character.id,
      wardrobeText,
      decoded,
      videoBytes: blob.size,
    };
  });
  await page.reload();
  return ids;
}

export async function storedProof(page) {
  return page.evaluate(async () => {
    const { getAllSnapshot } = await import('/src/storage/db.ts');
    const s = await getAllSnapshot();
    const hash = async (blob) =>
      [
        ...new Uint8Array(
          await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
        ),
      ]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    return {
      ...s,
      media: await Promise.all(
        s.media.map(async ({ blob, posterBlob, ...rest }) => ({
          ...rest,
          sha256: await hash(blob),
          ...(posterBlob ? { posterSha256: await hash(posterBlob) } : {}),
        }))
      ),
    };
  });
}
