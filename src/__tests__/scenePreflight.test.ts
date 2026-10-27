import { describe, expect, it } from 'vitest';
import { runScenePreflight } from '../domain/scenePreflight';
import type { SceneDocumentSource } from '../domain/sceneDocument';
import { legacyDraft } from './fixtures/legacyScene';
const source = () => { const s: typeof legacyDraft & SceneDocumentSource = structuredClone(legacyDraft); for (const snap of Object.values(s.slots)) { snap.promptText = ''; delete snap.overrideText; snap.mediaLinks = []; } s.slots.environment!.promptText='Park'; s.slots.action!.promptText='Standing'; s.dialogue=undefined; s.sceneInstructions=''; return s; };
it('checks missing explicitly selected pack metadata even when original association is unavailable', () => {
  const s = source();
  s.referencePack = {version:1,entries:[{associationId:'orphan',mediaId:'missing',sourceSlot:'character',sourceId:'old',sourceTitle:'Historical',role:'reference',altText:'portrait',purpose:'identity',order:0}]};
  expect(runScenePreflight(s,new Set()).some(f => f.ruleId === 'P008')).toBe(true);
});
describe('scene preflight', () => {
  it.each([
    ['P001','Looks directly into the camera.','Rear view, camera behind the subject.'],
    ['P002','Camera locked off.','Camera dollies forward.'],
    ['P003','Morning daylight.','Blue-hour evening lighting.'],
    ['P004','Photorealistic.','Fully stylized 3D cartoon.'],
  ])('detects %s with exact evidence', (rule, action, camera) => { const s=source(); s.slots.action!.promptText=action; s.slots.camera!.promptText=camera; const f=runScenePreflight(s).find(x=>x.ruleId===rule); expect(f?.evidence.map(x=>x.text)).toEqual([action,camera]); expect(f?.severity).toBe(rule==='P004'?'information':'review'); });
  it('does not flag negated, quoted identity examples or front three-quarter directions',()=> { const s=source(); s.slots.character!.promptText='Examples: “looks directly into the camera”, “rear view”.'; s.slots.action!.promptText='Do not look directly into the camera. No morning daylight. Not photorealistic.'; s.slots.camera!.promptText='Front three-quarter view. Camera locked off, no dolly movement.'; s.slots.lighting!.promptText='Evening lighting.'; expect(runScenePreflight(s).filter(x=>x.ruleId!=='P000')).toEqual([]); });
  it('detects speaker mismatch and visible speech while exempting voiceover and off-screen',()=> { const s=source(); s.slots.character!.sourceTitle='Mika'; s.dialogue={speaker:'Sample shot',line:'Hello',mode:'on_camera',deliveryNotes:'Visible lip movement'}; s.slots.camera!.promptText='Rear view.'; expect(runScenePreflight(s).map(x=>x.ruleId)).toEqual(expect.arrayContaining(['P005','P007'])); for(const mode of ['voiceover','off_screen'] as const) { s.dialogue.mode=mode; expect(runScenePreflight(s).some(x=>['P005','P007'].includes(x.ruleId))).toBe(false); } });
  it('blocks assembler validation and parent mismatch, reports missing IDs without mutation',()=> { const s=source(); s.slots.action!.sourceType='variant'; s.slots.action!.parentCharacterId='different'; s.title=''; s.references=[{mediaId:'missing',role:'reference',order:0,altText:''}]; const before=structuredClone(s); const findings=runScenePreflight(s,new Set()); expect(findings.find(x=>x.ruleId==='P000')?.severity).toBe('blocking'); expect(findings.find(x=>x.ruleId==='P006')?.severity).toBe('blocking'); expect(findings.find(x=>x.ruleId==='P008')?.evidence[0].text).toBe('missing'); expect(s).toEqual(before); expect(runScenePreflight(s,new Set())).toEqual(findings); s.references![0].mediaId='changed'; expect(runScenePreflight(s,new Set()).find(x=>x.ruleId==='P008')?.id).not.toBe(findings.find(x=>x.ruleId==='P008')?.id); });
});
it('checks explicit master style but ignores its incidental gaze examples',()=>{ const s=source(); s.slots.character!.promptText='Photorealistic identity. Example: “looks directly into the camera”.'; s.slots.style!.promptText='Fully stylized cartoon.'; s.slots.camera!.promptText='Position the camera 135° behind Mika, showing most of her back.'; s.slots.action!.promptText='Looks directly into the camera.'; s.dialogue={speaker:'Mika',line:'Hello',mode:'on_camera'}; expect(runScenePreflight(s).map(f=>f.ruleId)).toEqual(expect.arrayContaining(['P001','P004','P007'])); });

it('keeps every separate assembler validation error visible',()=>{ const s=source(); delete s.slots.character; s.dialogue={speaker:'',line:'',mode:'on_camera'}; const blockers=runScenePreflight(s).filter(f=>f.ruleId==='P000'); expect(blockers.map(f=>f.title)).toEqual(expect.arrayContaining(['Dialogue requires a selected Character in the scene.','Dialogue requires a speaker label.'])); });
