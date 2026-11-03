import {it,expect} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {assembleImagePrompt} from '../domain/imagePromptDocument';
import {collectReferenceCandidates} from '../domain/referencePack';
import {blockingBindingToken} from '../domain/blockingValidation';
const staticIds=['shot-size.medium-shot','camera-placement.eye-level','camera-placement.high-angle','camera-placement.level-neutral-horizon','framing.over-the-shoulder','optics.standard-normal-lens','focus.shallow-depth-of-field','composition.rule-of-thirds'];
it.each(staticIds)('projects only the reviewed static contribution %s without camera motion parameters',async id=>{
 const {draft,media}=makeKeyframeFixture();draft.keyframePlan!.stillSourceAdaptations!.omittedSources=['camera'];delete draft.keyframePlan!.stillSourceAdaptations!.camera;
 draft.slots.camera!.cameraComposition={version:1,techniqueIds:[id,'movement.dolly-in-out'],parameters:{focalLengthMm:50,apertureFNumber:2.8,movementSeconds:8,path:'TEMPORAL_PATH_NOT_STILL',endFraming:'TEMPORAL_END_NOT_STILL'}};
 const result=await assembleImagePrompt(draft,'middle',media);expect(result.ready).toBe(true);
 if(result.ready){expect(result.snapshot.full).toContain('50 mm');expect(result.snapshot.full).toContain('f/2.8');for(const text of ['TEMPORAL_PATH_NOT_STILL','TEMPORAL_END_NOT_STILL','8 seconds'])expect(result.snapshot.full).not.toContain(text);}
});
it('does not treat temporal techniques inside static dimensions as still directions',async()=>{
 const {draft,media}=makeKeyframeFixture();draft.slots.camera!.cameraComposition={version:1,techniqueIds:['shot-size.variable-shot-size-within-a-continuous-move','focus.rack-focus-focus-pull']};
 const result=await assembleImagePrompt(draft,'middle',media);expect(result.ready).toBe(true);
 if(result.ready){expect(result.snapshot.full).not.toContain('within a continuous');expect(result.snapshot.full).not.toContain('rack focus');}
});
it('lets an explicitly authored frame viewpoint override the inherited still camera without contradicting it',async()=>{
 const {draft,media}=makeKeyframeFixture();draft.slots.camera!.cameraComposition={version:1,techniqueIds:['camera-placement.eye-level']};
 draft.keyframePlan!.frames[1].composition={instructions:'An overhead view of the specified chapel geography.'};
 const result=await assembleImagePrompt(draft,'middle',media);expect(result.ready).toBe(true);
 if(result.ready){expect(result.snapshot.full).toContain('An overhead view');expect(result.snapshot.full).not.toContain('Eye-level camera viewpoint.');expect(result.snapshot.full).not.toContain('A medium rear three-quarter still composition at eye level.');}
});
it('supports the existing single-Character recipe and rejects a foreign-owned Outfit without changing identity',async()=>{
 const {draft,media}=makeKeyframeFixture();delete draft.ensemble;delete draft.blocking;
 const character=draft.slots.character!,wardrobe=draft.slots.wardrobe!;
 draft.referencePack={version:1,entries:collectReferenceCandidates(draft,media)};
 draft.keyframePlan!.frames=[{id:'single',label:'Single',role:'custom',participantRefs:[{kind:'primary'}],instant:{kind:'custom',participants:[{participant:{kind:'primary'},bindingToken:blockingBindingToken(character),wardrobeBindingToken:blockingBindingToken(wardrobe),phase:{visibility:'on_screen',zone:'center',pose:'Hold the bouquet still.'}}]},referenceAssociationIds:draft.referencePack.entries.map(e=>e.associationId)}];
 const valid=await assembleImagePrompt(draft,'single',media);expect(valid.ready).toBe(true);if(valid.ready)expect(valid.snapshot.full).toContain(character.promptText);
 wardrobe.parentCharacterId='foreign-character';
 const invalid=await assembleImagePrompt(draft,'single',media);expect(invalid.ready).toBe(false);
 if(!invalid.ready)expect(invalid.findings.some(f=>f.code==='IMAGE_WARDROBE')).toBe(true);
 expect(draft.slots.character!.sourceId).toBe(character.sourceId);
});
function graphic(){
 const f=makeKeyframeFixture(),{draft}=f;draft.shotType='graphic_motion';delete draft.ensemble;delete draft.blocking;
 draft.keyframePlan!.stillSourceAdaptations={camera:'Keep the original source geometry and viewpoint.',action:'One unchanged still.',sceneInstructions:'Preserve the original labels and proportions.'};
 draft.sceneInstructions='Preserve the original synthetic plan.';
 const file=f.media.values().next().value!;draft.sourceMediaLinks=[{mediaId:file.id,role:'reference',altText:'Synthetic original plan',order:0,mimeType:'image/png'}];
 draft.referencePack={version:1,entries:collectReferenceCandidates(draft,f.media)};
 draft.keyframePlan!.frames=[{id:'graphic',label:'Plan still',role:'custom',participantRefs:[],visualInstructions:'Show the unchanged original plan geometry.',instant:{kind:'custom',participants:[]},referenceAssociationIds:draft.referencePack.entries.map(e=>e.associationId)}];
 return f;
}
it('preserves original graphic geometry and uses current stored-source validation for missing, unsupported or inconsistent files',async()=>{
 const f=graphic(),valid=await assembleImagePrompt(f.draft,'graphic',f.media);expect(valid.ready).toBe(true);
 if(valid.ready){expect(valid.snapshot.full).toContain('Preserve its geometry, dimensions, labels and proportions.');expect(valid.snapshot.full).not.toContain('Aya');}
 const first=f.media.values().next().value!;
 for(const variant of [new Map(),new Map([[first.id,{...first,mimeType:'image/bmp'}]]),new Map([[first.id,{...first,byteSize:first.byteSize+1}]]),new Map([[first.id,{...first,blob:new Blob([new Uint8Array([1,2])],{type:'image/png'})}]])]){
  const result=await assembleImagePrompt(f.draft,'graphic',variant);expect(result.ready).toBe(false);if(!result.ready)expect(result.findings.some(f=>f.code==='IMAGE_SOURCE_MEDIA')).toBe(true);
 }
});
