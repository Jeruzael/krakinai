import {writeFlowFixture} from '../../scripts/qa/write-keyframe-flow-fixture.mjs';
import {it,expect} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {uploadFrameImage} from '../storage/frameImages';
import {getAllSnapshot} from '../storage/db';
import rasters from './fixtures/frame-raster-fixtures.json';
import {planFlowHandoff,buildFlowHandoff,type FlowHandoffSelection} from '../domain/flowHandoff';
import {flowCompatibility} from '../domain/flowCompatibility';
import {PROJECT_EXPORT_MEDIA_LIMIT,PROJECT_EXPORT_TEXT_LIMIT,PROJECT_EXPORT_ENTRY_LIMIT} from '../domain/projectExport';
async function fixture(){const f=await seedKeyframeStorage();await uploadFrameImage({target:{collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0},file:new File([Uint8Array.from(atob(rasters.files[0].base64),c=>c.charCodeAt(0))],'synthetic.png',{type:'image/png'})});const state=await getAllSnapshot();const selection:FlowHandoffSelection={projectId:f.projectId,expectedProjectRevision:state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,mode:'frames',frames:[{frameId:'middle',role:'start'}],referenceAssociationIds:[],excludedSelectionIds:[],modelKey:'unverified'};return{f,state,selection};}
it('exports exact selected prompt strings and original hashes; independent roles remain in the manifest',async()=>{
 const {f,state,selection}=await fixture(),before=structuredClone(state),plan=await planFlowHandoff(selection,state);expect(plan.complete).toBe(true);expect(plan.warnings.join(' ')).toMatch(/timing|middle/i);
 const result=await buildFlowHandoff(plan,state),files=unzipSync(result.bytes);expect(strFromU8(files['video/full.txt'])).toBe(f.parent.outputs.full);expect(strFromU8(files['frames/middle/full.txt'])).toBe(f.parent.imagePromptSnapshots!.middle.full);expect(result.manifest.files[0].sha256).toBe(rasters.files[0].sha256);expect(state).toEqual(before);
 await writeFlowFixture(result.bytes,{manifest:result.manifest,texts:Object.fromEntries(plan.texts.map(t=>[t.path,t.text])),originalHashes:[rasters.files[0].sha256]});
});
it('blocks missing images, exact revision drift and cancellation; exclusions are explicit and visible',async()=>{
 const {state,selection}=await fixture();const missing={...selection,frames:[{frameId:'start',role:'start' as const}]};const plan=await planFlowHandoff(missing,state);expect(plan.complete).toBe(false);await expect(buildFlowHandoff(plan,state)).rejects.toThrow(/missing|incomplete/i);
 const excluded=await planFlowHandoff({...missing,excludedSelectionIds:['frame:start']},state);expect(excluded.exclusions).toEqual(['frame:start']);expect(excluded.complete).toBe(false);
 const controller=new AbortController();controller.abort();await expect(planFlowHandoff(selection,state,{signal:controller.signal})).rejects.toThrow(/cancel|abort/i);
 await expect(planFlowHandoff({...selection,expectedSceneRevision:99},state)).rejects.toThrow(/revision/);
});
it('deduplicates original bytes while retaining all selected roles and fails closed on changed files',async()=>{
 const {state,selection,f}=await fixture(),reference=f.parent.referencePack!.entries[0];const ingredients={...selection,mode:'ingredients' as const,frames:[{frameId:'middle',role:'ingredient' as const}],referenceAssociationIds:[reference.associationId]};
 const plan=await planFlowHandoff(ingredients,state);expect(plan.complete).toBe(true);expect(plan.associations).toHaveLength(2);
 const file=state.media.find(m=>m.id===plan.associations[0].mediaId)!;file.blob=new Blob(['changed'],{type:file.mimeType});await expect(buildFlowHandoff(plan,state)).rejects.toThrow(/changed|metadata|bytes/i);
});
it('labels unknown/stale model guidance and never promises arbitrary keyframe timing or a universal ingredient limit',()=>{
 expect(flowCompatibility('unknown','ingredients').status).toBe('Unverified');expect(flowCompatibility('veo-3.1-quality','ingredients',new Date('2026-11-04T12:00:00Z')).status).toBe('Unsupported');expect(flowCompatibility('veo-3.1-fast','frames',new Date('2027-01-01')).status).toBe('Unverified');expect(flowCompatibility('unverified','ingredients').message).toMatch(/no universal/i);
});
it('supports explicit Start/End using the same original bytes without losing either association role',async()=>{
 const {state,selection}=await fixture(),project=state.collections[0],source=project.project!.frameProduction!.imageEvents[0];
 project.project!.frameProduction!.imageEvents.push({...source,id:'synthetic-end',frameId:'end'});project.project!.frameProduction!.active.push({shotId:selection.shotId,sceneId:selection.sceneId,frameId:'end',eventId:'synthetic-end'});project.project!.frameProduction!.revision++;
 const plan=await planFlowHandoff({...selection,frames:[{frameId:'middle',role:'start'},{frameId:'end',role:'end'}]},state);expect(plan.complete).toBe(true);expect(plan.files).toHaveLength(1);expect(plan.associations.map(row=>row.role)).toEqual(['start','end']);
});
it('enforces 128 MiB media, 64 MiB text and 2000 entries before oversized allocation',async()=>{
 expect([PROJECT_EXPORT_MEDIA_LIMIT,PROJECT_EXPORT_TEXT_LIMIT,PROJECT_EXPORT_ENTRY_LIMIT]).toEqual([128*1024**2,64*1024**2,2000]);
 const {state,selection}=await fixture(),media=state.media.find(m=>m.id===state.collections[0].project!.frameProduction!.imageEvents[0].mediaId)!;const old=media.byteSize;media.byteSize=PROJECT_EXPORT_MEDIA_LIMIT+1;
 await expect(planFlowHandoff(selection,state)).rejects.toThrow(/128 MiB/);media.byteSize=old;
 state.scenes.find(s=>s.id===selection.sceneId)!.outputs.full='x'.repeat(PROJECT_EXPORT_TEXT_LIMIT+1);await expect(planFlowHandoff(selection,state)).rejects.toThrow(/64 MiB/);
 const {state:many,selection:pick}=await fixture(),scene=many.scenes.find(s=>s.id===pick.sceneId)!;scene.referencePack!.entries=Array.from({length:2000},(_,i)=>({...scene.referencePack!.entries[0],associationId:'synthetic-ref-'+i,mediaId:'synthetic-file-'+i}));
 many.media=scene.referencePack!.entries.map(entry=>({...many.media[0],id:entry.mediaId,byteSize:1}));await expect(planFlowHandoff({...pick,mode:'ingredients',frames:[],referenceAssociationIds:scene.referencePack!.entries.map(e=>e.associationId)},many)).rejects.toThrow(/2000/);
});
