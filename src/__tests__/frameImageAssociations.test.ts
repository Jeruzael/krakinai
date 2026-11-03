import {expect,it} from 'vitest';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
import {getActiveFrameImage,planFrameImageAssociation,planFrameImageReview,validateFrameProductionBudget,validateFrameProduction,frameMediaSignature} from '../domain/frameImageAssociations';
import {prepareStoredFrameImage} from '../domain/frameImageMedia';
import rasters from './fixtures/frame-raster-fixtures.json';
import type {MediaAsset} from '../types/domain';
const media=(row:typeof rasters.files[number]):MediaAsset=>{const raw=Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0));return{id:'synthetic-frame',filename:row.filename,safeFilename:row.filename,mimeType:row.mime,byteSize:raw.length,blob:new Blob([raw],{type:row.mime}),width:row.width,height:row.height,createdAt:'2026-11-04T00:00:00.000Z'};};
it.each(rasters.files)('validates original $format bytes, dimensions and SHA without transcoding',async row=>{
 const input=media(row),before=await input.blob.arrayBuffer(),proof=await prepareStoredFrameImage(input,{decode:async()=>({width:row.width,height:row.height})});
 expect(proof.sha256).toBe(row.sha256);expect(proof.signature).toBe(frameMediaSignature(input));expect(await input.blob.arrayBuffer()).toEqual(before);
});
it.each(['corrupt','mime','dimensions','empty','oversize','decode'])('rejects %s before any association can be certified',async kind=>{
 const input=media(rasters.files[0]);if(kind==='corrupt')input.blob=new Blob([new Uint8Array(input.byteSize).fill(0)],{type:input.mimeType});
 if(kind==='mime')input.blob=new Blob([await input.blob.arrayBuffer()],{type:'image/jpeg'});if(kind==='dimensions')input.width=99;
 if(kind==='empty'){input.blob=new Blob([],{type:input.mimeType});input.byteSize=0;}if(kind==='oversize'){input.blob=new Blob([new Uint8Array(10*1024*1024+1)],{type:input.mimeType});input.byteSize=input.blob.size;}
 await expect(prepareStoredFrameImage(input,{decode:async()=>{if(kind==='decode')throw Error('Synthetic decoder rejection');return{width:32,height:24};}})).rejects.toThrow(/image|bytes|MIME|dimension|decode|10 MiB|empty/i);
});
it('retains exact hashes through review and clear, and never approves an upload automatically',async()=>{
 const f=await keyframeChangeScenario(),collection=f.state.collections[0],file=f.state.media[0],proof=f.sources.get(f.parent.id)!.frames.middle,target={shotId:f.shotId,sceneId:f.parent.id,frameId:'middle'},sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join(''),mediaProof={signature:frameMediaSignature(file),sha256};
 const linked=planFrameImageAssociation({collection,target,proof,media:file,mediaProof,expectedRevision:0,eventId:'first',now:f.parent.createdAt,kind:'link'});
 expect(linked.event.reviewStatus).toBe('needs_review');const reviewed=planFrameImageReview({collection:linked.collection,target,proof,media:file,mediaProof,expectedRevision:1,eventId:'review',now:f.parent.createdAt,reviewStatus:'approved',note:'Human synthetic review.'});
 expect(getActiveFrameImage(reviewed.collection.project!.frameProduction,target)?.sha256).toBe(sha256);
 const cleared=planFrameImageAssociation({collection:reviewed.collection,target,proof,expectedRevision:2,eventId:'clear',now:f.parent.createdAt,kind:'clear'});
 expect(cleared.collection.project!.frameProduction!.imageEvents.map(e=>e.id)).toEqual(['first','review','clear']);expect(getActiveFrameImage(cleared.collection.project!.frameProduction,target)).toBeUndefined();expect(linked.collection.project!.frameProduction!.imageEvents).toHaveLength(1);
});
it('enforces project history event and UTF8 metadata budgets without truncation',()=>{
 const production={version:1 as const,revision:2001,imageEvents:Array.from({length:2001},()=>({})) as never[],active:[],videoReviews:[]};expect(()=>validateFrameProductionBudget(production)).toThrow(/2,000/);
 production.imageEvents=[{note:'界'.repeat(1500000)}] as never[];expect(()=>validateFrameProductionBudget(production)).toThrow(/4 MiB/);
});
it.each(['approvalFlag','pointer','revision','hash','note','hook'])('rejects malformed history %s while allowing historical targets to be unavailable',async kind=>{
 const f=await keyframeChangeScenario(),file=f.state.media[0],proof=f.sources.get(f.parent.id)!.frames.middle;
 const linked=planFrameImageAssociation({collection:f.state.collections[0],target:{shotId:f.shotId,sceneId:f.parent.id,frameId:'middle'},proof,media:file,mediaProof:{signature:frameMediaSignature(file),sha256:'a'.repeat(64)},expectedRevision:0,eventId:'synthetic-event',now:f.parent.createdAt,kind:'link'}),production=linked.collection.project!.frameProduction!;
 expect(()=>validateFrameProduction(production)).not.toThrow();const changed=structuredClone(production) as any;
 if(kind==='approvalFlag')changed.imageEvents[0].approved=true;if(kind==='pointer')changed.active[0].eventId='foreign-event';if(kind==='revision')changed.imageEvents[0].revision=4;
 if(kind==='hash')changed.imageEvents[0].sha256='bad';if(kind==='note')changed.imageEvents[0].note='x'.repeat(1001);if(kind==='hook')changed.toJSON=()=>production;
 expect(()=>validateFrameProduction(changed)).toThrow();
});
it('accepts exactly 2,000 well-formed retained events within the metadata allowance',async()=>{
 const f=await keyframeChangeScenario(),file=f.state.media[0],proof=f.sources.get(f.parent.id)!.frames.middle,target={shotId:f.shotId,sceneId:f.parent.id,frameId:'middle'},linked=planFrameImageAssociation({collection:f.state.collections[0],target,proof,media:file,mediaProof:{signature:frameMediaSignature(file),sha256:'a'.repeat(64)},expectedRevision:0,eventId:'first',now:f.parent.createdAt,kind:'link'}),event=linked.event;
 const production={version:1 as const,revision:2000,active:[{...target,eventId:'event-2000'}],videoReviews:[],imageEvents:Array.from({length:2000},(_,index)=>({...event,id:`event-${index+1}`,revision:index+1}))};expect(()=>validateFrameProduction(production)).not.toThrow();
});
