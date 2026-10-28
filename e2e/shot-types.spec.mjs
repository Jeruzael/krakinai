import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { test, expect } from '@playwright/test';
import { seedShotTypes, MIDORI_INSTRUCTIONS, MIDORI_FILENAME, MIDORI_TITLE } from './shot-types-fixture.mjs';
import { outputBaseline } from './output-workspace-fixture.mjs';

const resultsDir = resolve('qa-results/shot-types');
mkdirSync(resultsDir, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = (name, data) => writeFileSync(resolve(resultsDir, `${name}.json`), JSON.stringify(data, null, 2));
const readDraft = (page, id) => page.evaluate(async id => { const db = await import('/src/storage/db.ts'); return (await db.getAllSnapshot()).drafts.find(draft => draft.id === id); }, id);
const mediaProof = page => page.evaluate(async () => {
  const db = await import('/src/storage/db.ts'), snapshot = await db.getAllSnapshot();
  return Promise.all(snapshot.media.map(async media => ({ id: media.id, filename: media.filename, mimeType: media.mimeType, byteSize: media.byteSize, blobSize: media.blob.size, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await media.blob.arrayBuffer()))).map(value => value.toString(16).padStart(2, '0')).join('') })));
});
async function configureMidori(page, ids) {
  await page.getByLabel('Shot Type', { exact: true }).selectOption('graphic_motion');
  await expect(page.getByLabel('Shot Type', { exact: true })).toHaveValue('graphic_motion');
  await page.getByLabel('Existing source media', { exact: true }).selectOption(ids.sourceId);
  await expect(page.getByRole('button', { name: 'Preview original source', exact: true })).toBeVisible();
  await page.getByLabel('Animation Instructions (Required)', { exact: true }).fill(MIDORI_INSTRUCTIONS);
  if (!await page.getByLabel('Aspect Ratio', { exact: true }).isVisible()) await page.locator('summary').filter({ hasText: /^Shot Settings/ }).click();
  await page.getByLabel('Aspect Ratio', { exact: true }).selectOption('9:16');
  await page.getByLabel('Intended Duration (1–60s)', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect.poll(async () => { const draft = await readDraft(page, ids.draftId); return [draft.shotType, draft.sourceMediaLinks?.[0]?.mediaId, draft.sceneInstructions, draft.settings.aspectRatio, draft.settings.durationSeconds]; }).toEqual(['graphic_motion', ids.sourceId, MIDORI_INSTRUCTIONS, '9:16', 4]);
}
async function expectClearPreflight(page) {
  await page.getByRole('button', { name: /^Preflight ·/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Scene Preflight', exact: true });
  await expect(dialog.getByRole('region', { name: 'Blocking findings', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('No common conflicts detected.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}
async function download(page, trigger, filename) {
  const pending = page.waitForEvent('download'); await trigger(); const result = await pending;
  const path = resolve(resultsDir, filename); await result.saveAs(path);
  return { path, bytes: readFileSync(path), suggestedFilename: result.suggestedFilename() };
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
  expect(result.scrollWidth).toBeLessThanOrEqual(result.viewport + 1); expect(result.bodyWidth).toBeLessThanOrEqual(result.viewport + 1); return result;
}

test.use({ viewport: { width: 1440, height: 900 } });

test('MIDORI graphic shot: exact outputs, local save/copy, ordered storyboard and original bytes in every archive', async ({ page }, info) => {
  test.setTimeout(120_000);
  const ids = await seedShotTypes(page); await configureMidori(page, ids);
  const before = await mediaProof(page); expect(before).toHaveLength(1); expect(before[0].sha256).toBe(ids.originalSha256);
  await expectClearPreflight(page);
  await page.getByRole('button', { name: 'Assemble Prompt', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/output/${ids.draftId}`));
  const baseline = await outputBaseline(page, ids.draftId);
  await page.evaluate(() => { window.__shotCopyPayload = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__shotCopyPayload = text; } } }); });
  const formats = [];
  for (const [workflow, tab, key] of [['canonical', 'Narrative', 'full'], ['canonical', 'Structured', 'structured'], ['canonical', 'Compact', 'compact'], ['generic_structured', null, 'generic_structured'], ['gemini_omni_flash', null, 'gemini_omni_flash'], ['custom', null, 'custom'], ['json', null, 'json'], ['generation_json', null, 'generation_json']]) {
    await page.getByLabel('Target Workflow', { exact: true }).selectOption(workflow);
    if (tab) await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await page.getByRole('button', { name: 'Show Prompt', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Scene Prompt — ${MIDORI_TITLE}`, exact: true });
    const raw = dialog.getByRole('button', { name: 'Raw', exact: true }); if (await raw.isVisible()) await raw.click();
    const text = await dialog.getByRole('region', { name: 'Complete prompt text', exact: true }).textContent();
    expect(text).toBe(baseline.text[key]); expect(text).toContain(MIDORI_INSTRUCTIONS); expect(text).toContain(MIDORI_FILENAME);
    if (workflow === 'json' || workflow === 'generation_json') expect(JSON.parse(text).scene.shotType).toBe('graphic_motion');
    else expect(text).toContain('Graphic / Motion Design');
    expect(text).not.toMatch(/=== CHARACTER IDENTITY ===|=== ENVIRONMENT \/ LOCATION ===/);
    await dialog.getByRole('button', { name: 'Copy Prompt', exact: true }).click();
    expect(await page.evaluate(() => window.__shotCopyPayload)).toBe(text);
    const selected = await download(page, () => dialog.getByRole('button', { name: 'Download Selected', exact: true }).click(), `selected-${key}.${workflow.endsWith('json') || workflow === 'json' ? 'json' : 'txt'}`);
    expect(selected.bytes.toString('utf8')).toBe(text);
    formats.push({ workflow, mode: tab, key, bytes: selected.bytes.length, sha256: sha256(selected.bytes), copyApiPayloadEqualsAssembly: true, selectedDownloadEqualsAssembly: true });
    await page.keyboard.press('Escape');
  }
  expect(await mediaProof(page)).toEqual(before);
  await page.getByLabel('Target Workflow', { exact: true }).selectOption('canonical');
  await page.getByRole('tab', { name: 'Narrative', exact: true }).click();
  await page.getByRole('button', { name: 'Save Scene', exact: true }).click();
  await expect(page).toHaveURL(/#\/output\/scene_/);
  const sceneId = page.url().split('#/output/')[1].split('?')[0];
  const saved = await page.evaluate(async sceneId => { const db = await import('/src/storage/db.ts'); return (await db.getAllSnapshot()).scenes.find(scene => scene.id === sceneId); }, sceneId);
  expect(saved.shotType).toBe('graphic_motion'); expect(saved.slots).toEqual({}); expect(saved.sourceMediaLinks[0]).toMatchObject({ mediaId: ids.sourceId, filename: MIDORI_FILENAME, role: 'reference' });
  expect(saved.outputs).toEqual({ full: baseline.text.full, structured: baseline.text.structured, compact: baseline.text.compact });
  await page.getByRole('tab', { name: 'References', exact: true }).click();
  await page.getByRole('button', { name: 'Manage Reference Pack', exact: true }).click();
  const referenceDialog = page.getByRole('dialog', { name: 'Reference Pack Manager', exact: true });
  const referenceZip = await download(page, () => referenceDialog.getByRole('button', { name: 'Download Reference ZIP', exact: true }).click(), 'midori-reference.zip');
  await referenceDialog.getByRole('button', { name: 'Close', exact: true }).click();
  const referenceFiles = unzipSync(referenceZip.bytes), referenceManifest = JSON.parse(strFromU8(referenceFiles['manifest.json']));
  const sourceReference = referenceManifest.entries.find(entry => entry.sourceSlot === 'source');
  expect(sourceReference.mediaId).toBe(ids.sourceId); expect(sha256(referenceFiles[sourceReference.binaryPath])).toBe(ids.originalSha256);
  // Existing take APIs target the third planned slot while the browser verifies storyboard order and display.
  await page.evaluate(async ({ ids, sceneId }) => { const projects = await import('/src/storage/projects.ts'); await projects.addProjectTake({ collectionId: ids.collectionId, shotId: ids.shotId, sceneId }); await projects.selectProjectTake({ collectionId: ids.collectionId, shotId: ids.shotId, sceneId }); }, { ids, sceneId });
  await page.goto(ids.projectRoute);
  await page.reload();
  await expect(page.locator('.cw-shot-card h2')).toHaveText(['Arrival', 'Amenities', 'Floor Plan']);
  const floorPlan = page.locator('.cw-shot-card').filter({ has: page.getByRole('heading', { name: 'Floor Plan', exact: true }) });
  await expect(floorPlan).toContainText('Graphic / Motion Design'); await expect(floorPlan).toContainText(MIDORI_TITLE);
  await page.getByRole('button', { name: 'Export Project', exact: true }).click();
  const projectDialog = page.getByRole('dialog', { name: 'Export project ZIP', exact: true });
  await projectDialog.getByLabel('Include Generation JSON for selected takes').check();
  const projectZip = await download(page, () => projectDialog.getByRole('button', { name: 'Export project ZIP', exact: true }).click(), 'midori-project.zip');
  await projectDialog.getByRole('button', { name: 'Close', exact: true }).click();
  const projectFiles = unzipSync(projectZip.bytes), manifestPath = Object.keys(projectFiles).find(path => path.endsWith('/manifest.json')), projectManifest = JSON.parse(strFromU8(projectFiles[manifestPath]));
  const sourceAssociation = projectManifest.associations.find(entry => entry.sourceSlot === 'source');
  expect(sourceAssociation.mediaId).toBe(ids.sourceId); expect(sourceAssociation.sha256).toBe(ids.originalSha256); expect(sha256(projectFiles[sourceAssociation.archivePath])).toBe(ids.originalSha256);
  expect(projectManifest.shots.map(shot => shot.id)).toEqual(ids.shotIds); expect(projectManifest.shots[2].selectedTake.shotType).toBe('graphic_motion');
  await page.goto(`/#/output/${sceneId}`);
  await page.getByRole('button', { name: 'Edit a Copy', exact: true }).click();
  await expect(page).toHaveURL(/#\/builder\/draft_/);
  await expect(page.getByLabel('Shot Type', { exact: true })).toHaveValue('graphic_motion'); await expect(page.getByLabel('Existing source media', { exact: true })).toHaveValue(ids.sourceId);
  const copyId = page.url().split('#/builder/')[1].split('?')[0], copy = await readDraft(page, copyId);
  expect(copy.sourceMediaLinks).toEqual(saved.sourceMediaLinks); expect(copy.sourceSceneId).toBe(sceneId);
  const fullBackup = await page.evaluate(async () => { const backup = await import('/src/storage/backup.ts'); return Array.from(await backup.exportFullBackupZip()); });
  writeFileSync(resolve(resultsDir, 'midori-full-backup.zip'), Buffer.from(fullBackup));
  const restored = await page.evaluate(async ({ bytes, sceneId, sourceId }) => { const db = await import('/src/storage/db.ts'), backup = await import('/src/storage/backup.ts'); const zip = Uint8Array.from(bytes); const valid = await backup.validateBackupZip(zip); if (!valid.valid) throw new Error(valid.error); await db.clearAllStoresForTesting(); await backup.restoreFullBackupZip(zip); const snapshot = await db.getAllSnapshot(), media = snapshot.media.find(media => media.id === sourceId); return { scene: snapshot.scenes.find(scene => scene.id === sceneId), mediaCount: snapshot.media.length, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await media.blob.arrayBuffer()))).map(value => value.toString(16).padStart(2, '0')).join('') }; }, { bytes: fullBackup, sceneId, sourceId: ids.sourceId });
  expect(restored.scene).toEqual(saved); expect(restored.sha256).toBe(ids.originalSha256); expect(restored.mediaCount).toBe(1);
  const evidence = { fixture: { draftId: ids.draftId, sourceId: ids.sourceId, collectionId: ids.collectionId, shotId: ids.shotId, originalFilename: MIDORI_FILENAME, originalSha256: ids.originalSha256, originalByteSize: ids.originalByteSize }, sceneId, copyId, blockingFindings: 0, formats, originalBytesUnchangedAfterCopyAndDownload: true, sourceReusedWithoutBinaryDuplication: true, referenceZip: { path: referenceZip.path, manifest: referenceManifest }, projectZip: { path: projectZip.path, manifest: projectManifest }, fullBackup: { path: resolve(resultsDir, 'midori-full-backup.zip'), restoredSha256: restored.sha256, savedSceneImmutable: true } };
  report('midori-integrity', evidence); await info.attach('midori-integrity', { body: JSON.stringify(evidence), contentType: 'application/json' });
});

test('source picker validates upload, replaces/reuses originals, removes reversibly and restores keyboard preview focus', async ({ page }) => {
  const ids = await seedShotTypes(page); await page.getByLabel('Shot Type', { exact: true }).selectOption('graphic_motion');
  const upload = page.getByLabel('Upload original source image', { exact: true });
  await upload.setInputFiles({ name: 'bad-source.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('.source-media-errors')).toContainText(/unsupported|allowed|supported|image|MIME/i); expect(await mediaProof(page)).toHaveLength(1);
  await upload.setInputFiles({ name: 'MIDORI-replacement-original.png', mimeType: 'image/png', buffer: Buffer.from(ids.originalPngBase64, 'base64') });
  await expect(page.locator('.source-media-original strong')).toHaveText('MIDORI-replacement-original.png'); expect(await mediaProof(page)).toHaveLength(2);
  const uploadedId = (await readDraft(page, ids.draftId)).sourceMediaLinks[0].mediaId;
  expect(uploadedId).not.toBe(ids.sourceId);
  await page.getByLabel('Existing source media', { exact: true }).selectOption(ids.sourceId);
  await expect(page.locator('.source-media-original strong')).toHaveText(MIDORI_FILENAME); expect(await mediaProof(page)).toHaveLength(2);
  const preview = page.getByRole('button', { name: 'Preview original source', exact: true });
  await preview.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: `Media: ${MIDORI_FILENAME}`, exact: true }); await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator('img').evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([960, 720]);
  await page.keyboard.press('Escape'); await expect(preview).toBeFocused();
  await page.getByRole('button', { name: 'Remove source media', exact: true }).click();
  await expect(page.locator('.source-media-original')).toHaveCount(0);
  expect(await mediaProof(page)).toHaveLength(2);
  await page.getByRole('button', { name: 'Assemble Prompt', exact: true }).click();
  await expect(page.getByText('Cannot Assemble Prompt Yet:', { exact: true })).toBeVisible(); await expect(page.locator('.banner-error')).toContainText(/source image/i);
  report('source-picker', { validPngDecoded: [960, 720], rejectedMime: 'text/plain', uploadCreatesOriginal: uploadedId, existingSelectionReusesId: ids.sourceId, mediaRetainedAfterRemoval: 2, keyboardPreviewFocusRestored: true });
});

test('voiceover needs no graphic character, on-camera remains blocked, missing or wrong stored sources cannot save', async ({ page }) => {
  const ids = await seedShotTypes(page); await configureMidori(page, ids);
  await page.locator('summary').filter({ hasText: /^Dialogue/ }).click();
  const exactLine = '  Welcome to MIDORI.\nTwo bedrooms, one home. 😊  ';
  await page.getByLabel('Speaker Label', { exact: true }).fill('Narrator'); await page.getByLabel('Exact Spoken Line (Preserved verbatim)', { exact: true }).fill(exactLine); await page.getByLabel('Dialogue Mode', { exact: true }).selectOption('voiceover');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expectClearPreflight(page);
  await page.getByRole('button', { name: 'Assemble Prompt', exact: true }).click(); await expect(page).toHaveURL(/#\/output\//);
  const assembled = await outputBaseline(page, ids.draftId); expect(assembled.text.full).toContain(exactLine); expect(assembled.text.full).toContain('Narrator');
  await page.getByRole('button', { name: 'Back to Builder', exact: true }).click(); await page.locator('summary').filter({ hasText: /^Dialogue/ }).click();
  await page.getByLabel('Dialogue Mode', { exact: true }).selectOption('on_camera'); await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page.getByRole('button', { name: /^Preflight ·/ }).click(); const preflight = page.getByRole('dialog', { name: 'Scene Preflight', exact: true });
  await expect(preflight.getByRole('region', { name: 'Blocking findings', exact: true })).toContainText(/character/i); await page.keyboard.press('Escape');
  const failures = await page.evaluate(async ({ draftId, sourceId }) => { const db = await import('/src/storage/db.ts'); const original = await db.getAllSnapshot(), current = original.drafts.find(draft => draft.id === draftId); await db.saveSceneDraft({ ...current, dialogue: undefined }); const valid = await db.getAllSnapshot(); const results = []; for (const failure of ['missing', 'wrong MIME']) { const data = { ...valid, media: failure === 'missing' ? [] : valid.media.map(media => media.id === sourceId ? { ...media, mimeType: 'video/mp4', blob: new Blob(['synthetic wrong kind'], { type: 'video/mp4' }), byteSize: 20 } : media) }; await db.replaceAllStoresTransactionally(data); try { await db.saveSceneFromDraft(draftId); results.push({ failure, rejected: false }); } catch (error) { results.push({ failure, rejected: true, error: error.message, sceneCount: (await db.getAllSnapshot()).scenes.length }); } } await db.replaceAllStoresTransactionally(valid); return results; }, ids);
  expect(failures.every(result => result.rejected && result.sceneCount === 0)).toBe(true); expect(failures.map(result => result.error).join(' ')).toMatch(/missing.*MIME|missing.*unsupported/i);
  report('source-dialogue-validation', { exactLine, voiceoverAssembledWithoutCharacter: true, onCameraBlockedWithoutCharacter: true, failures });
});

for(const failure of ['deleted original','stale deleted original','unsupported MIME','inconsistent metadata']) {
  test(`assembly rechecks stored source: ${failure} blocks navigation until replacement`,async({page})=>{
    const ids=await seedShotTypes(page);await configureMidori(page,ids);
    const before=await readDraft(page,ids.draftId);
    await page.evaluate(async({sourceId,failure})=>{
      const {openDatabase}=await import('/src/storage/db.ts');const db=await openDatabase();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('media','readwrite'),store=tx.objectStore('media');
        tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
        if(failure.includes('deleted'))store.delete(sourceId);
        else{const request=store.get(sourceId);request.onsuccess=()=>{
          const original=request.result;
          store.put(failure==='unsupported MIME'?{...original,mimeType:'application/octet-stream'}:{...original,byteSize:original.byteSize+1});
        };}
      });
    },{sourceId:ids.sourceId,failure});
    // One case checks visible Preflight first; the rest retain a stale rendered map.
    if(failure==='deleted original'){
      await page.reload();
      await page.getByRole('button',{name:/^Preflight ·/}).click();
      await expect(page.getByRole('dialog',{name:'Scene Preflight'}).getByRole('region',{name:'Blocking findings'})).toContainText(/source.*missing/i);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();
    await expect(page.locator('.banner-error')).toContainText('Source Media');
    await expect(page).toHaveURL(new RegExp(`#/builder/${ids.draftId}$`));
    const after=await readDraft(page,ids.draftId);
    const stable=({updatedAt,...draft})=>draft;
    expect(stable(after)).toEqual(stable(before));
    await page.getByRole('button',{name:/^Preflight ·/}).click();
    await expect(page.getByRole('dialog',{name:'Scene Preflight'}).getByRole('region',{name:'Blocking findings'})).toContainText(/source/i);
    await page.keyboard.press('Escape');
    await page.getByLabel('Replace original source image',{exact:true}).setInputFiles({name:'MIDORI-valid-replacement.png',mimeType:'image/png',buffer:Buffer.from(ids.originalPngBase64,'base64')});
    await expect(page.locator('.source-media-original strong')).toHaveText('MIDORI-valid-replacement.png');
    await expectClearPreflight(page);
    await page.getByRole('button',{name:'Assemble Prompt',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`#/output/${ids.draftId}$`));
    report(`assembly-source-${failure.replaceAll(' ','-')}`,{failure,preflightBlocking:true,navigationBlocked:true,draftPreserved:true,validReplacementAssembled:true});
  });
}

test('review regressions: refreshed saved copies exclude inactive negatives and Output pack edits remain restorable',async({page})=>{
  const ids=await seedShotTypes(page);
  const draftId=await page.evaluate(async ids=>{
    const db=await import('/src/storage/db.ts'),{legacyDraft}=await import('/src/__tests__/fixtures/legacyScene.ts');
    const draft=structuredClone(legacyDraft);draft.id='draft_qa_negative_history';draft.title='Synthetic negative provenance';delete draft.dialogue;
    draft.manualOutputs={};draft.avoidText='Authored no text overlay.';
    for(const slot of Object.values(draft.slots)){slot.mediaLinks=[];delete slot.avoidText;}
    draft.slots.character.avoidText='old character negative';draft.slots.environment.avoidText='old environment negative';
    const link={mediaId:ids.sourceId,filename:ids.originalFilename,mimeType:'image/png',role:'reference',altText:'Original input',order:0};
    draft.slots.character.mediaLinks=[link];draft.referencePack={version:1,entries:[{...link,associationId:'character_original',sourceSlot:'character',sourceId:draft.slots.character.sourceId,sourceTitle:'Character',purpose:'identity'}]};
    const stored=await db.saveSceneDraft(draft),first=await db.saveSceneFromDraft(stored.id),copy=await db.createDraftFromSavedScene(first.id);
    copy.slots.character.avoidText='refreshed character negative';copy.slots.environment.avoidText='refreshed environment negative';
    const refreshed=await db.saveSceneDraft(copy),second=await db.saveSceneFromDraft(refreshed.id),again=await db.createDraftFromSavedScene(second.id);
    const graphic=await db.saveSceneDraft({...again,shotType:'graphic_motion',sourceMediaLinks:[link],sceneInstructions:'Preserve the original graphic. Subtle zoom.'});
    return graphic.id;
  },ids);
  await page.goto(`/#/output/${draftId}`);
  // API-only fixture writes bypass the mounted library context; reload it.
  await page.reload();
  await page.getByRole('tab',{name:'References',exact:true}).click();
  await page.getByRole('button',{name:'Manage Reference Pack',exact:true}).click();
  await page.getByRole('button',{name:'Apply Reference Pack',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Reference Pack Manager',exact:true})).toHaveCount(0);
  const result=await page.evaluate(async id=>{
    const db=await import('/src/storage/db.ts'),backup=await import('/src/storage/backup.ts'),{buildGenerationDocument}=await import('/src/domain/generationDocument.ts');
    const draft=(await db.getAllSnapshot()).drafts.find(d=>d.id===id),zip=await backup.exportFullBackupZip(),validation=await backup.validateBackupZip(zip);
    const before=JSON.stringify(draft.referencePack);await backup.restoreFullBackupZip(zip);
    const restored=(await db.getAllSnapshot()).drafts.find(d=>d.id===id);
    return {orders:restored.referencePack.entries.map(e=>e.order),negatives:buildGenerationDocument(restored).negativeInstructions,backupValid:validation.valid,packPreserved:before===JSON.stringify(restored.referencePack),inactiveCharacterRetained:!!restored.slots.character};
  },draftId);
  expect(result).toEqual({orders:[0,1],negatives:['Authored no text overlay.'],backupValid:true,packPreserved:true,inactiveCharacterRetained:true});
  report('review-regressions',result);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`MIDORI responsive builder and output at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); const ids = await seedShotTypes(page); await configureMidori(page, ids); await expectClearPreflight(page);
    await page.getByLabel('Shot Type', { exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(resultsDir, `after-builder-${viewport.width}.png`), fullPage: true }); const builder = await noOverflow(page);
    await page.getByRole('button', { name: 'Assemble Prompt', exact: true }).click(); await expect(page).toHaveURL(/#\/output\//);
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: resolve(resultsDir, `after-output-${viewport.width}.png`), fullPage: true }); const output = await noOverflow(page);
    await page.getByRole('button', { name: 'Show Prompt', exact: true }).click(); const dialog = page.getByRole('dialog', { name: `Scene Prompt — ${MIDORI_TITLE}`, exact: true }); await expect(dialog).toBeVisible(); await noOverflow(page);
    await page.screenshot({ path: resolve(resultsDir, `after-prompt-${viewport.width}.png`), fullPage: true }); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Show Prompt', exact: true })).toBeFocused();
    report(`responsive-${viewport.width}`, { viewport, builder, output, blockingFindings: 0, promptDialogFocusRestored: true, screenshots: [`after-builder-${viewport.width}.png`, `after-output-${viewport.width}.png`, `after-prompt-${viewport.width}.png`] });
  });
}
