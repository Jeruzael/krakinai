import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const rasters=JSON.parse(await readFile(new URL('../src/__tests__/fixtures/frame-raster-fixtures.json',import.meta.url),'utf8')).files;
async function seed(page){
 await page.goto('/__qa_ready');return page.evaluate(async()=>{
  const nativeBitmap=createImageBitmap,nativeLocks=navigator.locks;
  const {seedKeyframeStorage}=await import('/src/__tests__/fixtures/keyframeStorageFixture.ts');const f=await seedKeyframeStorage();
  if(createImageBitmap!==nativeBitmap||navigator.locks!==nativeLocks)throw Error('Native browser APIs were replaced by unit fixtures.');
  window.syntheticFrameIds={draftId:f.draft.id,inputRevision:f.draft.inputRevision,collectionId:f.projectId,projectRevision:f.state.collections[0].project.revision,shotId:f.shotId,sceneId:f.parent.id,sceneRevision:f.parent.revision,visualDigest:f.parent.imagePromptSnapshots.middle.visualDigest,mediaId:f.parent.imagePromptSnapshots.start.referenceProvenance[0].association.mediaId,sourceReferenceHash:f.parent.imagePromptSnapshots.start.referenceProvenance[0].sha256,otherSceneId:f.otherSceneIds[0]};
  return window.syntheticFrameIds;
 });
}
test('native Chromium decodes original PNG/JPEG/WebP and commits exact hashes and history',async({page})=>{
 const ids=await seed(page);
 const result=await page.evaluate(async({rows,ids})=>{
  const db=await import('/src/storage/db.ts'),images=await import('/src/storage/frameImages.ts');let revision=ids.projectRevision,associationRevision=0;const hashes=[];
  for(const row of rows){
   const bytes=Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0)),file=new File([bytes],row.filename,{type:row.mime}),decoded=await createImageBitmap(file),dimensions=[decoded.width,decoded.height];decoded.close();
   const collection=await images.uploadFrameImage({target:{collectionId:ids.collectionId,expectedProjectRevision:revision,shotId:ids.shotId,sceneId:ids.sceneId,expectedSceneRevision:ids.sceneRevision,frameId:'middle',expectedVisualDigest:ids.visualDigest,expectedAssociationRevision:associationRevision},file});
   const event=collection.project.frameProduction.imageEvents.at(-1),stored=(await db.getAllSnapshot()).media.find(m=>m.id===event.mediaId),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await stored.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');hashes.push({mime:row.mime,dimensions,sha256,eventHash:event.sha256,status:event.reviewStatus});revision=collection.project.revision;associationRevision=event.revision;
  }
  const snapshot=await db.getAllSnapshot();return{hashes,history:snapshot.collections[0].project.frameProduction.imageEvents.length,selected:snapshot.collections[0].project.shots[1].selectedSceneId};
 },{rows:rasters,ids});
 expect(result.hashes).toEqual(rasters.map(row=>({mime:row.mime,dimensions:[row.width,row.height],sha256:row.sha256,eventHash:row.sha256,status:'needs_review'})));expect(result.history).toBe(3);expect(result.selected).toBe(ids.sceneId);
});
test('two tabs retain an unsaved upload, draft image, cleared history and immutable scenes during an unrelated save/delete',async({page,context})=>{
 const ids=await seed(page),other=await context.newPage();await other.goto('/__qa_ready');
 const owned=await page.evaluate(async({ids,row})=>{
  const db=await import('/src/storage/db.ts'),images=await import('/src/storage/frameImages.ts'),file=new File([Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0))],row.filename,{type:row.mime});
  const pending=await db.saveMediaAsset({filename:'synthetic-unsaved-editor.png',mimeType:'image/png',blob:file});window.syntheticUnsavedAttachment=pending;
  const draft=await images.uploadDraftFrameImage({draftId:ids.draftId,expectedInputRevision:ids.inputRevision,frameId:'middle',expectedVisualDigest:ids.visualDigest,file});
  const collection=await images.uploadFrameImage({target:{collectionId:ids.collectionId,expectedProjectRevision:ids.projectRevision,shotId:ids.shotId,sceneId:ids.sceneId,expectedSceneRevision:ids.sceneRevision,frameId:'middle',expectedVisualDigest:ids.visualDigest,expectedAssociationRevision:0},file}),history=collection.project.frameProduction.imageEvents.at(-1);
  await images.applyFrameImageCommand({kind:'clear',target:{collectionId:ids.collectionId,expectedProjectRevision:collection.project.revision,shotId:ids.shotId,sceneId:ids.sceneId,expectedSceneRevision:ids.sceneRevision,frameId:'middle',expectedVisualDigest:ids.visualDigest,expectedAssociationRevision:1}});
  return{pending:pending.id,draft:draft.frameImageAssignments.middle.mediaId,historical:history.mediaId,scene:JSON.stringify((await db.getAllSnapshot()).scenes.find(s=>s.id===ids.sceneId))};
 },{ids,row:rasters[0]});
 await other.evaluate(async ids=>{const db=await import('/src/storage/db.ts');await db.savePromptAsset({title:'Synthetic other tab environment',category:'environments',promptText:'An unrelated fictional room.',tags:['synthetic']});await db.deleteSavedScene(ids.otherSceneId);},ids);
 const after=await page.evaluate(async({ids,owned})=>{const db=await import('/src/storage/db.ts'),snapshot=await db.getAllSnapshot(),reachable=db.collectReferencedMediaIds(snapshot),hashes=[];for(const id of [owned.pending,owned.draft,owned.historical]){const file=snapshot.media.find(m=>m.id===id);hashes.push(file?[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join(''):null);}return{pendingHeld:window.syntheticUnsavedAttachment.id,hashes,reachable:[owned.draft,owned.historical].map(id=>reachable.has(id)),scene:JSON.stringify(snapshot.scenes.find(s=>s.id===ids.sceneId))};},{ids,owned});
 expect(after.pendingHeld).toBe(owned.pending);expect(after.hashes).toEqual([rasters[0].sha256,rasters[0].sha256,rasters[0].sha256]);expect(after.reachable).toEqual([true,true]);expect(after.scene).toBe(owned.scene);
});
test('native cross-tab Web Lock prevents same-ID same-size replacement during canonical preparation and commit',async({page,context})=>{
 const ids=await seed(page),other=await context.newPage();await other.goto('/__qa_ready');
 await page.evaluate(async ids=>{
  const author=await import('/src/storage/sceneAuthoring.ts');window.originalDigest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
  crypto.subtle.digest=async(...args)=>{if(first){first=false;window.hashPending=true;await new Promise(resolve=>{window.releaseHash=resolve;});}return window.originalDigest(...args);};
  window.syntheticSaving=author.saveAuthoredScene(ids.draftId,{requestId:'synthetic-cross-tab-frame-save',expectedInputRevision:ids.inputRevision,frameVideoDecision:'keep_exact_unverified'}).then(scene=>{window.syntheticSaved=scene;}).finally(()=>{crypto.subtle.digest=window.originalDigest;});
 },ids);
 await expect.poll(()=>page.evaluate(()=>!!window.hashPending)).toBe(true);
 await other.evaluate(async ids=>{
  const db=await import('/src/storage/db.ts'),media=(await db.getAllSnapshot()).media.find(m=>m.id===ids.mediaId);
  // Deliberately opaque replacement fixture, not claimed to be a decodable PNG.
  window.syntheticReplacement=db.saveMediaAsset({id:media.id,filename:media.filename,mimeType:media.mimeType,blob:new Blob([new Uint8Array(media.byteSize).fill(42)],{type:media.mimeType}),width:media.width,height:media.height}).then(()=>{window.replacementFinished=true;});
 },ids);
 await expect.poll(()=>other.evaluate(async()=>{const state=await navigator.locks.query();return state.pending.some(lock=>lock.name==='krakinai.library-media-preparation.v1');})).toBe(true);
 expect(await other.evaluate(()=>!!window.replacementFinished)).toBe(false);await page.evaluate(()=>window.releaseHash());
 const saved=await page.evaluate(async()=>{await window.syntheticSaving;return window.syntheticSaved;});await other.evaluate(()=>window.syntheticReplacement);
 expect(saved.imagePromptSnapshots.start.referenceProvenance[0].sha256).toBe(ids.sourceReferenceHash);expect(saved.id).not.toBe(ids.sceneId);
 expect(await page.evaluate(async ids=>{const snapshot=await(await import('/src/storage/db.ts')).getAllSnapshot();return snapshot.collections[0].project.shots[1].selectedSceneId;},ids)).toBe(ids.sceneId);
});
