import {it,expect} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {assembleImagePrompt} from '../domain/imagePromptDocument';
import {serializeSceneJson} from '../domain/sceneDocument';
import {serializeGenerationJson} from '../domain/generationDocument';
import {assembleScenePrompt} from '../domain/promptAssembler';
import {prepareKeyframeBasis} from '../domain/keyframeDependencies';
import {getIdentityRevision} from '../domain/identityAnchors';
import {syncEnsemblePrimary} from '../domain/ensemble';
it('builds complete standalone stills from captured identities, outfits and the exact chosen instant',async()=>{
 const {draft,media}=makeKeyframeFixture(),before=structuredClone(draft);
 draft.ensemble!.dialogueCues.push({id:'image-no-dialogue',participantId:'primary',mode:'on_camera',speaker:'Aya',line:'DIALOGUE_MUST_NOT_ENTER_IMAGE',performanceDirection:{version:1,styles:['angry']}});
 draft.sceneInstructions='UNADAPTED_VIDEO_INSTRUCTIONS';
 draft.slots.action!.promptText='UNADAPTED_ACTION_TRAJECTORY_OVER_TIME';
 const result=await assembleImagePrompt(draft,'middle',media);expect(result.ready,!result.ready?JSON.stringify(result.findings):'').toBe(true);
 if(!result.ready)throw Error('Complete synthetic Recipe must assemble.');
 for(const mode of ['full','compact'] as const){
  const text=result.snapshot[mode]!;expect(text).toContain(draft.ensemble!.participants[0].character.promptText);
  expect(text).toContain(draft.ensemble!.participants[1].character.promptText);
  expect(text).toContain(draft.ensemble!.participants[0].wardrobe!.promptText);
  expect(text).toContain(draft.slots.environment!.promptText);expect(text).toContain('chapel door');
  for(const forbidden of ['DIALOGUE_MUST_NOT_ENTER_IMAGE','UNADAPTED_VIDEO_INSTRUCTIONS','UNADAPTED_ACTION_TRAJECTORY_OVER_TIME',draft.ensemble!.participants.find(p=>p.id==='marco')!.character.promptText])expect(text).not.toContain(forbidden);
 }
 expect(result.snapshot.referenceProvenance.map(p=>p.association.associationId)).toEqual(before.keyframePlan!.frames[1].referenceAssociationIds);
 expect(result.snapshot.referenceProvenance.every(p=>/^[a-f0-9]{64}$/.test(p.sha256??''))).toBe(true);
});
it('excludes frame labels and timeline metadata from copied image text and preserves the separate video bytes',async()=>{
 const {draft,media}=makeKeyframeFixture(),video=assembleScenePrompt(draft).outputs,first=await assembleImagePrompt(draft,'middle',media);
 draft.keyframePlan!.frames[1].label='Renamed still';draft.keyframePlan!.frames[1].relativePosition=0.6;
 const second=await assembleImagePrompt(draft,'middle',media);
 expect(first.ready&&second.ready).toBe(true);
 if(first.ready&&second.ready){expect(second.snapshot.full).toBe(first.snapshot.full);expect(second.snapshot.visualDigest).toBe(first.snapshot.visualDigest);}
 expect(assembleScenePrompt(draft).outputs).toEqual(video);
});
it('accepts only an approved anchor owned by the captured Character and binds that choice into the visual digest',async()=>{
 const {draft,media}=makeKeyframeFixture(),p=draft.ensemble!.participants[0],revision=getIdentityRevision(p.character);
 p.character.identityAnchor={text:'Exact synthetic approved appearance.',approvedText:'Exact synthetic approved appearance.',approvedAt:'2026-11-03T00:00:00.000Z',approvedMasterIdentityRevision:revision};
 const before=await prepareKeyframeBasis(syncEnsemblePrimary(draft),media);
 p.generation={identitySource:'approved_anchor',anchor:{text:p.character.identityAnchor.text,approvedAt:p.character.identityAnchor.approvedAt!,approvedMasterIdentityRevision:revision}};
 const result=await assembleImagePrompt(syncEnsemblePrimary(draft),'middle',media);expect(result.ready,!result.ready?JSON.stringify(result.findings):'').toBe(true);
 if(result.ready){expect(result.snapshot.full).toContain('Exact synthetic approved appearance.');expect(result.snapshot.full).not.toContain(p.character.promptText);}
 const after=await prepareKeyframeBasis(syncEnsemblePrimary(draft),media);expect(after.frames.middle.visualDigest).not.toBe(before.frames.middle.visualDigest);
 p.generation.anchor!.text='Unapproved different identity';
 const invalid=await assembleImagePrompt(syncEnsemblePrimary(draft),'middle',media);expect(invalid.ready).toBe(false);
 if(!invalid.ready)expect(invalid.findings.some(f=>f.code==='IMAGE_IDENTITY')).toBe(true);
});
it('requires explicit still adaptation for arbitrary Camera, Action and Instructions instead of rewriting them',async()=>{
 const {draft,media}=makeKeyframeFixture();delete draft.keyframePlan!.stillSourceAdaptations;
 const missing=await assembleImagePrompt(draft,'middle',media);expect(missing.ready).toBe(false);
 if(!missing.ready)expect(missing.findings.some(f=>f.code==='IMAGE_ADAPTATION')).toBe(true);
 draft.keyframePlan!.stillSourceAdaptations={omittedSources:['camera','action','sceneInstructions']};
 expect((await assembleImagePrompt(draft,'middle',media)).ready).toBe(true);
});
it('retains recoverable planning and refuses to truncate a UTF-8 image prompt or exceed aggregate output budgets',async()=>{
 const {draft,media}=makeKeyframeFixture();draft.ensemble!.participants[0].character.promptText='界'.repeat(90000);
 const oversized=await assembleImagePrompt(syncEnsemblePrimary(draft),'middle',media);expect(oversized.ready).toBe(false);
 if(!oversized.ready)expect(oversized.findings.some(f=>f.code==='IMAGE_PROMPT_BYTES')).toBe(true);
 expect(draft.ensemble!.participants[0].character.promptText).toHaveLength(90000);
 const normal=makeKeyframeFixture(),one=await assembleImagePrompt(normal.draft,'middle',normal.media);if(!one.ready)throw Error('fixture');
 normal.draft.imagePromptSnapshots={start:{...one.snapshot,full:'x'.repeat(220000),compact:'x'.repeat(220000)},end:{...one.snapshot,full:'x'.repeat(220000),compact:'x'.repeat(220000)}};
 normal.draft.manualImageOutputs={start:{full:{text:'y'.repeat(220000),basedOnVisualDigest:one.snapshot.visualDigest,updatedAt:'2026-11-03T00:00:00.000Z'}}};
 const aggregate=await assembleImagePrompt(normal.draft,'middle',normal.media);expect(aggregate.ready).toBe(false);
 if(!aggregate.ready)expect(aggregate.findings.some(f=>f.code==='IMAGE_TAKE_BYTES')).toBe(true);
});
it('uses document4 only for C-bearing recipes and does not silently export Direct Prompt frame planning as complete output',async()=>{
 const {draft,media}=makeKeyframeFixture();expect(JSON.parse(serializeSceneJson(draft)).schema).toBe('krakinai.scene-prompt.v4');
 expect(JSON.parse(serializeGenerationJson(draft)).schema).toBe('krakinai.generation-prompt.v4');
 const plain={...draft,keyframePlan:undefined};expect(JSON.parse(serializeSceneJson(plain)).schema).toBe('krakinai.scene-prompt.v3');
 const direct={...draft,authoringMode:'direct_prompt' as const,directPrompt:{version:1 as const,text:'Original direct\r\nprompt'}};
 delete direct.blocking;
 expect((await assembleImagePrompt(direct,'middle',media)).ready).toBe(false);
 expect(()=>serializeSceneJson(direct)).toThrow(/guided|planning|Recipe/);expect(direct.directPrompt.text).toBe('Original direct\r\nprompt');
});
it('does not include a visible identity block for a participant explicitly outside the frame',async()=>{
 const {draft,media}=makeKeyframeFixture(),frame=draft.keyframePlan!.frames[1],primary=draft.ensemble!.participants[0];
 if(frame.instant?.kind!=='custom')throw Error('fixture');
 frame.instant.participants[0].phase.visibility='out_of_frame';frame.visualInstructions='Show Lucas at the altar while Aya remains outside the composition.';
 const result=await assembleImagePrompt(draft,'middle',media);expect(result.ready,!result.ready?JSON.stringify(result.findings):'').toBe(true);
 if(result.ready){expect(result.snapshot.full).not.toContain(primary.character.promptText);expect(result.snapshot.full).not.toContain(primary.wardrobe!.promptText);expect(result.snapshot.full).toContain('out of frame');}
});
