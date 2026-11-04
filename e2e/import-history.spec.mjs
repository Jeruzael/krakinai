import {test,expect,chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {isolatedMcpBrowser,sdkBridge,pairSynthetic,openMcpProposal,selectMcpReceipt} from './local-mcp-fixture.mjs';
import {configureKeyframeMcp,readKeyframeLibrary} from './keyframe-fixture.mjs';
import {beginWriteObservation,observedWrites} from './recipe-change-set-fixture.mjs';
import {observeImportMemory} from './import-history-resources.mjs';
import {seedChangeSet,fillAndPreview} from './change-set-fixture.mjs';
const artifacts=resolve('qa-results/import-history-storage',process.env.KRAKINAI_IMPORT_HISTORY_RUN_ID??('attempt-'+Date.now()));
console.log('KRAKINAI_IMPORT_HISTORY_ARTIFACTS',artifacts);
const save=async(name,value)=>{await mkdir(artifacts,{recursive:true});await writeFile(resolve(artifacts,name),JSON.stringify(value,null,2));};
async function setup(){const owned=await isolatedMcpBrowser(),bridge=await sdkBridge();owned.context.setDefaultTimeout(20000);await owned.page.goto('/__qa_ready');const ids=await owned.page.evaluate(async()=>await(await import('/src/__tests__/fixtures/importHistoryFixture.ts')).seedImportHistoryBulk());await configureKeyframeMcp(owned.page,ids,{text:true,derivation:true});await pairSynthetic(owned.page,bridge);return{...owned,bridge,ids};}
const calls=bridge=>{expect(bridge.callEvidence.every(c=>c.received&&c.responseSha256)).toBe(true);return bridge.callEvidence;};

for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}])test('manual storage check leaves review controls reachable at '+viewport.width+'px',async({page})=>{
 await page.setViewportSize(viewport);await seedChangeSet(page);
 await fillAndPreview(page,{schema:'krakinai.change-set.v1',changeSetId:'manual-capacity-layout',source:{kind:'manual'},operations:[{operationId:'layout-project',type:'project.create',clientRef:'layout-project',name:'Synthetic layout check'}]});
 const approvals=page.getByRole('region',{name:'Explicit import approvals',exact:true});
 await expect(approvals.getByRole('region',{name:'Import storage capacity',exact:true})).toBeVisible();
 await page.locator('.import-operations summary').filter({hasText:/^Projects /}).click();
 await page.getByRole('button',{name:'Review layout-project',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close operation',exact:true}).click();
 await approvals.getByText('Usage and limits',{exact:true}).click();await expect(approvals.getByText(/Exact stored bytes:/)).toBeVisible();
 const consent=page.getByLabel('Approve storyboard changes',{exact:true});await consent.focus();await page.keyboard.press('Space');await expect(consent).toBeChecked();
 await expect(page.getByRole('button',{name:'Apply approved changes',exact:true})).toBeDisabled();
 await mkdir(resolve('docs/qa/screenshots/import-history-storage'),{recursive:true});await page.screenshot({path:resolve('docs/qa/screenshots/import-history-storage/manual-'+viewport.width+'.png'),fullPage:false});
});

test('bulk recipe review commits 15 takes and 33 frame prompts; restart, exact receipt and replay preserve history',async()=>{
 test.setTimeout(240000);let {context,page,profile,bridge,ids}=await setup();const phases=[];
 try{
  await page.evaluate(async ids=>{const db=await import('/src/storage/db.ts'),{previewChangeSet}=await import('/src/storage/changeSets.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),{boundaryImportLedger}=await import('/src/__tests__/fixtures/importHistoryFixture.ts'),p=await previewChangeSet(ids.input,ids.approval),state=await db.getAllSnapshot(),boundary=boundaryImportLedger(8*1024*1024-p.capacity.receiptBytes-8192);await writeRecord('preferences',{...state.preferences,aiImports:{version:4,receipts:[...state.preferences.aiImports.receipts,...boundary.receipts],candidates:[]}});},ids);
  const before=await readKeyframeLibrary(page);await beginWriteObservation(page);
  const preview=await bridge.call('krakinai_preview_change_set',{changeSet:ids.input});expect(preview.ok).toBe(true);expect(preview.data.batchChecks.readiness).toBe('review_required');
  const submitted=await bridge.call('krakinai_submit_change_set',{changeSet:ids.input});expect(submitted.ok).toBe(true);expect(await observedWrites(page)).toEqual([]);expect(await readKeyframeLibrary(page)).toEqual(before);
  await openMcpProposal(page,submitted.data.proposalId);await expect(page.getByRole('heading',{name:'Storage check',exact:true})).toBeVisible();
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:width===390?844:900});const mobile=page.getByRole('button',{name:'Issues & approvals',exact:true});if(await mobile.isVisible())await mobile.click();await expect(page.getByRole('heading',{name:'Storage check',exact:true}).filter({visible:true})).toBeVisible();await mkdir(resolve('docs/qa/screenshots/import-history-storage'),{recursive:true});await page.screenshot({path:resolve('docs/qa/screenshots/import-history-storage/review-'+width+'.png'),fullPage:false});if(await page.getByRole('dialog',{name:'Issues and approvals',exact:true}).count())await page.keyboard.press('Escape');}
  await page.setViewportSize({width:1440,height:900});
  for(const label of ['Approve storyboard changes','Approve new immutable scenes','Approve preferred take changes','Approve Blocking changes','Approve keyframe and image-prompt changes','Approve frame video decision'])await page.getByLabel(label,{exact:true}).check();
  await page.getByLabel('I reviewed this exact proposal',{exact:true}).check();await expect(page.getByRole('button',{name:'Apply reviewed batch',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Apply reviewed batch',exact:true}).click();await page.getByRole('heading',{name:'Import receipt',exact:true}).waitFor();
  const status=await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId});expect(status).toMatchObject({ok:true,data:{status:'applied',receipt:{version:3}}});const receipt=status.data.receipt,after=await readKeyframeLibrary(page),savedIds=new Set(Object.values(receipt.idMappings).filter(m=>m.kind==='scene').map(m=>m.id)),saved=after.scenes.filter(s=>savedIds.has(s.id));
  expect(saved).toHaveLength(15);expect(saved.reduce((n,s)=>n+s.keyframePlan.frames.length,0)).toBe(33);for(const scene of saved)for(const frame of scene.keyframePlan.frames)expect(scene.imagePromptSnapshots[frame.id].full.length).toBeGreaterThan(100);
  expect(after.scenes.filter(s=>!savedIds.has(s.id))).toEqual(before.scenes);expect(after.media).toEqual(before.media);expect(after.drafts).toEqual(before.drafts);expect(after.preferences.aiImports.receipts.slice(0,before.preferences.aiImports.receipts.length)).toEqual(before.preferences.aiImports.receipts);
  const actual=after.preferences.aiImports.receipts.at(-1);expect(actual.version).toBe(4);expect(Buffer.byteLength(JSON.stringify(after.preferences.aiImports))).toBeGreaterThan(8*1024*1024-16384);const sizing={storedReceiptBytes:Buffer.byteLength(JSON.stringify(actual)),expandedEvidenceBytes:actual.reviewedEvidence.uncompressedBytes,storedLedgerBytes:Buffer.byteLength(JSON.stringify(after.preferences.aiImports)),sourceEvidenceSha256:actual.reviewedEvidence.sha256,mediaHashes:after.media.map(m=>({id:m.id,sha256:m.sha256})),outputSha256:createHash('sha256').update(JSON.stringify(saved.map(s=>({id:s.id,outputs:s.outputs,images:s.imagePromptSnapshots})))).digest('hex')};
  const bulkBackup=await page.evaluate(async()=>{const bytes=await(await import('/src/storage/backup.ts')).exportFullBackupZip();let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);});await mkdir(artifacts,{recursive:true});await writeFile(resolve(artifacts,'bulk.zip'),Buffer.from(bulkBackup,'base64'));
  const duplicate=await bridge.call('krakinai_submit_change_set',{changeSet:ids.input});expect(duplicate.data.status).toBe('applied');expect(await readKeyframeLibrary(page)).toEqual(after);phases.push({phase:'before-restart',calls:calls(bridge)});await context.close();await bridge.close();
  context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:900},baseURL:'http://127.0.0.1:4173',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});context.setDefaultTimeout(20000);page=context.pages()[0];await page.goto('/#/connections/ai');expect(await readKeyframeLibrary(page)).toEqual(after);bridge=await sdkBridge();await configureKeyframeMcp(page,ids,{text:true,derivation:true});await selectMcpReceipt(page,receipt);await pairSynthetic(page,bridge);
  const recovered=await bridge.call('krakinai_get_import_receipt',{changeSetId:ids.input.changeSetId,packageDigest:receipt.packageDigest});expect(recovered).toMatchObject({ok:true,data:{idMappings:receipt.idMappings,frameResults:receipt.frameResults}});const replay=await bridge.call('krakinai_submit_change_set',{changeSet:ids.input});expect(replay.data.status).toBe('applied');expect(await readKeyframeLibrary(page)).toEqual(after);phases.push({phase:'after-restart',calls:calls(bridge)});
  await save('bulk-sdk.json',{kind:'Actual MCP SDK calls and browser approval in an isolated synthetic profile; not installed CLI/native acceptance',shots:15,frames:33,operations:30,profile,sizing,phases});
 }finally{await bridge.close();await context.close();}
});

test('actual MCP and review UI expose full-ledger blocker while individual frame derivation passes',async()=>{
 test.setTimeout(180000);const {context,page,bridge,ids}=await setup();try{
  await page.evaluate(async()=>{const {getAllSnapshot}=await import('/src/storage/db.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),{boundaryImportLedger}=await import('/src/__tests__/fixtures/importHistoryFixture.ts'),state=await getAllSnapshot();await writeRecord('preferences',{...state.preferences,aiImports:boundaryImportLedger()});});
  const before=await readKeyframeLibrary(page);await beginWriteObservation(page);
  const projected=await bridge.call('krakinai_preview_change_set',{changeSet:ids.input,projection:{operationId:'history-recipe-01',keyframeId:'middle',mode:'full'}});expect(projected.ok).toBe(true);expect(projected.data.keyframes.frame.disclosure).toBe('shared');expect(projected.data.batchChecks.readiness).toBe('blocked');expect(projected.data.batchChecks.findings.map(f=>f.code)).toContain('LEDGER_CAPACITY');expect(JSON.stringify(projected.data.batchChecks)).not.toMatch(/storedBytes|expandedBytes|reviewedEvidence|comparison/);
  const submitted=await bridge.call('krakinai_submit_change_set',{changeSet:ids.input});expect(submitted.data.batchChecks.readiness).toBe('blocked');await openMcpProposal(page,submitted.data.proposalId);await expect(page.getByText('Storage limits block this batch. Existing history is preserved.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Apply reviewed batch',exact:true})).toBeDisabled();
  const status=await bridge.call('krakinai_get_proposal_status',{proposalId:submitted.data.proposalId});expect(status.data.batchChecks.readiness).toBe('blocked');expect(await observedWrites(page)).toEqual([]);expect(await readKeyframeLibrary(page)).toEqual(before);await save('blocked-sdk.json',{kind:'Actual SDK synthetic transport',calls:calls(bridge),storedLedgerBytes:Buffer.byteLength(JSON.stringify(before.preferences.aiImports)),frameDerivation:'shared',batch:'blocked',libraryUnchanged:true});
 }finally{await bridge.close();await context.close();}
});

test('near-limit history and expanded evidence survive full backup readback with observed process memory',async({page,browser})=>{
 test.setTimeout(180000);await page.goto('/__qa_ready');
 const measurements=[];
 for(const mode of ['stored-8MiB','expanded-32MiB','high-entropy-4MiB']){
  const measured=await observeImportMemory(browser,async()=>await page.evaluate(async mode=>{
   const db=await import('/src/storage/db.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),fixtures=await import('/src/__tests__/fixtures/importHistoryFixture.ts'),{prepareImportLedger,validateImportLedger}=await import('/src/domain/changeSetLedger.ts'),backup=await import('/src/storage/backup.ts');
   await db.clearAllStoresForTesting();await db.initializeDatabase();const state=await db.getAllSnapshot();let ledger=mode==='stored-8MiB'?fixtures.boundaryImportLedger():mode==='expanded-32MiB'?await fixtures.expandedBoundaryImportLedger():await fixtures.incompressibleImportLedger();await writeRecord('preferences',{...state.preferences,aiImports:ledger});
   if(mode==='stored-8MiB'){
    const {previewChangeSet,applyApprovedChangeSet}=await import('/src/storage/changeSets.ts'),{emptyChangeSetApproval}=await import('/src/types/changeSet.ts'),input={schema:'krakinai.change-set.v1',changeSetId:'exact-boundary-append',source:{kind:'manual'},operations:[{operationId:'new-project',type:'project.create',clientRef:'new-project',name:'Synthetic boundary project'}]},approval={...emptyChangeSetApproval(),storyboard:true},first=await previewChangeSet(input,approval),delta=first.capacity.prospective.storedBytes-first.capacity.current.storedBytes;
    await writeRecord('preferences',{...state.preferences,aiImports:fixtures.boundaryImportLedger(8*1024*1024-delta)});const ready=await previewChangeSet(input,approval);if(ready.capacity.status!=='checked')throw Error('Exact-boundary import did not fit.');await applyApprovedChangeSet(ready,ready.approvedDigest);ledger=(await db.getAllSnapshot()).preferences.aiImports;if(new TextEncoder().encode(JSON.stringify(ledger)).length!==8*1024*1024)throw Error('Exact-boundary commit byte count differed.');
   }
   const proof=await prepareImportLedger(ledger),before=await db.getAllSnapshot(),archive=await backup.exportFullBackupZip(),checked=await backup.validateBackupZip(archive);if(!checked.valid)throw Error(checked.error);await backup.restoreFullBackupZip(archive);const after=await db.getAllSnapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Boundary backup changed records.');
   let rejected=false;if(mode==='expanded-32MiB'){try{validateImportLedger({...ledger,receipts:[...ledger.receipts,{...ledger.receipts[0],changeSetId:'over-expanded'}]});}catch(error){rejected=/32 MiB/.test(error.message);}}else{try{validateImportLedger({...ledger,receipts:[...ledger.receipts,{...ledger.receipts[0],changeSetId:'over-stored'}]});}catch(error){rejected=/8 MiB/.test(error.message);}}if(!rejected)throw Error('Overflow was not rejected.');
   const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');let binary='';for(let i=0;i<archive.length;i+=8192)binary+=String.fromCharCode(...archive.subarray(i,i+8192));
   return{mode,storedLedgerBytes:new TextEncoder().encode(JSON.stringify(ledger)).length,expandedEvidenceBytes:proof.expandedBytes,receipts:ledger.receipts.length,archiveBytes:archive.length,archiveSha256:await digest(archive),archiveBase64:btoa(binary),overflowRejected:true,restoreExact:true};
  },mode));
  const {archiveBase64,...result}=measured.value;await mkdir(artifacts,{recursive:true});await writeFile(resolve(artifacts,mode+'.zip'),Buffer.from(archiveBase64,'base64'));measurements.push({...result,memory:measured.observation});
 }
 await save('boundary-resources.json',{kind:'Actual isolated Chromium history/manifest measurements; no near-limit media or ZIP64 claim',measurements});
});


test('the exact stored and expanded ceilings survive an actual isolated Chromium process restart',async()=>{
 test.setTimeout(120000);const observations=[];
 for(const mode of ['stored-8MiB','expanded-32MiB']){
  let {context,page,profile}=await isolatedMcpBrowser();
  try{
   await page.goto('/__qa_ready');const before=await page.evaluate(async mode=>{const db=await import('/src/storage/db.ts'),fixtures=await import('/src/__tests__/fixtures/importHistoryFixture.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts');await db.initializeDatabase();const state=await db.getAllSnapshot();let ledger=mode==='stored-8MiB'?fixtures.boundaryImportLedger():await fixtures.expandedBoundaryImportLedger();await writeRecord('preferences',{...state.preferences,aiImports:ledger});return{history:JSON.stringify(ledger),templates:state.templates};},mode);
   await context.close();context=await chromium.launchPersistentContext(profile,{headless:true,baseURL:'http://127.0.0.1:4173',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});page=context.pages()[0];await page.goto('/#/connections/ai');await page.getByRole('heading',{name:'AI Connections',exact:true}).waitFor();const after=await page.evaluate(async()=>{const state=await(await import('/src/storage/db.ts')).getAllSnapshot();return{history:JSON.stringify(state.preferences.aiImports),templates:state.templates};});expect(after).toEqual(before);observations.push({mode,profile,storedBytes:Buffer.byteLength(after.history),historySha256:createHash('sha256').update(after.history).digest('hex'),processRestartPreserved:true});
  }finally{await context.close();}
 }
 await save('boundary-restart.json',{observations});
});

test('adversarial expansion is rejected with observed internal typed-array bounds and process memory',async({browser})=>{
 test.setTimeout(120000);const context=await browser.newContext(),page=await context.newPage(),bomb=deflateSync(Buffer.alloc(64*1024*1024,120)).toString('base64');
 try{await page.goto('/__qa_ready');const measured=await observeImportMemory(browser,async()=>await page.evaluate(async data=>{
  const originals={Uint8Array,Uint16Array,Uint32Array},summaries=[];let enabled=false,stats;
  for(const [name,ctor]of Object.entries(originals))window[name]=new Proxy(ctor,{construct(target,args,newTarget){const value=Reflect.construct(target,args,newTarget);if(enabled){stats.calls++;const size=value.buffer.byteLength;stats.largest=Math.max(stats.largest,size);stats.sizes[size]=(stats.sizes[size]??0)+1;if(!stats.seen.has(value.buffer)){stats.seen.add(value.buffer);stats.total+=size;}}return value;}});
  try{
   // Fresh realm: fflate captures these observing constructors before decoding.
   const {decodeImportEvidence}=await import('/src/domain/importEvidence.ts');
   const run=(declared,repetitions)=>{stats={largest:0,total:0,calls:0,sizes:{},seen:new WeakSet()};let callbackHighWater=0,rejected=0;enabled=true;
    try{for(let i=0;i<repetitions;i++){try{decodeImportEvidence({encoding:'deflate-utf8-base64.v1',uncompressedBytes:declared,sha256:'0'.repeat(64),data},{onChunk:bytes=>{callbackHighWater=Math.max(callbackHighWater,bytes);}});}catch(error){if(!/size|limit/i.test(error.message))throw error;rejected++;}}}finally{enabled=false;}
    if(rejected!==repetitions||!stats.calls||stats.largest>Math.max(declared,512*1024)||callbackHighWater>=512*1024)throw Error('Internal decoder allocation/output bound was not demonstrated.');
    if(declared===4*1024*1024&&stats.sizes[declared]!==repetitions)throw Error('Unexpected decoder allocation at the full output-buffer size.');
    const {seen,...observations}=stats;void seen;summaries.push({declaredBytes:declared,sourceExpandedBytes:64*1024*1024,repetitions,rejected,callbackHighWater,...observations});
   };
   run(32,1);run(4*1024*1024,1);for(let i=0;i<25;i++){run(4*1024*1024,1);await new Promise(resolve=>setTimeout(resolve,20));}
   return{kind:'Opaque synthetic expansion bomb, not valid prompt text or media; constructors captured before fflate import',cases:summaries,databases:(await indexedDB.databases()).map(d=>d.name)};
  }finally{Object.assign(window,originals);}
 },bomb));expect(measured.value.databases).toEqual([]);await save('decoder-allocations.json',{...measured.value,memory:measured.observation,compressedBytes:Buffer.from(bomb,'base64').length});
 }finally{await context.close();}
});

test('representative near-limit 15-shot prepare and atomic Apply have observed process memory',async({page,browser})=>{
 test.setTimeout(120000);await page.goto('/__qa_ready');const measured=await observeImportMemory(browser,async()=>await page.evaluate(async()=>{
  const {seedImportHistoryBulk,boundaryImportLedger}=await import('/src/__tests__/fixtures/importHistoryFixture.ts'),{writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts'),db=await import('/src/storage/db.ts'),{previewChangeSet,applyApprovedChangeSet}=await import('/src/storage/changeSets.ts');
  const f=await seedImportHistoryBulk(),first=await previewChangeSet(f.input,f.approval),state=await db.getAllSnapshot(),boundary=boundaryImportLedger(8*1024*1024-first.capacity.receiptBytes-8192);await writeRecord('preferences',{...state.preferences,aiImports:{version:4,receipts:[...state.preferences.aiImports.receipts,...boundary.receipts],candidates:[]}});
  const before=await db.getAllSnapshot(),p=await previewChangeSet(f.input,f.approval);if(p.capacity.status!=='checked')throw Error('Representative resource batch blocked.');let authorizationCount=0;const receipt=await applyApprovedChangeSet(p,p.approvedDigest,()=>{if(++authorizationCount!==1)throw Error('One-time authorization repeated.');}),after=await db.getAllSnapshot(),ids=new Set(Object.values(receipt.idMappings).filter(m=>m.kind==='scene').map(m=>m.id)),saved=after.scenes.filter(s=>ids.has(s.id));
  if(JSON.stringify(after.scenes.filter(s=>!ids.has(s.id)))!==JSON.stringify(before.scenes)||saved.length!==15||saved.reduce((n,s)=>n+s.keyframePlan.frames.length,0)!==33)throw Error('Representative resource batch changed unrelated scenes or frame counts.');
  return{kind:'Synthetic Stage B storage API prepare/Apply; actual MCP/browser approval certified separately',authorizationCount,scenes:saved.length,frames:33,storedLedgerBytes:new TextEncoder().encode(JSON.stringify(after.preferences.aiImports)).length,expandedReceiptBytes:receipt.reviewedEvidence.uncompressedBytes,storedReceiptBytes:new TextEncoder().encode(JSON.stringify(receipt)).length,evidenceSha256:receipt.reviewedEvidence.sha256,packageDigest:p.packageDigest,unrelatedScenesPreserved:true};
 }));expect(measured.value.storedLedgerBytes).toBeGreaterThan(8*1024*1024-16384);await save('representative-apply-resources.json',{...measured.value,memory:measured.observation});
});
