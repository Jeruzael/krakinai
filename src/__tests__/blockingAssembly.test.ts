import {it,expect} from 'vitest';
import {makeBlockingFixture} from './fixtures/blockingFixture';
import {assembleScenePrompt} from '../domain/promptAssembler';
import {buildSceneDocument,serializeSceneJson} from '../domain/sceneDocument';
import {buildGenerationDocument,serializeGenerationJson} from '../domain/generationDocument';
import {runScenePreflight} from '../domain/scenePreflight';
import {formatGenerationText} from '../domain/exportPresets';

it('assembles authored body, head, eyeline and action in every complete video mode without changing frozen inputs',()=>{
 const {draft}=makeBlockingFixture(),before=structuredClone(draft),result=assembleScenePrompt(draft);
 expect(result.errors).toEqual([]);
 for(const text of Object.values(result.outputs)){
  expect(text).toMatch(/Blocking & spatial direction/i);
  expect(text).toContain('Body: toward Altar [landmark:altar]');
  expect(text).toContain('Head: toward Chapel door [landmark:door]');
  expect(text).toContain('Eyeline: Chapel door [landmark:door]');
  expect(text).toContain('Walk to the aisle midpoint, stop, and turn her head toward the chapel door.');
  expect(text).toContain('Bridal bouquet');
  for(const cue of draft.ensemble!.dialogueCues)expect(text).toContain(cue.line);
 }
 expect(draft).toEqual(before);
});
it('uses v3 scene/generation documents with the same authoritative blocking and unchanged foundation',()=>{
 const {draft}=makeBlockingFixture(),legacy=buildSceneDocument({...draft,blocking:undefined}),doc=buildSceneDocument(draft),generation=buildGenerationDocument(draft);
 expect(doc.schema).toBe('krakinai.scene-prompt.v3');expect(generation.schema).toBe('krakinai.generation-prompt.v3');
 expect(JSON.parse(serializeSceneJson(draft)).blocking).toEqual(JSON.parse(serializeGenerationJson(draft)).blocking);
 expect(doc.components).toEqual(legacy.components);expect(doc.dialogueCues).toEqual(legacy.dialogueCues);expect(doc.participants).toEqual(legacy.participants);expect(doc.referenceFiles).toEqual(legacy.referenceFiles);
});
it('uses source participant order and stable landmark/prop IDs while preserving authored interaction order',()=>{
 const {draft}=makeBlockingFixture();
 draft.blocking!.participants[0].action!.interactions=[{id:'gesture-first',kind:'custom',description:'First gesture exactly.'},{id:'gesture-second',kind:'custom',description:'Second gesture exactly.'}];
 const first=assembleScenePrompt(draft).outputs;
 draft.blocking!.participants.reverse();draft.blocking!.landmarks.reverse();draft.blocking!.props.reverse();
 expect(assembleScenePrompt(draft).outputs).toEqual(first);
 expect(first.full.indexOf('First gesture exactly.')).toBeLessThan(first.full.indexOf('Second gesture exactly.'));
});
it('keeps invalid authored blocking recoverable but refuses partial canonical output/export and reports an actionable preflight source',()=>{
 const {draft,state}=makeBlockingFixture();draft.blocking!.participants[0].end!.eyeline={kind:'landmark',landmarkId:'missing'};const before=structuredClone(draft);
 const result=assembleScenePrompt(draft);expect(result.valid).toBe(false);expect(result.errors.join('\n')).toMatch(/blocking/i);expect(result.outputs.full).toBe('');
 expect(()=>serializeSceneJson(draft)).toThrow(/blocking/i);expect(()=>serializeGenerationJson(draft)).toThrow(/blocking/i);
 const findings=runScenePreflight(draft,new Map(state.media.map(m=>[m.id,m])));
 expect(findings.some(f=>f.severity==='blocking'&&f.components.some(c=>String(c)==='blocking'))).toBe(true);expect(findings.some(f=>f.suggestedActions.some(a=>/Blocking/.test(a)))).toBe(true);
 expect(draft).toEqual(before);
});
it('supports an actual legacy primary Character without inventing an ensemble participant',()=>{
 const {draft}=makeBlockingFixture();draft.ensemble=undefined;draft.dialogue=undefined;
 draft.blocking!.participants=[{...draft.blocking!.participants[0],participant:{kind:'primary'}}];
 draft.blocking!.props[0].startHolder={kind:'participant',participant:{kind:'primary'}};draft.blocking!.props[0].endHolder={kind:'participant',participant:{kind:'primary'}};
 draft.blocking!.camera={direction:{kind:'landmark',landmarkId:'altar'}};
 expect(assembleScenePrompt(draft).valid).toBe(true);const doc=buildSceneDocument(draft);expect(doc.schema).toBe('krakinai.scene-prompt.v3');expect(doc.participants).toBeUndefined();
 expect(assembleScenePrompt(draft).outputs.full).toContain('[primary]');
});
it('does not bind inactive Character and Environment snapshots after switching to an original-source shot type',()=>{
 const {draft}=makeBlockingFixture();draft.ensemble=undefined;draft.dialogue=undefined;draft.shotType='graphic_motion';
 draft.blocking!.participants=[{...draft.blocking!.participants[0],participant:{kind:'primary'}}];draft.blocking!.props=[];draft.blocking!.camera=undefined;
 expect(()=>assembleScenePrompt(draft)).not.toThrow();
 expect(assembleScenePrompt(draft).errors.join('\n')).toMatch(/Blocking/);
});
it('rejects unsupported blocking on Direct Prompt JSON instead of silently dropping it',()=>{
 const {draft}=makeBlockingFixture();const direct={...draft,authoringMode:'direct_prompt' as const,ensemble:undefined,directPrompt:{version:1 as const,text:'Original exact prompt.'}};
 expect(()=>serializeSceneJson(direct)).toThrow(/recipe|blocking/i);expect(()=>serializeGenerationJson(direct)).toThrow(/recipe|blocking/i);
});
it('does not infer performers, movement or positions from optional unspecified planning',()=>{
 const {draft}=makeBlockingFixture();draft.blocking={version:1,participants:[],landmarks:[{id:'door',label:'Chapel door'}],props:[]};
 const text=assembleScenePrompt(draft).outputs.full;
 expect(text).toMatch(/Blocking & spatial direction/i);expect(text.slice(text.indexOf('## Blocking & spatial direction'))).not.toContain('Walk to the aisle midpoint');
 expect(text).not.toContain('No movement');
});
it.each(['generic_structured','gemini_omni_flash','custom'] as const)('preserves authored blocking in the %s local generation-text export',preset=>{
 const {draft}=makeBlockingFixture(),text=formatGenerationText(draft,preset);
 expect(text).toMatch(/Blocking & spatial direction/i);expect(text).toContain('Head: toward Chapel door [landmark:door]');
 for(const cue of draft.ensemble!.dialogueCues)expect(text).toContain(cue.line);
});
