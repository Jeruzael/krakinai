import{seedRecipeConversion,conversionPackageFor}from'./recipe-conversion-fixture.mjs';
export const EXACT_B3_VOW='  I choose you.\r\nToday, and every day. 😊  ';
export async function seedNativeRecipeConversion(page){
 const ids=await seedRecipeConversion(page,{tenShots:true});
 const extra=await page.evaluate(async ids=>{
  const db=await import('/src/storage/db.ts'),fx=await import('/src/__tests__/fixtures/ensemblePlanningFixture.ts'),state=await db.getAllSnapshot();
  if(state.scenes.length!==10||state.collections.length!==1||state.assets.length!==9)throw Error('Unexpected synthetic B3 library; refusing enrichment.');
  const guide=state.media.find(m=>m.id===ids.guideId),characters=[];
  for(const[name,color]of[['Iris','#6d28d9'],['Noah','#0369a1'],['Evan','#047857']]){
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=560;const c=canvas.getContext('2d');c.fillStyle='#eff6ff';c.fillRect(0,0,400,560);c.fillStyle=color;c.beginPath();c.arc(200,175,65,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(200,380,120,150,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText(name.toUpperCase(),200,460);c.fillStyle='#0f172a';c.font='16px sans-serif';c.fillText('SYNTHETIC FICTIONAL ILLUSTRATION',200,535);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),decoded=await createImageBitmap(blob);if(decoded.width!==400||decoded.height!==560)throw Error('Invalid synthetic portrait');decoded.close();const image=await db.saveMediaAsset({filename:'synthetic-b3-'+name.toLowerCase()+'.png',mimeType:'image/png',blob});
   const asset=state.assets.find(a=>a.id==='b3-'+name.toLowerCase());asset.title=name+' / Base Identity';asset.mediaLinks=[{mediaId:image.id,role:'reference',altText:'Fictional '+name+' illustration; not a real person',filename:image.filename,mimeType:image.mimeType,order:0}];asset.coverMediaId=image.id;
   if(name==='Noah')asset.identityAnchor={text:'Approved synthetic Noah continuity.',approvedText:'Approved synthetic Noah continuity.',approvedAt:'2026-10-30T00:00:00.000Z',approvedMasterIdentityRevision:1};characters.push(asset);
  }
  const variants=fx.ensembleState().variants.map((v,i)=>{const name=['iris','noah','evan'][i];return{...v,id:'b3-'+name+'-outfit',parentCharacterId:'b3-'+name,title:'Synthetic '+name+' formal outfit',promptText:'SYNTHETIC_'+name.toUpperCase()+'_FORMAL_OUTFIT. '+v.promptText,mediaLinks:[{mediaId:guide.id,role:'sample',altText:'Illustrative wardrobe guide',filename:guide.filename,mimeType:guide.mimeType,order:0}]}});
  const project=state.collections[0];project.name='Synthetic Wedding Prequel - B3';const foreign=structuredClone(project);foreign.id='b3-excluded-project';foreign.name='PRIVATE_B3_EXCLUDED_PROJECT';foreign.members=[];foreign.project.shots=[];foreign.project.revision=1;
  const env=state.assets.find(a=>a.id==='environment');env.title='Synthetic wedding chapel';env.promptText='SYNTHETIC_CHAPEL. A fictional small chapel with a central aisle, flowers and a simple altar.';
  const hidden={...env,id:'b3-excluded-asset',title:'PRIVATE_B3_EXCLUDED_ASSET',promptText:'PRIVATE_B3_NOTES'};
  const connection=await db.openDatabase();await new Promise((resolve,reject)=>{const tx=connection.transaction(['assets','variants','collections'],'readwrite');for(const a of[...characters,env,hidden])tx.objectStore('assets').put(a);for(const v of variants)tx.objectStore('variants').put(v);tx.objectStore('collections').put(project);tx.objectStore('collections').put(foreign);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});
  return{projectName:project.name,excludedProjectId:foreign.id,assetIds:state.assets.map(a=>a.id),variantIds:variants.map(v=>v.id),decodedPortraits:3};
 },ids);await page.reload();await page.getByRole('heading',{level:1}).first().waitFor();
 return{...ids,...extra};
}
export async function nativeConversionPackage(page,ids){
 const pkg=await conversionPackageFor(page,ids);
 return page.evaluate(async({pkg,vow})=>{
  const state=await(await import('/src/storage/db.ts')).getAllSnapshot(),{reconcileConversionMappings,serializableMappingPackage}=await import('/src/domain/recipeConversionRequest.ts');
  const camera={type:'asset.propose',operationId:'missing-camera',clientRef:'new-camera',kind:'camera',title:'Synthetic procession camera B3',promptText:'SYNTHETIC_PROCESSION_CAMERA. A slow lateral gimbal track maintains a stable medium-wide composition.',tags:['synthetic'],sourceScene:{id:pkg.operations[0].sceneId}},outfit={type:'variant.propose',operationId:'missing-outfit',clientRef:'new-outfit',variantType:'Outfit',parentCharacterId:'b3-iris',expectedParentRevision:1,title:'Synthetic pearl outfit B3',promptText:'SYNTHETIC_PEARL_OUTFIT. Ivory satin square-neck dress with a pleated skirt and pearl buttons.',tags:['synthetic'],sourceScene:{id:pkg.operations[1].sceneId}};
  pkg.source={kind:'codex',label:'Deterministic synthetic installed-CLI acceptance'};pkg.title='Synthetic Wedding Prequel - ten recipe alternates';
  pkg.operations=pkg.operations.map((op,i)=>{
   op.assetRefs=op.assetRefs.filter(r=>r.slot!=='camera');op.assetRefs.push({slot:'camera',asset:{ref:camera.clientRef}});op.sceneInstructions='SYNTHETIC_SHOT_'+String(i+1).padStart(2,'0')+': '+['Establish the quiet fictional chapel before the ceremony.','Iris checks the mirror and takes one calm breath.','Noah approaches the chapel doorway.','Iris and Noah meet at the aisle, then hold their positions.','Iris and Noah exchange the authored vows.','Hold the two at the altar for a quiet reaction.','A close composition shows the rings and their hands.','The off-screen officiant asks the written question; the couple listens.','Evan arrives at the doorway as the two look over.','Hold the approved Shot09 ending pose as a pending reference requirement.'][i];
   if(i===1||i===2){const name=i===1?'iris':'noah';op.assetRefs=op.assetRefs.filter(r=>r.slot!=='wardrobe');op.assetRefs.find(r=>r.slot==='character').asset={id:'b3-'+name};op.variantRefs=[{slot:'wardrobe',variantId:'b3-'+name+'-outfit',expectedRevision:1}]}
   if(i>=3){op.assetRefs=op.assetRefs.filter(r=>!['character','wardrobe'].includes(r.slot));op.variantRefs=[];const names=i>=8?['iris','noah','evan']:['iris','noah'];op.ensemble={version:1,primaryParticipantId:'iris',participantOrder:names,participantUpserts:names.map(name=>({id:name,character:{asset:{id:'b3-'+name},expectedRevision:1},wardrobe:{variant:i===4&&name==='iris'?{ref:outfit.clientRef}:{id:'b3-'+name+'-outfit'},...(i===4&&name==='iris'?{}:{expectedRevision:1})},presence:'on_camera',role:name==='iris'?'Bride':name==='noah'?'Groom':'Late guest',performanceNotes:'Fictional synthetic acceptance role.'})),dialogueCues:i===4?[{id:'iris-vow',speaker:'Iris',participantId:'iris',mode:'on_camera',line:vow},{id:'noah-vow',speaker:'Noah',participantId:'noah',mode:'on_camera',line:'I choose you, too.'}]:i===7?[{id:'officiant',speaker:'Officiant',mode:'off_screen',line:'Noah, do you take Iris as your wife?'}]:[]}}
   const mapped=reconcileConversionMappings(op,state.scenes.find(s=>s.id===op.sceneId),state);if(i===4)mapped.conversion.mappings.find(r=>r.target.kind==='instructions').assessment='uncertain';return mapped;
  });pkg.operations.unshift(camera,outfit);return serializableMappingPackage(pkg);
 },{pkg,vow:EXACT_B3_VOW});
}
