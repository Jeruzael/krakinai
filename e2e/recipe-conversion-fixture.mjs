import { readRecipeLibrary } from './recipe-change-set-fixture.mjs';
export const readConversionLibrary=readRecipeLibrary;
export const VALID_B3_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwd3v6HwAE3AJ6zM4FjgAAAABJRU5ErkJggg==';
export const SYNTHETIC_B3_SHOTS=[
 ['Opening',6],['Iris at the mirror',7],['Noah approaches',7],['The aisle',8],['The vows',8],
 ['At the altar',7],['The rings',7],['Off-screen officiant',6],['Evan arrives',7],['09 approved ending frame',7],
];
// Fresh owned profiles only. These fictional illustrations are valid PNGs, not photos or inferred identities.
export async function seedRecipeConversion(page,{tenShots=false,graphic=false}={}){
 await page.goto('/#/');
 const result=await page.evaluate(async({png,shots,graphic})=>{
  if(!['http://localhost:4173','http://127.0.0.1:4173'].includes(location.origin))throw Error('Synthetic B3 fixtures require the isolated QA origin.');
  const db=await import('/src/storage/db.ts'),author=await import('/src/storage/sceneAuthoring.ts'),projects=await import('/src/storage/projects.ts'),fx=await import('/src/__tests__/fixtures/recipeChangeSetFixture.ts'),rules=await import('/src/domain/validation.ts');
  await db.initializeDatabase();const before=await db.getAllSnapshot();if(['assets','variants','scenes','collections','media','drafts'].some(k=>before[k].length))throw Error('Refusing to seed nonempty browser data.');
  const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'image/png'}),image=await createImageBitmap(blob);if(image.width!==1||image.height!==1)throw Error('PNG decode failed');image.close();
  const guide=await db.saveMediaAsset({filename:'synthetic-b3-guide.png',mimeType:'image/png',blob}),original=await db.saveMediaAsset({filename:'synthetic-b3-original.png',mimeType:'image/png',blob});
  const state=fx.recipeState();state.collections[0].project.shots[0].title=shots[0][0];state.collections[0].project.shots[0].plannedDurationSeconds=shots[0][1];const base=state.assets.find(a=>a.category==='characters'),generic=state.assets.find(a=>a.id==='environment');
  const links=m=>[{mediaId:m.id,role:'reference',filename:m.filename,mimeType:m.mimeType,altText:'Synthetic illustrative guide',order:0}];
  state.assets=state.assets.filter(a=>a.category!=='characters');
  for(const name of['Iris','Noah','Evan']){
   const id='b3-'+name.toLowerCase();state.assets.push({...structuredClone(base),id,title:`Synthetic ${name} / Base Identity`,promptText:`SYNTHETIC_${name.toUpperCase()}_IDENTITY. Fictional adult ${name}; keep this approved written identity. `+'Consistent fictional identity. '.repeat(18),notes:'PRIVATE_B3_NOTES',identityRevision:1,mediaLinks:links(guide),coverMediaId:guide.id});
  }
  for(const slot of['wardrobe','lighting','style'])state.assets.push({...structuredClone(generic),id:'b3-'+slot,title:'Synthetic '+slot,category:rules.SLOT_TO_CATEGORY[slot],promptText:'SYNTHETIC_'+slot.toUpperCase()+'. Explicit reusable component.',mediaLinks:links(guide)});
  for(const asset of state.assets)if(asset.id==='environment')asset.mediaLinks=links(guide);
  const connection=await db.openDatabase();await new Promise((resolve,reject)=>{const tx=connection.transaction(['assets','collections'],'readwrite');for(const a of state.assets)tx.objectStore('assets').put(a);for(const c of state.collections)tx.objectStore('collections').put(c);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});
  const sources=[];
  for(const[index,[title,duration]]of shots.entries()){
   let snapshot=await db.getAllSnapshot(),collection=snapshot.collections[0],shot=collection.project.shots[0];
   if(index){collection=await projects.addProjectShot({collectionId:collection.id,title,plannedShotType:'character_scene'});shot=collection.project.shots.at(-1);collection=await projects.updateProjectShot({collectionId:collection.id,shotId:shot.id,patch:{plannedDurationSeconds:duration}});shot=collection.project.shots.at(-1)}
   const code=String(index+1).padStart(2,'0'),text=`  # SYNTHETIC Wedding prequel — ${code}\r\n${title}.\r\nSOURCE_ONLY_${code} <script>window.__b3Injected=true</script> 😊 e\u0301  `;
   let draft=await author.createDirectPromptDraft();draft=await db.saveSceneDraft({...draft,title:'Synthetic Direct '+code+' — '+title,shotType:graphic?'graphic_motion':index?'character_scene':'property_environment',directPrompt:{version:1,text,origin:'manual'},settings:{aspectRatio:'9:16',durationSeconds:duration},directReferences:links(guide),...(graphic?{sourceMediaLinks:links(original)}:{}),...([2,3,4,6,9,10].includes(index+1)?{pendingInputs:[{version:1,id:'b3-pending-'+code,kind:'reference_image',label:'Synthetic pending '+title,notes:'Requirement only; no uploaded image is implied.'}]}:{})});
   const scene=await author.saveAuthoredScene(draft.id,{requestId:'synthetic-b3-source-'+code,expectedInputRevision:draft.inputRevision,target:{collectionId:collection.id,shotId:shot.id,expectedProjectRevision:collection.project.revision},selectAsPreferred:true});sources.push({sceneId:scene.id,draftId:draft.id,shotId:shot.id,code,title,duration});
  }
  const snapshot=await db.getAllSnapshot();return{projectId:snapshot.collections[0].id,projectRevision:snapshot.collections[0].project.revision,sources,oldSceneId:sources[0].sceneId,oldDraftId:sources[0].draftId,shotId:sources[0].shotId,guideId:guide.id,originalId:original.id,decodedMedia:2};
 },{png:VALID_B3_PNG,shots:tenShots?SYNTHETIC_B3_SHOTS:[SYNTHETIC_B3_SHOTS[0]],graphic});
 await page.reload();await page.getByRole('heading',{level:1}).first().waitFor();return result;
}
export async function conversionPackageFor(page,ids,{uncertain=false}={}){
 return page.evaluate(async({ids,uncertain})=>{
  const state=await(await import('/src/storage/db.ts')).getAllSnapshot(),builder=await import('/src/domain/recipeConversionRequest.ts');let result;
  for(const item of ids.sources){const source=state.scenes.find(s=>s.id===item.sceneId),pkg=await builder.createConversionPackage(source,{collectionId:ids.projectId,shotId:item.shotId,expectedProjectRevision:ids.projectRevision},state),op=pkg.operations[0];op.operationId='convert-'+item.code;op.clientRef='recipe-'+item.code;op.title='Synthetic recipe '+item.code+' — '+item.title;op.sceneInstructions='NEW_RECIPE_DIRECTIONS_'+item.code+'. Preserve the approved fictional continuity.';op.assetRefs=(['graphic_motion','existing_footage'].includes(source.shotType)?['camera','style']:['environment','action','camera','lighting','style',...(source.shotType==='character_scene'?['character','wardrobe']:[])]).map(slot=>{const id=slot==='character'?'b3-iris':['wardrobe','lighting','style'].includes(slot)?'b3-'+slot:slot,asset=state.assets.find(a=>a.id===id);return{slot,asset:{id},expectedRevision:asset.revision}});if(source.sourceMediaLinks?.length)op.sourceMedia=source.sourceMediaLinks.map(({mediaId,role,altText,mimeType})=>({mediaId,role,altText,mimeType}));op.conversion=builder.reconcileConversionMappings(op,source,state).conversion;if(uncertain)op.conversion.mappings.find(r=>r.target.kind==='instructions').assessment='uncertain';if(!result)result={...pkg,changeSetId:'synthetic-b3-conversion',operations:[]};result.operations.push(op)}return result;
 },{ids,uncertain});
}
export const mappingUrl=ids=>`/#/recipes/ai?scene=${encodeURIComponent(ids.oldSceneId)}&collection=${encodeURIComponent(ids.projectId)}&shot=${encodeURIComponent(ids.shotId)}`;
export async function reviewConversion(page,id='convert-01',{acknowledge=true}={}){
 const button=page.getByRole('button',{name:'Review '+id,exact:true});if(!await button.isVisible())await page.locator('details.import-group>summary').filter({hasText:/^Scenes/}).click();await button.click();
 if(acknowledge){for(const box of await page.getByRole('dialog').getByRole('checkbox',{name:/^Acknowledge /}).all())await box.check();await page.getByRole('checkbox',{name:'I reviewed conversion mapping ('+id+')',exact:true}).check()}
 await page.getByRole('button',{name:'Close operation',exact:true}).click();
}
