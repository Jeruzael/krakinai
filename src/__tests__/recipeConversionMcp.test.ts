import{beforeEach,it,expect}from'vitest';
import{emptyMcpScope,assertProposalScope}from'../domain/mcpScope';
import{ProposalBroker}from'../connections/proposalBroker';
import{readMcpTool}from'../domain/mcpReads';
import{clearAllStoresForTesting,initializeDatabase,openDatabase,getAllSnapshot,saveMediaAsset}from'../storage/db';
import{conversionScenario}from'./fixtures/recipeConversionFixture';
import{previewChangeSet}from'../storage/changeSets';
async function fixture(){const f=await conversionScenario(),scope={...emptyMcpScope(),projectIds:['project'],assetIds:['environment'],fullPromptSceneIds:['direct-source'],allowProposals:true};return{...f,scope};}
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();const{state}=await fixture(),db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['assets','scenes','collections'],'readwrite');for(const key of['assets','scenes','collections']as const)for(const r of state[key])tx.objectStore(key).put(r);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});});
it('requires an explicitly shared original full prompt as well as actual project, shot and component scope',async()=>{
 const f=await fixture();f.scope.fullPromptSceneIds=[];expect(()=>assertProposalScope(f.input,f.scope,f.state)).toThrow();
 f.scope.fullPromptSceneIds=['direct-source'];expect(()=>assertProposalScope(f.input,f.scope,f.state)).not.toThrow();
 f.scope.assetIds=[];expect(()=>assertProposalScope(f.input,f.scope,f.state)).toThrow();
});
it('returns only permission-aware v4 assembled previews and makes no writes',async()=>{
 const f=await fixture(),broker=new ProposalBroker();broker.connect('synthetic',f.scope);const before=await getAllSnapshot();
 const hidden:any=await broker.handle({requestId:'preview-withheld',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(hidden.ok).toBe(true);
 expect(hidden.data.conversions[0]).toMatchObject({operationId:'convert',outputDisclosure:'withheld'});expect(JSON.stringify(hidden)).not.toContain('quiet enclosed courtyard');
 f.scope.includeAssetText=true;broker.setScope(f.scope);
 const shared:any=await broker.handle({requestId:'preview-shared',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(shared.ok).toBe(true);
 expect(shared.data.conversions[0].outputs).toMatchObject({full:expect.stringContaining('A quiet enclosed courtyard.'),structured:expect.stringContaining('=== ENVIRONMENT'),compact:expect.stringContaining('Enclosed courtyard.')});
 expect(JSON.stringify(shared)).not.toContain('SOURCE_ONLY_DO_NOT_COPY');expect(await getAllSnapshot()).toEqual(before);
});
it('exposes the actual currently resolved proposal preview without minting approval or writing records',async()=>{
 const f=await fixture();f.scope.includeAssetText=true;const broker=new ProposalBroker();broker.connect('synthetic',f.scope);
 const submitted:any=await broker.handle({requestId:'submit',tool:'krakinai_submit_change_set',args:{changeSet:f.input}},'synthetic');expect(submitted.ok).toBe(true);
 const before=await getAllSnapshot();const status:any=await broker.handle({requestId:'status',tool:'krakinai_get_proposal_status',args:{proposalId:submitted.data.proposalId}},'synthetic');
 expect(status.ok).toBe(true);expect(status.data.status).toBe('review_required');expect(status.data.conversions[0].outputs.full).toContain('A quiet enclosed courtyard.');
 expect(status.data.receipt).toBeUndefined();expect(await getAllSnapshot()).toEqual(before);
 await expect(broker.applyFromUserEvent(submitted.data.proposalId,new Event('click'))).rejects.toThrow(/actual review|approval/i);
});
it('does not turn created record IDs or conversion provenance into ongoing read grants',async()=>{
 const f=await fixture();f.state.assets.push({...f.state.assets[0],id:'new-private-camera',category:'camera',title:'CANARY_CAMERA',promptText:'PRIVATE_NEW_ASSET_TEXT'});
 const result:any=await readMcpTool('krakinai_search_assets',{query:'CANARY_CAMERA'},f.scope,f.state);expect(result.items).toEqual([]);
 f.state.scenes[0].directPrompt!.text='PRIVATE_ORIGINAL';f.state.scenes[0].outputs.full='PRIVATE_ORIGINAL';f.scope.fullPromptSceneIds=[];
 const data=await readMcpTool('krakinai_get_scene',{sceneId:'direct-source'},f.scope,f.state);expect(JSON.stringify(data)).not.toContain('PRIVATE_ORIGINAL');
});
it('withholds complete assembled output containing provider notes until the separate notes grant',async()=>{
 const f=await fixture();f.scope.includeAssetText=true;f.input.operations[0].settings.toolNotes='PRIVATE_PROVIDER_NOTE';const broker=new ProposalBroker();broker.connect('synthetic',f.scope);
 const hidden:any=await broker.handle({requestId:'note-hidden',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(hidden.ok).toBe(true);expect(JSON.stringify(hidden)).not.toContain('PRIVATE_PROVIDER_NOTE');
 f.scope.includeNotes=true;broker.setScope(f.scope);const shared:any=await broker.handle({requestId:'note-shared',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(shared.data.conversions[0].outputs.full).toContain('PRIVATE_PROVIDER_NOTE');
});
it('requires the separate filename grant for complete output that names an original image',async()=>{
 const f=await fixture(),op=f.input.operations[0],png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwd3v6HwAE3AJ6zM4FjgAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
 const media=await saveMediaAsset({filename:'PRIVATE_ORIGINAL_FILENAME.png',mimeType:'image/png',blob:new Blob([png],{type:'image/png'})});
 op.shotType='graphic_motion';op.assetRefs=[{asset:{id:'camera'},slot:'camera',expectedRevision:1}];op.sourceMedia=[{mediaId:media.id,role:'reference',altText:''}];
 op.conversion.mappings=op.conversion.mappings.filter((m:any)=>m.id!=='environment-map');op.conversion.mappings.push({id:'camera',target:{kind:'slot',slot:'camera'},assessment:'suggested'},{id:'original',target:{kind:'source_media'},assessment:'suggested'},{id:'refs',target:{kind:'references'},assessment:'suggested'});
 f.scope.assetIds=['camera'];f.scope.mediaIds=[media.id];f.scope.includeAssetText=true;const broker=new ProposalBroker();broker.connect('synthetic',f.scope);
 const hidden:any=await broker.handle({requestId:'file-hidden',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(hidden.ok).toBe(true);expect(JSON.stringify(hidden)).not.toContain('PRIVATE_ORIGINAL_FILENAME');
 f.scope.includeMediaFilenames=true;broker.setScope(f.scope);const shared:any=await broker.handle({requestId:'file-shared',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(shared.data.conversions[0].outputs.full).toContain('PRIVATE_ORIGINAL_FILENAME.png');
});
it('does not expose ordinary reference-pack filenames through raw three-mode MCP previews',async()=>{
 const f=await fixture(),png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwd3v6HwAE3AJ6zM4FjgAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
 const media=await saveMediaAsset({filename:'PRIVATE_GUIDE_FILENAME.png',mimeType:'image/png',blob:new Blob([png],{type:'image/png'})}),db=await openDatabase(),asset=f.state.assets.find(a=>a.id==='environment')!;asset.mediaLinks=[{mediaId:media.id,role:'reference',altText:'Explicit guide',filename:media.filename,mimeType:media.mimeType,namesCaptured:true,order:0}];await new Promise<void>(resolve=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(asset);tx.oncomplete=()=>resolve()});
 f.input.operations[0].shotType='character_scene';f.input.operations[0].assetRefs.push({slot:'action',asset:{id:'action'},expectedRevision:1});f.scope.assetIds.push('action');f.input.operations[0].conversion.mappings.push({id:'refs',target:{kind:'references'},assessment:'suggested'});f.scope.includeAssetText=true;const broker=new ProposalBroker();broker.connect('synthetic',f.scope);
 const hidden:any=await broker.handle({requestId:'guide-hidden',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(hidden.ok).toBe(true);expect(JSON.stringify(hidden)).not.toContain('PRIVATE_GUIDE_FILENAME');expect(hidden.data.conversions[0].outputDisclosure).toBe('shared');
 f.scope.includeMediaFilenames=true;broker.setScope(f.scope);const shared:any=await broker.handle({requestId:'guide-shared',tool:'krakinai_preview_change_set',args:{changeSet:f.input}},'synthetic');expect(shared.data.conversions[0].outputs).toEqual(hidden.data.conversions[0].outputs);expect(JSON.stringify(shared)).not.toContain('PRIVATE_GUIDE_FILENAME');
});
it('does not inherit the source full-prompt grant for a newly saved recipe take',async()=>{
 const f=await fixture(),preview=await previewChangeSet(f.input,f.approval),scene=preview.plan.scenes[0];f.state.scenes.push(scene);f.state.collections=preview.plan.collections;
 const metadata:any=await readMcpTool('krakinai_get_scene',{sceneId:scene.id},f.scope,f.state);expect(metadata.id).toBe(scene.id);expect(metadata.fullPrompt).toBeUndefined();
 await expect(readMcpTool('krakinai_get_generation_prompt',{sceneId:scene.id},f.scope,f.state)).rejects.toThrow(/permission|outside/i);
});
it('provides the exact source text hash only when the source full prompt is explicitly shared',async()=>{
 const f=await fixture();const shared:any=await readMcpTool('krakinai_get_scene',{sceneId:'direct-source'},f.scope,f.state);
 expect(shared.sourceTextSha256).toBe(f.input.operations[0].conversion.sourceTextSha256);
 f.scope.fullPromptSceneIds=[];const hidden:any=await readMcpTool('krakinai_get_scene',{sceneId:'direct-source'},f.scope,f.state);expect(hidden.sourceTextSha256).toBeUndefined();
});
