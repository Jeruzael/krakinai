// Synthetic but decodable/playable media and a real KRAKINAI record graph.
// Called only in a fresh certification profile, never an existing user profile.
export async function seedRecoveryFixture({ db, assembler, projects }) {
  const before = await db.getAllSnapshot();
  if (before.assets.length || before.media.length || before.scenes.length || before.collections.length) throw new Error('Certification requires an empty fresh library.');
  let snap = await db.loadStarterLibrary();
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const context = canvas.getContext('2d'); const pixels = context.createImageData(canvas.width, canvas.height);
  let state = 0x7281cafe;
  for (let i = 0; i < pixels.data.length; i += 4) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    pixels.data[i] = state & 255; pixels.data[i + 1] = (state >>> 8) & 255; pixels.data[i + 2] = (state >>> 16) & 255; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('PNG encoder unavailable.');
  const photo = await db.saveMediaAsset({ id: 'cert_decodable_png', filename: 'synthetic-noise.png', mimeType: 'image/png', blob: png, width: 1024, height: 768 });
  const animation = document.createElement('canvas'); animation.width = 320; animation.height = 180;
  const drawing = animation.getContext('2d');
  if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) throw new Error('VP8 MediaRecorder unavailable.');
  const stream = animation.captureStream(10); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
  const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  drawing.fillStyle = '#295cf4'; drawing.fillRect(0, 0, 320, 180); recorder.start();
  for (let frame = 0; frame < 12; frame++) {
    drawing.fillStyle = frame % 2 ? '#d8e6ff' : '#295cf4'; drawing.fillRect(0, 0, 320, 180);
    drawing.fillStyle = '#152747'; drawing.fillRect(frame * 20, 60, 30, 30);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
  const webm = new Blob(chunks, { type: 'video/webm' });
  const result = await db.saveMediaAsset({ id: 'cert_playable_webm', filename: 'synthetic-animation.webm', mimeType: 'video/webm', blob: webm, width: 320, height: 180, durationSeconds: 1.2 });
  const baseVariant = snap.variants.find(item => item.targetSlot === 'wardrobe');
  if (!baseVariant) throw new Error('Starter wardrobe variant missing.');
  const character = snap.assets.find(item => item.id === baseVariant.parentCharacterId);
  const link = { mediaId: photo.id, role: 'reference', altText: 'Synthetic decodable PNG for recovery certification.', order: 0 };
  const master = await db.savePromptAsset({ ...character, mediaLinks: [...character.mediaLinks, link], coverMediaId: character.coverMediaId });
  const outfit = await db.saveVariant({ ...baseVariant, mediaLinks: [...baseVariant.mediaLinks, link] });
  const slots = {};
  for (const asset of snap.assets) { const snapshot = assembler.createSnapshotFromAsset(asset); if (!slots[snapshot.slot]) slots[snapshot.slot] = snapshot; }
  slots.character = assembler.createSnapshotFromAsset(master); slots.wardrobe = assembler.createSnapshotFromVariant(outfit);
  const scenes = [];
  for (let i = 0; i < 3; i++) {
    const draft = await db.saveSceneDraft({ title: `Synthetic certification scene ${i + 1}`, slots, extraRequiredSlots: [], sceneInstructions: `Certification shot ${i + 1}: preserve all words and references.`, dialogue: { speaker: master.title, line: `Synthetic line ${i + 1}.`, mode: 'voiceover' }, settings: { aspectRatio: '16:9', durationSeconds: 8 }, manualOutputs: {}, resultMediaLinks: [], reviewNotes: 'Synthetic fixture only.', reviewStatus: 'unreviewed' });
    let scene = await db.saveSceneFromDraft(draft.id);
    if (i === 0) scene = await db.updateSavedSceneReviewAndResults({ sceneId: scene.id, resultMediaLinks: [{ mediaId: result.id, role: 'result', altText: 'Playable synthetic VP8 WebM.', order: 0 }], reviewNotes: 'Keep exact review notes.', reviewStatus: 'user-approved' });
    scenes.push(scene);
  }
  const collection = await db.createCollection({ name: 'Synthetic certification project', description: 'Scenes, variants and reference associations must roundtrip.' });
  for (const scene of scenes) await projects.addProjectShot({ collectionId: collection.id, sceneId: scene.id, title: scene.title });
  await db.addMemberToCollection({ collectionId: collection.id, memberType: 'variant', memberId: outfit.id });
  snap = await db.getAllSnapshot();
  return { counts: counts(snap), representative: [{ id: photo.id, mime: 'image/png', bytes: png.size, kind: 'decodable PNG, deterministic noise' }, { id: result.id, mime: 'video/webm', bytes: webm.size, kind: 'playable synthetic VP8 WebM, canvas only, no microphone/screen capture' }] };
}

export function counts(snapshot) {
  return Object.fromEntries(['assets', 'variants', 'media', 'drafts', 'scenes', 'collections', 'templates'].map(name => [name, snapshot[name].length]));
}

export async function describeRecoverySnapshot(db, archive) {
  const snapshot = await db.getAllSnapshot();
  const media = [];
  for (const item of snapshot.media) media.push({ id: item.id, mimeType: item.mimeType, blobType: item.blob.type, bytes: item.blob.size, sha256: await archive.hashBackupBlob(item.blob), posterSha256: item.posterBlob ? await archive.hashBackupBlob(item.posterBlob) : null });
  const metadata = { ...snapshot, media: snapshot.media.map(({ blob, posterBlob, ...record }) => ({ ...record, blobBytes: blob.size, blobType: blob.type, posterBytes: posterBlob?.size ?? 0, posterType: posterBlob?.type ?? null })) };
  // Version-1 backups are JSON. Missing optional keys and keys with undefined
  // are equivalent there; defined values and every output character remain exact.
  return { counts: counts(snapshot), metadataSha256: await archive.hashBackupBlob(new Blob([JSON.stringify(metadata)])), media, mediaBytes: media.reduce((total, item) => total + item.bytes, 0), sceneOutputs: JSON.parse(JSON.stringify(snapshot.scenes.map(scene => ({ id: scene.id, outputs: scene.outputs, slots: scene.slots, references: scene.references, resultMediaLinks: scene.resultMediaLinks })))) };
}

export async function decodeRecoveryMedia(db) {
  const snapshot = await db.getAllSnapshot(); const checks = [];
  for (const item of snapshot.media) {
    const url = URL.createObjectURL(item.blob);
    try {
      if (item.mimeType.startsWith('image/')) {
        const image = new Image(); image.src = url; await image.decode();
        if (!image.naturalWidth) throw new Error('Image decoded without dimensions.');
        checks.push({ id: item.id, decoded: true, width: image.naturalWidth, height: image.naturalHeight });
      } else {
        const video = document.createElement('video'); video.muted = true; video.src = url;
        await Promise.race([new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Video decoder failed.')); }), new Promise((_, reject) => setTimeout(() => reject(new Error('Video load timeout.')), 5000))]);
        await video.play();
        await Promise.race([new Promise(resolve => { video.ontimeupdate = () => { if (video.currentTime > 0) resolve(); }; }), new Promise((_, reject) => setTimeout(() => reject(new Error('Video playback timeout.')), 5000))]);
        checks.push({ id: item.id, playable: true, width: video.videoWidth, height: video.videoHeight, currentTime: video.currentTime });
        video.pause(); video.removeAttribute('src'); video.load();
      }
    } finally { URL.revokeObjectURL(url); }
  }
  return checks;
}
