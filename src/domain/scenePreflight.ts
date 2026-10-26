import type { BuilderSlot, SceneDraft } from '../types/domain';
import { buildSceneDocument, SCENE_COMPONENT_ORDER, type SceneDocumentSource } from './sceneDocument';
import { assembleScenePrompt } from './promptAssembler';
export type PreflightComponent = BuilderSlot | 'dialogue' | 'settings' | 'instructions' | 'references';
export interface PreflightFinding {
  id: string;
  ruleId: 'P000'|'P001'|'P002'|'P003'|'P004'|'P005'|'P006'|'P007'|'P008';
  severity: 'blocking'|'review'|'information';
  title: string;
  components: PreflightComponent[];
  evidence: {component: PreflightComponent; text: string}[];
  explanation: string;
  suggestedActions: string[];
}
type Evidence = PreflightFinding['evidence'][number];
// Match positive, explicit clauses only. Quoted illustrative passages are excluded.
function positive(text: string, pattern: RegExp): boolean {
  return text.replace(/[“"][^”"]*[”"]/g, '').split(/[.;\n]|\bbut\b|,/i).some(clause => {
    const match=pattern.exec(clause);
    return match !== null && !/\b(?:no|not|never|without|avoid|don't|doesn't|isn't|do not)\b/i.test(clause.slice(0,match.index));
  });
}

// A rear-side location needs an explicit camera-placement instruction. Keep its
// comma-linked direction together so "do not position ... , toward ..." stays
// negated. Angles alone and rear details on clothing are not camera placement.
function positiveRearPlacement(text: string): boolean {
  const placement = /\b(?:(?:position|place|locate|set)\s+(?:the\s+)?camera|(?:the\s+)?camera\s+(?:is\s+)?(?:positioned|placed|located|set))\b[^.;\n]*?\b(?:left|right)[- ]rear\s+(?:side|view|angle)\b/i;
  return text.replace(/[“"][^”"]*[”"]/g, '').split(/[.;\n]|\bbut\b/i).some(clause => {
    const match = placement.exec(clause);
    return match !== null && !/\b(?:no|not|never|without|avoid|don't|doesn't|isn't|do not)\b/i.test(clause.slice(0, match.index + match[0].length));
  });
}

function speakerMatchesCharacter(speaker: string, title: string): boolean {
  const normalize = (text: string) => text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const name = normalize(speaker);
  const fullTitle = normalize(title);
  // Strip only known identity labels, never arbitrary slash-separated names,
  // surnames, accents or punctuation. This creates no persisted alias.
  const identityName = fullTitle.replace(/\s*\/\s*(?:base identity|master identity|character identity)$/u, '').trim();
  return name === fullTitle || (identityName.length > 0 && name === identityName);
}
export function runScenePreflight(source: SceneDocumentSource & {extraRequiredSlots?: BuilderSlot[]; referencePack?: SceneDraft['referencePack']}, availableMediaIds?: ReadonlySet<string>): PreflightFinding[] {
  const findings: PreflightFinding[]=[];
  const add=(ruleId: PreflightFinding['ruleId'], severity: PreflightFinding['severity'], title: string, evidence: Evidence[], explanation: string, suggestedActions=['Review the source directions and edit if needed.']) => {
    const unique=evidence.filter((e,i,a)=>a.findIndex(x=>x.component===e.component&&x.text===e.text)===i);
    const id=JSON.stringify([ruleId,...(ruleId==='P000'?[title]:[]),unique]);
    if(!findings.some(f=>f.id===id)) findings.push({id,ruleId,severity,title,components:[...new Set(unique.map(e=>e.component))],evidence:unique,explanation,suggestedActions});
  };
  const doc=buildSceneDocument(source);
  const fields: Evidence[]=SCENE_COMPONENT_ORDER.filter(s=>s!=='character').flatMap(component=>doc.components[component]?.prompt.trim()?[{component,text:doc.components[component]!.prompt}]:[]);
  if(source.sceneInstructions.trim()) fields.push({component:'instructions',text:source.sceneInstructions});
  if(source.settings.toolNotes?.trim()) fields.push({component:'settings',text:source.settings.toolNotes});
  const matches=(pattern:RegExp)=>fields.filter(e=>positive(e.text,pattern));
  const pair=(id:PreflightFinding['ruleId'],title:string,a:RegExp,b:RegExp,severity:PreflightFinding['severity']='review')=> {const left=matches(a),right=matches(b);if(left.length&&right.length) add(id,severity,title,[...left,...right],'Explicit source directions may conflict. This deterministic check needs human review.');};
  const validation=assembleScenePrompt({...source,extraRequiredSlots:source.extraRequiredSlots??[]} as SceneDraft);
  for(const error of validation.errors.filter(e=>!e.includes('parent character mismatch'))) {
    const component: PreflightComponent=error.includes('ialogue')||error.includes('Speaker')||error.includes('Delivery')||error.includes('caption')||error.includes('Language')?'dialogue':error.includes('instructions')?'instructions':'settings';
    const slot=SCENE_COMPONENT_ORDER.find(s=>error.includes(`(${s})`));
    const text=slot?(source.slots[slot]?.overrideText??source.slots[slot]?.promptText??''):component==='dialogue'?(error.includes('Speaker')||error.includes('speaker')?source.dialogue?.speaker??'':error.includes('Language')?source.dialogue?.language??'':error.includes('Delivery')?source.dialogue?.deliveryNotes??'':error.includes('mode')?source.dialogue?.mode??'':error.includes('caption')?source.dialogue?.captionPreference??'':source.dialogue?.line??''):component==='instructions'?source.sceneInstructions:error.includes('title')?source.title:String(source.settings.durationSeconds??'');
    add('P000','blocking',error,[{component:slot??component,text}],error,['Complete the required scene information.']);
  }
  const rear=/\b(?:rear(?:[- ]facing| view| shot)|back view|camera (?:is )?behind (?:the )?(?:subject|character)|from behind|camera\s+\d+°?\s+behind)\b/i;
  const rearFields = fields.filter(e => positive(e.text, rear) || positiveRearPlacement(e.text));
  const gazeFields = matches(/\b(?:look(?:s|ing)? (?:directly )?(?:at|into) (?:the )?(?:camera|lens)|direct(?:-to-camera| eye contact)|eye contact with (?:the )?(?:camera|lens))\b/i);
  if (gazeFields.length && rearFields.length) add('P001','review','Direct gaze with rear composition',[...gazeFields,...rearFields],'Explicit source directions may conflict. This deterministic check needs human review.');
  pair('P002','Static and moving camera directions',/\b(?:camera (?:is )?(?:locked(?: off)?|static|stationary)|locked[- ]off camera|static camera)\b/i,/\b(?:camera (?:dollies|tracks|moves|pans|tilts|orbits|pushes)|dolly (?:in|forward|back)|tracking shot|handheld camera)\b/i);
  pair('P003','Conflicting time-of-day directions',/\b(?:morning|daytime|midday|daylight)\b/i,/\b(?:evening|night(?:time)?|blue[- ]hour)\b/i);
  const master = doc.components.character;
  if(master?.prompt.trim()) fields.push({component:'character',text:master.prompt});
  pair('P004','Photorealistic and stylized directions',/\b(?:photorealistic|photo[- ]realistic)\b/i,/\b(?:fully stylized|cartoon|3D animation|animated 3D|styl(?:ized|ised)\s+3D\s+(?:feature\s+)?animation)\b/i,'information');
  const masterIndex=fields.findIndex(e=>e.component==='character');
  if(masterIndex>=0) fields.splice(masterIndex,1);
  const dialogue=source.dialogue;
  const audioOnly=dialogue?.mode==='voiceover'||dialogue?.mode==='off_screen'||/\b(?:narrator|voice[- ]?over|off[- ]screen)\b/i.test(dialogue?.speaker??'');
  if(dialogue?.speaker.trim()&&source.slots.character&&!audioOnly&&!speakerMatchesCharacter(dialogue.speaker,source.slots.character.sourceTitle)) add('P005','review','Speaker differs from selected character',[{component:'character',text:source.slots.character.sourceTitle},{component:'dialogue',text:dialogue.speaker}],'Check whether this speaker is intentional.');
  for(const slot of SCENE_COMPONENT_ORDER) {const snap=source.slots[slot];if(snap?.sourceType==='variant'&&snap.parentCharacterId&&snap.parentCharacterId!==source.slots.character?.sourceId) add('P006','blocking','Variant parent character mismatch',[{component:slot,text:snap.parentCharacterId},...(source.slots.character?[{component:'character' as const,text:source.slots.character.sourceId}]:[])],'The variant belongs to a different character.',['Select a compatible variant or character.']);}
  if(dialogue?.line.trim()&&!audioOnly) {
    const visible=matches(/\b(?:visible lip movement|lip[- ]sync|speaks? (?:directly )?(?:to|into) (?:the )?(?:camera|lens)|mouth (?:is )?visible)\b/i);
    if(dialogue.deliveryNotes&&positive(dialogue.deliveryNotes,/\b(?:visible lip movement|lip[- ]sync|lens interaction)\b/i)) visible.push({component:'dialogue',text:dialogue.deliveryNotes});
    if(dialogue.mode==='on_camera') visible.push(...matches(/\b(?:look(?:s|ing)? (?:directly )?(?:at|into) (?:the )?(?:camera|lens)|eye contact with (?:the )?(?:camera|lens))\b/i));
    const composition=fields.filter(e=>rearFields.includes(e)||positive(e.text,/\b(?:extreme wide shot|extreme long shot|mouth (?:is )?(?:hidden|obscured)|face (?:is )?not visible)\b/i));
    if(visible.length&&composition.length) add('P007','review','Visible speech may be obscured',[...visible,...composition],'Visible speech or lens interaction may not be visible in this composition.');
  }
  if(availableMediaIds) {const links=source.referencePack?.entries??source.references??SCENE_COMPONENT_ORDER.flatMap(s=>source.slots[s]?.mediaLinks??[]);for(const link of links)if(!availableMediaIds.has(link.mediaId))add('P008','review','Selected reference is unavailable',[{component:'references',text:link.mediaId}],'The selected media ID is missing from local storage.',['Restore the media or explicitly change the selection.']);}
  return findings;
}
