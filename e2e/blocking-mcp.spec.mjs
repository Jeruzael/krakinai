import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {seedBlocking} from './blocking-fixture.mjs';
import {isolatedMcpBrowser,sdkBridge,pairSynthetic,selectMcpRecord,setMcpFlag,applyMcpPermissions,showMcpProposals,syntheticMediaHashes} from './local-mcp-fixture.mjs';
import {beginWriteObservation,observedWrites} from './recipe-change-set-fixture.mjs';
import {seedBlockingNative,approveBlockingNative} from './blocking-native-fixture.mjs';
const snapshot=page=>page.evaluate(async()=>{const s=await(await import('/src/storage/db.ts')).getAllSnapshot();return{scenes:s.scenes,collections:s.collections,assets:s.assets,variants:s.variants,drafts:s.drafts,preferences:s.preferences,media:s.media.map(({blob,posterBlob,...m})=>m)};});
async function configure(page,ids){
 await page.goto('/#/connections/ai');const projectName=await page.evaluate(async id=>(await(await import('/src/storage/db.ts')).getAllSnapshot()).collections.find(c=>c.id===id).name,ids.projectId);
 await selectMcpRecord(page,'Projects',projectName);await setMcpFlag(page,'Allow change-set proposals',true);
 await page.getByRole('tab',{name:'Permissions',exact:true}).click();await page.getByLabel('Enable Blocking permission format',{exact:true}).check();
 const picker=page.getByRole('region',{name:'Blocking authoring text record selection',exact:true});await picker.getByLabel('Search Blocking authoring text',{exact:true}).fill(ids.sceneId);await picker.locator('.ai-record-row').filter({hasText:ids.sceneId}).getByRole('checkbox').check();
 await page.getByLabel('Allow blocking proposals',{exact:true}).check();await applyMcpPermissions(page);
}
async function sourceInput(page,bridge,ids,id){
 const source=(await bridge.call('krakinai_get_scene',{sceneId:ids.sceneId}));expect(source.ok).toBe(true);const project=await bridge.call('krakinai_get_project',{projectId:ids.projectId});expect(project.ok).toBe(true);
 return{schema:'krakinai.change-set.v5',changeSetId:id,source:{kind:'codex',label:'Synthetic Blocking SDK regression'},operations:[{operationId:'turn',type:'scene.revise_recipe',clientRef:'new-turn',project:{id:ids.projectId,expectedRevision:project.data.expectedRevision},shot:{id:ids.shotId},sceneId:ids.sceneId,expectedHeadId:source.data.expectedHeadId,expectedSourceRevision:source.data.expectedSourceRevision,expectedSourceRecipeDigest:source.data.expectedSourceRecipeDigest,expectedBlockingDigest:source.data.expectedBlockingDigest,blocking:{version:1,expectedBaseDigest:source.data.expectedBlockingDigest,participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},end:{pose:'Synthetic Aya turns toward the chapel door; preserve her gown and appearance.'}}]}}]};
}
async function openAndApprove(page,{apply=true}={}){
 await showMcpProposals(page);await page.getByRole('button',{name:'Review proposal',exact:true}).click();
 for(const label of ['Approve storyboard changes','Approve new immutable scenes']){await page.getByLabel(label,{exact:true}).check();await expect(page.getByLabel(label,{exact:true})).toBeEnabled();}
 await page.getByLabel('I reviewed this exact proposal',{exact:true}).check();await expect(page.getByRole('button',{name:'Apply reviewed batch',exact:true})).toBeDisabled();
 await page.getByLabel('Approve blocking changes',{exact:true}).check();await expect(page.getByLabel('I reviewed this exact proposal',{exact:true})).not.toBeChecked();await page.getByLabel('I reviewed this exact proposal',{exact:true}).check();
 await expect(page.getByRole('button',{name:'Apply reviewed batch',exact:true})).toBeEnabled();if(apply)await page.getByRole('button',{name:'Apply reviewed batch',exact:true}).click();
}
test('Blocking SDK: exact proposal, no preapproval writes, browser approval, immutable receipt/replay and revocation',async()=>{
 test.setTimeout(150000);const{page,context}=await isolatedMcpBrowser(),bridge=await sdkBridge();
 try{
  const ids=await seedBlocking(page,{saved:true,sequence:true});await configure(page,ids);await pairSynthetic(page,bridge);
  const input=await sourceInput(page,bridge,ids,'synthetic-blocking-sdk'),before=await snapshot(page),hashes=await syntheticMediaHashes(page);await beginWriteObservation(page);
  await page.getByRole('tab',{name:'Connection',exact:true}).focus();const focus=await page.evaluate(()=>document.activeElement?.textContent),route=page.url();
  const preview=await bridge.call('krakinai_preview_change_set',{changeSet:input});expect(preview).toMatchObject({ok:true,data:{blocking:[{outputDisclosure:'withheld'}]}});
  const submitted=await bridge.call('krakinai_submit_change_set',{changeSet:input});expect(submitted).toMatchObject({ok:true,data:{status:'review_required'}});const proposalId=submitted.data.proposalId;
  expect(await observedWrites(page)).toEqual([]);expect(await snapshot(page)).toEqual(before);expect(page.url()).toBe(route);expect(await page.evaluate(()=>document.activeElement?.textContent)).toBe(focus);
  const status=await bridge.call('krakinai_get_proposal_status',{proposalId});expect(status).toMatchObject({ok:true,data:{previewIsSnapshot:true,blocking:[{sourceSceneId:ids.sceneId}]}});
  await openAndApprove(page);await expect(page.getByRole('heading',{name:'Import receipt',exact:true})).toBeVisible();
  const confirmed=await bridge.call('krakinai_get_proposal_status',{proposalId});expect(confirmed).toMatchObject({ok:true,data:{status:'applied',receipt:{version:2,changeSetSchema:'krakinai.change-set.v5'}}});const receipt=confirmed.data.receipt,newId=receipt.idMappings['new-turn'].id,after=await snapshot(page);
  expect(after.scenes.filter(s=>s.id!==newId)).toEqual(before.scenes);expect(after.scenes.find(s=>s.id===newId).blocking.participants[0].end.pose).toContain('Synthetic Aya turns');expect(after.collections[0].project.shots.find(s=>s.id===ids.shotId).selectedSceneId).toBe(ids.sceneId);expect(after.assets).toEqual(before.assets);expect(after.variants).toEqual(before.variants);expect(after.drafts).toEqual(before.drafts);expect(await syntheticMediaHashes(page)).toEqual(hashes);
  const stored=await bridge.call('krakinai_get_import_receipt',{changeSetId:input.changeSetId,packageDigest:receipt.packageDigest});expect(stored.data.idMappings).toEqual(receipt.idMappings);expect(stored.data).not.toHaveProperty('reviewedContent');
  const newMetadata=await bridge.call('krakinai_get_scene',{sceneId:newId});expect(newMetadata).toMatchObject({ok:true,data:{blocking:{disclosure:'withheld'}}});
  expect(await bridge.call('krakinai_submit_change_set',{changeSet:input})).toMatchObject({ok:true,data:{status:'applied'}});expect(await snapshot(page)).toEqual(after);
  await page.getByRole('tab',{name:'Connection',exact:true}).click();await page.getByRole('button',{name:'Disconnect Codex',exact:true}).click();await page.getByRole('button',{name:'Disconnect now',exact:true}).click();expect(await bridge.call('krakinai_get_scene',{sceneId:ids.sceneId})).toMatchObject({ok:false,error:{code:'PAIRING_REQUIRED'}});
  const evidence=bridge.callEvidence;expect(evidence.every(c=>c.received&&/^[a-f0-9]{64}$/.test(c.responseSha256))).toBe(true);expect(new Set(evidence.map(c=>c.id)).size).toBe(evidence.length);await mkdir(resolve('qa-results/blocking-mcp'),{recursive:true});await writeFile(resolve('qa-results/blocking-mcp/sdk-results.json'),JSON.stringify({kind:'actual SDK synthetic verifier; not installed CLI/native certification',calls:evidence,sourceSceneId:ids.sceneId,newSceneId:newId,mediaHashes:hashes,oldScenesPreserved:true,preferredPreserved:true,noWritesBeforeApproval:true},null,2));
 }finally{await bridge.close();await context.close();}
});
test('Blocking SDK: explicit permission denial, stale source and a foreign write survive failed browser apply',async()=>{
 test.setTimeout(120000);const{page,context}=await isolatedMcpBrowser(),bridge=await sdkBridge();
 try{
  const ids=await seedBlocking(page,{saved:true});await configure(page,ids);await pairSynthetic(page,bridge);const input=await sourceInput(page,bridge,ids,'synthetic-blocking-stale');
  await setMcpFlag(page,'Allow blocking proposals',false);expect(await bridge.call('krakinai_submit_change_set',{changeSet:input})).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});await setMcpFlag(page,'Allow blocking proposals',true);
  expect(await bridge.call('krakinai_submit_change_set',{changeSet:input})).toMatchObject({ok:true});await openAndApprove(page,{apply:false});
  await page.evaluate(async id=>{const db=await(await import('/src/storage/db.ts')).openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('scenes','readwrite'),store=tx.objectStore('scenes'),r=store.get(id);r.onsuccess=()=>store.put({...r.result,reviewNotes:'Synthetic independent foreign write'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});},ids.sceneId);
  const foreign=await snapshot(page);await page.getByRole('button',{name:'Apply reviewed batch',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/Nothing was applied|changed/);expect(await snapshot(page)).toEqual(foreign);expect(foreign.preferences.aiImports).toBeUndefined();
 }finally{await bridge.close();await context.close();}
});
for(const failure of ['quota','order','scope'])test(`Blocking SDK: ${failure} rejects an already reviewed batch and preserves current records`,async()=>{
 test.setTimeout(120000);const{page,context}=await isolatedMcpBrowser(),bridge=await sdkBridge();
 try{
  const ids=await seedBlocking(page,{saved:true});await configure(page,ids);await pairSynthetic(page,bridge);const input=await sourceInput(page,bridge,ids,'synthetic-blocking-'+failure),submitted=await bridge.call('krakinai_submit_change_set',{changeSet:input});expect(submitted.ok).toBe(true);await openAndApprove(page,{apply:false});
  if(failure==='order')await page.evaluate(async id=>{const{openDatabase}=await import('/src/storage/db.ts'),db=await openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('collections','readwrite'),store=tx.objectStore('collections'),r=store.get(id);r.onsuccess=()=>{const project=r.result;project.project.shots.reverse().forEach((s,i)=>s.order=i);project.project.revision++;store.put(project);};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});},ids.projectId);
  if(failure==='scope')await setMcpFlag(page,'Allow blocking proposals',false);
  if(failure==='quota')await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__restoreBlockingQaPut=()=>{IDBObjectStore.prototype.put=original;};IDBObjectStore.prototype.put=function(value,...args){if(this.name==='preferences')throw new DOMException('Synthetic late quota failure','QuotaExceededError');return original.call(this,value,...args);};});
  const before=await snapshot(page),hashes=await syntheticMediaHashes(page);
  if(failure==='scope'){
   expect(await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId})).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});await showMcpProposals(page);await expect(page.getByRole('region',{name:'Incoming change review',exact:true})).toBeVisible();await expect(page.getByLabel('I reviewed this exact proposal',{exact:true})).not.toBeChecked();await expect(page.getByRole('button',{name:'Apply reviewed batch',exact:true})).toBeDisabled();
  }else{
   await page.getByRole('button',{name:'Apply reviewed batch',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/Nothing was applied|changed/);if(failure==='quota')await page.evaluate(()=>window.__restoreBlockingQaPut());expect(await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId})).toMatchObject({ok:true,data:{status:'conflict'}});
  }
  expect(await snapshot(page)).toEqual(before);expect(await syntheticMediaHashes(page)).toEqual(hashes);expect(before.preferences.aiImports).toBeUndefined();expect(bridge.callEvidence.every(c=>c.received)).toBe(true);
 }finally{await bridge.close();await context.close();}
});
test('Blocking SDK: native acceptance review controls resolve a real inherited manual buffer before atomic save',async()=>{
 test.setTimeout(120000);const{page,context}=await isolatedMcpBrowser(),bridge=await sdkBridge();
 try{
  const ids=await seedBlockingNative(page);await configure(page,ids);await pairSynthetic(page,bridge);
  const before=await snapshot(page),input=await sourceInput(page,bridge,ids,'synthetic-blocking-manual-review'),submitted=await bridge.call('krakinai_submit_change_set',{changeSet:input});expect(submitted.ok).toBe(true);expect(await snapshot(page)).toEqual(before);
  await approveBlockingNative(page,submitted.data.proposalId,{beforeDecision:async()=>{
   await mkdir('qa-results/blocking-mcp/screenshots',{recursive:true});
   for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});const region=page.getByRole('region',{name:'Blocking proposal turn',exact:true});await region.scrollIntoViewIfNeeded();
    // Finish the actual responsive drawer transition before capturing evidence.
    await page.locator('.app-sidebar').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
    if(width<768)expect(await page.locator('.app-sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`qa-results/blocking-mcp/screenshots/manual-review-${width}.png`,fullPage:true,animations:'disabled'});
   }
  }});
  const status=await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId});expect(status).toMatchObject({ok:true,data:{status:'applied'}});
  const after=await snapshot(page),added=after.scenes.find(s=>s.id===status.data.receipt.idMappings['new-turn'].id);expect(added.manualOutputs).toEqual({});expect(added.outputs.full).toContain('Synthetic Aya turns');expect(after.scenes.filter(s=>s.id!==added.id)).toEqual(before.scenes);
 }finally{await bridge.close();await context.close();}
});
