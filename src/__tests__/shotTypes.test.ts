import { describe, expect, it } from 'vitest';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { buildSceneDocument } from '../domain/sceneDocument';
import { buildGenerationDocument } from '../domain/generationDocument';
import { runScenePreflight } from '../domain/scenePreflight';
import { legacyDraft } from './fixtures/legacyScene';
import type { SceneDraft } from '../types/domain';
import { getActiveReferencePack, getActiveSceneSlots, getShotTypeRules, getSourceReferenceEntries, validateShotSourceMedia } from '../domain/shotTypeRules';
import { serializeSceneJson } from '../domain/sceneDocument';

const instructions = 'Preserve the provided floor-plan geometry, dimensions, room labels and proportions. Introduce a subtle zoom, highlight the two bedrooms and then the living/dining area. Do not redraw the original graphic or invent architectural information.';
const sourceLink = {mediaId:'floor-plan',role:'reference' as const,altText:'Original two-bedroom floor-plan',order:0,filename:'two-bedroom.png',mimeType:'image/png'};
const graphic = (): SceneDraft => Object.assign(structuredClone(legacyDraft), {
  title:'MIDORI / 03 — Floor Plan',shotType:'graphic_motion',slots:{},dialogue:undefined,
  extraRequiredSlots:['environment','action'],sourceMediaLinks:[{...sourceLink}],
  sceneInstructions:instructions,settings:{aspectRatio:'9:16',durationSeconds:4},
});

describe('context-aware assembly', () => {
  it('assembles the exact MIDORI floor-plan specification without fake component assets', () => {
    const draft=graphic();
    const result=assembleScenePrompt(draft);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.outputs.structured).toContain('Graphic / Motion Design');
    expect(result.outputs.structured).toContain(instructions);
    expect(result.references).toEqual([sourceLink]);
    const doc=buildSceneDocument(draft);
    expect(doc.scene).toMatchObject({type:'single_shot',shotType:'graphic_motion'});
    expect(buildGenerationDocument(draft).scene).toMatchObject({type:'single_shot',shotType:'graphic_motion'});
    expect(buildGenerationDocument(draft).references).toHaveLength(1);
    expect(buildGenerationDocument(draft).references[0].sourceSlot).toBe('source');
  });
  it('shares conditional dialogue and template requirements without changing explicit legacy character output', () => {
    const legacy=structuredClone(legacyDraft);
    expect(assembleScenePrompt({...legacy,shotType:'character_scene'}).outputs).toEqual(assembleScenePrompt(legacy).outputs);
    expect(serializeSceneJson({...legacy,shotType:'character_scene'})).toBe(serializeSceneJson(legacy));
    const draft=graphic();draft.dialogue={speaker:'Narrator',line:'',mode:'voiceover'};
    expect(getShotTypeRules(draft).requiredSlots).toEqual([]);
    expect(getShotTypeRules(draft).conditionalCharacterRequired).toBe(false);
    draft.dialogue.mode='spoken';expect(getShotTypeRules(draft).conditionalCharacterRequired).toBe(true);
    expect(getShotTypeRules(legacy).requiredSlots).toContain('environment');
  });
  it('keeps the original required in an explicit empty pack and removes inactive source entries reversibly', () => {
    const draft=graphic();draft.slots={camera:legacyDraft.slots.camera};
    const camera={...getSourceReferenceEntries(draft)[0],associationId:'camera',mediaId:'camera-image',sourceSlot:'camera' as const,order:1};
    draft.referencePack={version:1,entries:[camera]};
    const before=structuredClone(draft);
    const pack=getActiveReferencePack(draft)!;
    expect(pack.entries.map(e=>e.order)).toEqual([0,1]);
    expect(pack.entries.some(e=>e.sourceSlot==='source')).toBe(true);
    expect(getActiveReferencePack({...draft,shotType:'character_scene',referencePack:pack})!.entries).toEqual([camera].map(e=>({...e,order:0})));
    expect(draft).toEqual(before);
    expect(getActiveSceneSlots({...draft,shotType:'character_scene'})).toEqual(draft.slots);
  });
  it('validates actual stored source MIME/bytes and rejects an output-role source', () => {
    const draft=graphic();const blob=new Blob(['opaque unit fixture'],{type:'video/mp4'});
    const map=new Map([['floor-plan',{id:'floor-plan',filename:'video.mp4',safeFilename:'video.mp4',mimeType:'video/mp4',byteSize:blob.size,blob,createdAt:'2026-10-28'}]]);
    expect(validateShotSourceMedia(draft,map).join(' ')).toMatch(/unsupported MIME/);
    expect(runScenePreflight(draft,map).some(f=>f.severity==='blocking')).toBe(true);
    Object.assign(draft,{sourceMediaLinks:[{...sourceLink,role:'result'}]});
    expect(validateShotSourceMedia(draft).join(' ')).toMatch(/input reference/);
  });
  it('does not leak inactive identity, wardrobe, environment, action, lighting or negatives', () => {
    const draft=graphic();draft.slots=structuredClone(legacyDraft.slots);
    const before=structuredClone(draft);
    const doc=buildGenerationDocument(draft);
    expect(doc.character).toBeNull();expect(doc.environment).toBeNull();
    expect(doc.wardrobe).toBeNull();expect(doc.action).toBeNull();expect(doc.lighting).toBeNull();
    expect(doc.negativeInstructions.join(' ')).not.toContain('facial');
    expect(assembleScenePrompt(draft).references.map(l=>l.mediaId)).not.toContain('media_asset_char_maya');
    expect(draft).toEqual(before);
  });
  it('requires an image and authored animation instructions', () => {
    const draft=graphic();Object.assign(draft,{sourceMediaLinks:[],sceneInstructions:' '});
    expect(assembleScenePrompt(draft).errors.join(' ')).toMatch(/source image/i);
    expect(assembleScenePrompt(draft).errors.join(' ')).toMatch(/animation instructions/i);
    Object.assign(draft,{sourceMediaLinks:[{...sourceLink,mimeType:'video/mp4'}],sceneInstructions:instructions});
    expect(assembleScenePrompt(draft).valid).toBe(false);
  });
  it('allows exact voiceover without a visible character but blocks on-camera speech', () => {
    const draft=graphic();draft.dialogue={speaker:'MIDORI Narrator',line:'  Two bedrooms.\nDalawang kuwarto.  ',mode:'voiceover'};
    expect(assembleScenePrompt(draft).errors).toEqual([]);
    expect(buildGenerationDocument(draft).dialogue?.exactLine).toBe(draft.dialogue.line);
    draft.dialogue.mode='on_camera';expect(assembleScenePrompt(draft).errors.join(' ')).toMatch(/Character/);
  });
  it('makes source failures blocking while suppressing unrelated graphic contradiction checks', () => {
    const draft=graphic();draft.sceneInstructions+=' Camera is static. Camera moves. Photorealistic cartoon. Daylight at nighttime.';
    const findings=runScenePreflight(draft,new Set());
    expect(findings.some(f=>f.severity==='blocking'&&/source/i.test(f.title))).toBe(true);
    expect(findings.some(f=>['P001','P002','P003','P004','P006','P007'].includes(f.ruleId))).toBe(false);
  });
  it('requires only Environment for property scenes and video/instructions for footage', () => {
    const property=graphic();Object.assign(property,{shotType:'property_environment',slots:{environment:legacyDraft.slots.environment},sourceMediaLinks:[]});
    expect(assembleScenePrompt(property).errors).toEqual([]);
    const footage=graphic();Object.assign(footage,{shotType:'existing_footage',sourceMediaLinks:[{...sourceLink,mimeType:'video/mp4',filename:'original.mp4'}]});
    expect(assembleScenePrompt(footage).errors).toEqual([]);
    expect(assembleScenePrompt(footage).outputs.full).toContain('Editing Instructions');
  });
});
