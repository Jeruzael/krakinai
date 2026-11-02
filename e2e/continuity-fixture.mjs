import { seedStoryboardFixture } from './storyboard-fixture.mjs';
export async function seedContinuityFixture(page) {
 const ids=await seedStoryboardFixture(page);
 const extra=await page.evaluate(async ids=>{
  const db=await import('/src/storage/db.ts'),continuity=await import('/src/storage/projectContinuity.ts');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='#bfd1f1';ctx.fillRect(0,0,320,180);ctx.fillStyle='#142341';ctx.font='20px sans-serif';ctx.fillText('Synthetic continuity image',18,92);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  const image=await db.saveMediaAsset({filename:'synthetic-continuity.png',mimeType:'image/png',blob});
  let collection=await continuity.updateProjectFrames({collectionId:ids.collectionId,shotId:ids.shotIds[0],lastFrameMediaId:image.id});
  collection=await continuity.updateProjectFrames({collectionId:ids.collectionId,shotId:ids.shotIds[1],firstFrameMediaId:image.id});
  collection=await continuity.upsertProjectTransition({collectionId:ids.collectionId,expectedRevision:collection.project.revision,transition:{fromShotId:ids.shotIds[0],toShotId:ids.shotIds[1],type:'match_cut',description:'Synthetic exact adjacent pair',notes:'Preserve this pair and image bytes.'}});
  return {imageId:image.id,projectRevision:collection.project.revision};
 },ids);
 await page.reload();return {...ids,...extra};
}
