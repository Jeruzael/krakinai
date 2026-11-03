import {expect,it} from 'vitest';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
import {allocationFor} from './fixtures/changeSetFixture';
import {planChangeSet} from '../domain/changeSetPlanner';
import {prepareKeyframeChangeSet} from '../domain/keyframeChangeSet';
import {canonicalStringify} from '../domain/changeSetCanonical';
const blocks=(p:ReturnType<typeof planChangeSet>)=>p.findings.filter(f=>f.severity==='blocking');
async function plan(f:Awaited<ReturnType<typeof keyframeChangeScenario>>){const allocation=allocationFor(f.input),context=await prepareKeyframeChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs);return planChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs,context);}
it('revises one exact frame in a new immutable take and preserves all unrelated strings and preference',async()=>{
 const f=await keyframeChangeScenario(),before=canonicalStringify(f.state),p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.scenes).toHaveLength(1);
 const next=p.scenes[0];expect(next.id).not.toBe(f.parent.id);expect(next.keyframePlan!.frames[1].visualInstructions).toContain('chapel door');
 for(const id of ['start','end'])expect(next.imagePromptSnapshots![id]).toEqual(f.parent.imagePromptSnapshots![id]);
 expect(next.outputs).toEqual(f.parent.outputs);expect(next.ensemble).toEqual(f.parent.ensemble);expect(next.slots).toEqual(f.parent.slots);
 expect(p.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);expect(canonicalStringify(f.state)).toBe(before);
 expect((p.operations[0].resolved as any).keyframes.differences.visuallyChangedFrameIds).toEqual(['middle']);
});
it.each(['source','digest','revision','membership','approval','video'])('blocks stale or unapproved %s',async kind=>{
 const f=await keyframeChangeScenario();if(kind==='source')f.parent.outputs.full+='foreign';if(kind==='digest')f.op.expectedKeyframeDigest='0'.repeat(64);if(kind==='revision')f.op.expectedSourceRevision++;
 if(kind==='membership')f.state.collections[0].project!.shots[1].takeSceneIds=[];if(kind==='approval')f.approval.keyframes=false;if(kind==='video')delete (f.op as any).videoDecision;
 expect(blocks(await plan(f)).length).toBeGreaterThan(0);
});
it('reorders frames without swapping images, rebuilding unrelated snapshots or changing saved source text',async()=>{
 const f=await keyframeChangeScenario();Object.assign(f.op.keyframes,{frameUpserts:[],frameOrder:['end','middle','start']});
 const p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.scenes[0].keyframePlan!.frames.map(x=>x.id)).toEqual(['end','middle','start']);expect(p.scenes[0].imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);
 expect((p.operations[0].resolved as any).keyframes.differences.videoReviewRequired).toBe(true);
});
it('links only actual existing images to exact take/frame/revision targets and requires separate approval',async()=>{
 const f=await keyframeChangeScenario(),target={project:f.op.project,shot:f.op.shot,scene:{id:f.parent.id},frameId:'middle',expectedSceneRevision:f.parent.revision,expectedFrameDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0};
 const link={operationId:'link',type:'frame_image.link' as const,...target,mediaId:f.state.media[0].id};f.input.operations=[link];
 f.approval.frameImages=true;
 let p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.results[0].status).toBe('updated');
 expect(p.collections[0].project!.frameProduction!.imageEvents[0]).toEqual(expect.objectContaining({sceneId:f.parent.id,frameId:'middle',mediaId:link.mediaId,reviewStatus:'needs_review'}));
 link.mediaId='guessed-image';expect(blocks(await plan(f)).length).toBeGreaterThan(0);link.mediaId=f.state.media[0].id;
 link.shot={id:'shot-before'};expect(blocks(await plan(f)).length).toBeGreaterThan(0);link.shot=f.op.shot;
 link.expectedAssociationRevision=1;expect(blocks(await plan(f)).length).toBeGreaterThan(0);link.expectedAssociationRevision=0;
 f.approval.frameImages=false;expect(blocks(await plan(f)).some(x=>x.code==='APPROVAL_FRAME_IMAGES')).toBe(true);
});
it('links a same-batch new take by client reference without changing its preferred take',async()=>{
 const f=await keyframeChangeScenario();f.approval.frameImages=true;
 const allocation=allocationFor(f.input),context=await prepareKeyframeChangeSet(f.input,f.approval,f.state,allocation,new Map(),f.proofs),digest=context.prepared.get('revise')!.basis.frames.middle.visualDigest;
 f.input.operations.push({operationId:'link',type:'frame_image.link',project:f.op.project,shot:f.op.shot,scene:{ref:'new-take'},frameId:'middle',expectedFrameDigest:digest,expectedAssociationRevision:0,mediaId:f.state.media[0].id});
 const p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.collections[0].project!.frameProduction!.imageEvents[0].sceneId).toBe(p.scenes[0].id);expect(p.collections[0].project!.shots[1].selectedSceneId).toBe(f.parent.id);
});
it('adds and removes exact stable frame IDs without altering the remaining frame outputs',async()=>{
 const f=await keyframeChangeScenario(),middle=f.parent.keyframePlan!.frames[1];
 f.op.keyframes={version:1,expectedBaseDigest:f.op.expectedKeyframeDigest,frameUpserts:[{...structuredClone(middle),id:'middle-new',label:'New middle',instant:{kind:'linked_phase',phase:'start'}}],removeFrameIds:['middle'],frameOrder:['start','middle-new','end']} as any;
 const p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.scenes[0].keyframePlan!.frames.map(x=>x.id)).toEqual(['start','middle-new','end']);
 expect(p.scenes[0].imagePromptSnapshots!.middle).toBeUndefined();expect(p.scenes[0].imagePromptSnapshots!.start).toEqual(f.parent.imagePromptSnapshots!.start);
});
it('requests video review against an exact saved basis without approving or rewriting its text',async()=>{
 const f=await keyframeChangeScenario(),before=structuredClone(f.parent);
 f.input.operations=[{operationId:'review',type:'frame_video.request_review',project:f.op.project,shot:f.op.shot,scene:{id:f.parent.id},expectedSceneRevision:f.parent.revision,expectedKeyframeDigest:f.op.expectedKeyframeDigest}];
 const p=await plan(f);expect(blocks(p)).toEqual([]);expect(p.collections[0].project!.frameProduction!.videoReviews[0].kind).toBe('requested');expect(f.parent).toEqual(before);
});
it('carries only explicitly selected unchanged images to the new take and resets their review',async()=>{
 const f=await keyframeChangeScenario(),media=f.state.media[0],frame=f.sources.get(f.parent.id)!.frames.start;
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await media.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
 f.state.collections[0].project!.frameProduction={version:1,revision:1,active:[{shotId:f.shotId,sceneId:f.parent.id,frameId:'start',eventId:'old-image'}],imageEvents:[{id:'old-image',revision:1,kind:'reviewed',shotId:f.shotId,sceneId:f.parent.id,frameId:'start',mediaId:media.id,sha256,...frame,reviewStatus:'approved',provenance:{kind:'existing_media'},createdAt:f.parent.createdAt}],videoReviews:[]};
 f.op.imageCarryOver=[{frameId:'start',associationId:'old-image',expectedRevision:1}];f.approval.frameImages=true;
 const p=await plan(f);expect(blocks(p)).toEqual([]);const events=p.collections[0].project!.frameProduction!.imageEvents;
 expect(events).toHaveLength(2);expect(events[1]).toEqual(expect.objectContaining({frameId:'start',sceneId:p.scenes[0].id,mediaId:media.id,reviewStatus:'needs_review',provenance:{kind:'carry_over',sourceEventId:'old-image'}}));
 f.op.imageCarryOver=[{frameId:'middle',associationId:'old-image',expectedRevision:1}];expect(blocks(await plan(f)).length).toBeGreaterThan(0);
});
it('rejects a corrupt same-size raster candidate even when its MIME and metadata are consistent',async()=>{
 const f=await keyframeChangeScenario(),source=f.state.media[0],candidate={...source,id:'corrupt-frame-only',filename:'synthetic-corrupt.png',blob:new Blob([new Uint8Array(source.byteSize).fill(0)],{type:source.mimeType})};f.state.media.push(candidate);f.approval.frameImages=true;
 f.input.operations=[{operationId:'link',type:'frame_image.link',project:f.op.project,shot:f.op.shot,scene:{id:f.parent.id},expectedSceneRevision:f.parent.revision,frameId:'middle',expectedFrameDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0,mediaId:candidate.id}];
 expect(blocks(await plan(f)).some(f=>f.code==='FRAME_IMAGE_MEDIA')).toBe(true);
});
