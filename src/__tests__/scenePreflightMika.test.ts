import { describe, expect, it } from 'vitest';
import { runScenePreflight } from '../domain/scenePreflight';
import { serializeSceneJson } from '../domain/sceneDocument';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { legacyDraft } from './fixtures/legacyScene';

const gaze = 'Mika maintains direct eye contact with the camera while speaking.';
const rearCamera = "Position the camera about 135 degrees from the subject's forward axis, toward the left-rear side.";
const stylizedVideo = 'High-craft stylized 3D feature animation';

function mikaScene() {
  const scene = structuredClone(legacyDraft);
  scene.slots.character!.sourceTitle = 'Mika / Base Identity';
  scene.slots.character!.promptText = `Photorealistic identity.\n${scene.slots.character!.promptText}`;
  scene.slots.action!.promptText = gaze;
  scene.slots.camera!.promptText = rearCamera;
  scene.slots.style!.promptText = stylizedVideo;
  for (const slot of Object.values(scene.slots)) delete slot.overrideText;
  scene.dialogue = {speaker:'Mika',line:"Hello! I'm Mika.\n“Kumusta?” — Tara, let's go! 😊",mode:'on_camera'};
  return scene;
}

describe('actual Mika preflight examples', () => {
  it('reports rear gaze as Review and stylized identity as Information without a false speaker mismatch or mutation', () => {
    const scene = mikaScene();
    const before = structuredClone(scene);
    const project = serializeSceneJson(scene);
    const outputs = assembleScenePrompt(scene);
    const findings = runScenePreflight(scene);
    expect(findings.find(f => f.ruleId === 'P001')).toMatchObject({severity:'review',evidence:[
      {component:'action',text:gaze}, {component:'camera',text:rearCamera},
    ]});
    expect(findings.find(f => f.ruleId === 'P004')).toMatchObject({severity:'information'});
    expect(findings.find(f => f.ruleId === 'P004')!.evidence).toContainEqual({component:'style',text:stylizedVideo});
    expect(findings.some(f => f.ruleId === 'P005')).toBe(false);
    expect(scene).toEqual(before);
    expect(serializeSceneJson(scene)).toBe(project);
    expect(assembleScenePrompt(scene)).toEqual(outputs);
    expect(runScenePreflight(scene)).toEqual(findings);
  });

  it.each([
    rearCamera,
    rearCamera.replace('left-rear', 'right-rear'),
    rearCamera.replace('Position the camera', 'The camera is positioned'),
    'Position the camera 135° behind Mika, showing most of her back.',
  ])('P001 recognizes explicit rear camera placement: %s', camera => {
    const scene = mikaScene(); scene.slots.camera!.promptText = camera;
    expect(runScenePreflight(scene).find(f => f.ruleId === 'P001')?.severity).toBe('review');
  });

  it.each([
    `Do not ${rearCamera[0].toLowerCase()}${rearCamera.slice(1)}`,
    rearCamera.replace('Position', 'Never position'),
    rearCamera.replace('toward the left-rear', 'not toward the left-rear'),
    rearCamera.replace('toward the left-rear', 'avoid the left-rear'),
    rearCamera.replace('left-rear', 'left-front'),
    "Position the camera about 135 degrees from the subject's forward axis.",
    'A front three-quarter camera at eye level.',
    'The camera focuses on a logo on the left-rear side of the jacket.',
    `Example: “${rearCamera}”`,
  ])('P001 avoids negated, quoted and unsupported rear interpretations: %s', camera => {
    const scene = mikaScene(); scene.slots.camera!.promptText = camera;
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P001')).toBe(false);
  });

  it('P001 still requires positive lens gaze and does not read wardrobe placement as camera placement', () => {
    const scene = mikaScene();
    scene.slots.action!.promptText = 'Mika does not maintain direct eye contact with the camera while speaking.';
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P001')).toBe(false);
    scene.slots.action!.promptText = gaze;
    scene.slots.camera!.promptText = 'Front three-quarter view.';
    scene.slots.wardrobe!.promptText = 'A jacket with a logo on the left-rear side.';
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P001')).toBe(false);
  });

  it('P004 recognizes the actual stylized feature-animation wording as Information', () => {
    const scene = mikaScene();
    const finding = runScenePreflight(scene).find(f => f.ruleId === 'P004');
    expect(finding?.severity).toBe('information');
    expect(finding!.evidence).toContainEqual({component:'style',text:stylizedVideo});
    expect(finding!.evidence).toContainEqual({component:'character',text:scene.slots.character!.promptText});
  });

  it.each([
    `No ${stylizedVideo.toLowerCase()}.`,
    `Avoid ${stylizedVideo.toLowerCase()}.`,
    `Example: “${stylizedVideo}”`,
    'High-craft photorealistic 3D feature rendering.',
    'High-craft 3D feature animation.',
  ])('P004 does not infer stylization from a negation, example or 3D alone: %s', style => {
    const scene = mikaScene(); scene.slots.style!.promptText = style;
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P004')).toBe(false);
  });

  it('P004 requires a positive photorealistic direction', () => {
    const scene = mikaScene(); scene.slots.character!.promptText = 'Do not use a photorealistic identity.';
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P004')).toBe(false);
  });

  it.each([
    ['Mika', 'Mika / Base Identity'],
    [' mIkA ', '  MIKA /  Base   Identity  '],
    ['Mika', 'Mika/Base Identity'],
    ['Mika / Base Identity', 'Mika / Base Identity'],
    ['Mika Santos', 'Mika Santos / Base Identity'],
    ['Míka', 'Míka / Base Identity'],
  ])('P005 accepts the same name with a known identity suffix: %s / %s', (speaker,title) => {
    const scene = mikaScene(); scene.dialogue!.speaker = speaker; scene.slots.character!.sourceTitle = title;
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P005')).toBe(false);
  });

  it.each([
    ['Maya', 'Mika / Base Identity'],
    ['Mika', 'Mika Santos / Base Identity'],
    ['Mika', 'Mika / Maya'],
    ['Mika', 'Mika / Casual Outfit'],
    ['Mika', 'Míka / Base Identity'],
    ['Mika', 'Mikaela / Base Identity'],
  ])('P005 keeps different or ambiguous names under review: %s / %s', (speaker,title) => {
    const scene = mikaScene(); scene.dialogue!.speaker = speaker; scene.slots.character!.sourceTitle = title;
    expect(runScenePreflight(scene).find(f => f.ruleId === 'P005')).toMatchObject({severity:'review',evidence:[
      {component:'character',text:title}, {component:'dialogue',text:speaker},
    ]});
  });

  it.each(['voiceover','off_screen'] as const)('P005 preserves the intentional %s speaker exemption', mode => {
    const scene = mikaScene(); scene.dialogue = {...scene.dialogue!,speaker:'Another speaker',mode};
    expect(runScenePreflight(scene).some(f => f.ruleId === 'P005')).toBe(false);
  });
});
