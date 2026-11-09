import type {SceneDraft,SavedScene,MediaAsset,OutputMode} from '../types/domain';
import type {KeyframeBasis,KeyframeFinding,FrameOutputDecisions} from '../types/keyframes';
import type {FramePromptProof} from '../types/frameProduction';
import type {BlockingOutputDecisions} from './blockingOutputReview';
import {canonicalStringify,changeSetDigest} from './changeSetCanonical';
import {prepareKeyframeBasis,diffKeyframeBasis} from './keyframeDependencies';
import {assembleImagePrompt} from './imagePromptDocument';
import {resolveFrameOutputs,type FrameOutputResolution} from './frameOutputReview';
import {planFrameVideoReview,type FrameVideoResolution,type FrameVideoDecision} from './frameVideoReview';
import {assembleScenePrompt} from './promptAssembler';
import {frameMediaSignature} from './frameImageAssociations';
import {getActiveSourceMediaLinks} from './shotTypeRules';
import {validateKeyframePlan} from './keyframeValidation';

export interface FrameAuthoringChoices{frameOutputDecisions?:FrameOutputDecisions;frameVideoDecision?:FrameVideoDecision;blockingOutputDecisions?:BlockingOutputDecisions}
export interface PreparedFrameAuthoring {
 draftSignature:string;choicesSignature:string;sourceSignature:string;
 mediaSignatures:[string,string|null][];
 basis:KeyframeBasis;differences:ReturnType<typeof diffKeyframeBasis>;
 images:FrameOutputResolution;video:FrameVideoResolution;findings:KeyframeFinding[];
 beforeBlocking:SceneDraft['blocking'];afterBlocking:SceneDraft['blocking'];
 beforePlan:SceneDraft['keyframePlan'];afterPlan:SceneDraft['keyframePlan'];frames:Record<string,FramePromptProof>;
}
export const frameChoicesSignature=(choices:FrameAuthoringChoices)=>canonicalStringify({frameOutputDecisions:choices.frameOutputDecisions,frameVideoDecision:choices.frameVideoDecision,blockingOutputDecisions:choices.blockingOutputDecisions});

export async function prepareFramePromptProofs(source:Pick<SceneDraft,'imagePromptSnapshots'|'manualImageOutputs'>,basis:KeyframeBasis):Promise<Record<string,FramePromptProof>>{
 const result:Record<string,FramePromptProof>={};
 for(const id of basis.frameOrder){const snapshot=source.imagePromptSnapshots?.[id],full=source.manualImageOutputs?.[id]?.full?.text??snapshot?.full;if(full===undefined)continue;
  result[id]={visualDigest:basis.frames[id].visualDigest,bindingDigest:basis.frames[id].bindingDigest,referenceDigest:await changeSetDigest(basis.frames[id].referenceProvenance),promptDigest:await changeSetDigest({full,compact:source.manualImageOutputs?.[id]?.compact?.text??snapshot?.compact})};
 }
 return result;
}

/** Pure asynchronous preparation shared by local authoring and v6. Never writes. */
export async function prepareFrameAuthoring(draft:SceneDraft,parent:SavedScene|undefined,media:ReadonlyMap<string,MediaAsset>,choices:FrameAuthoringChoices):Promise<PreparedFrameAuthoring>{
 const basis=await prepareKeyframeBasis(draft,media),before=await prepareKeyframeBasis(parent?{...parent,inputRevision:1} as SceneDraft:{...draft,keyframePlan:undefined,imagePromptSnapshots:undefined,manualImageOutputs:undefined},media),differences=diffKeyframeBasis(before,basis);
 const canonical:NonNullable<SceneDraft['imagePromptSnapshots']>={},working=structuredClone(draft),findings:KeyframeFinding[]=[];
 const planning=validateKeyframePlan(draft.keyframePlan,draft,'planning');
 for(const [index,id]of basis.frameOrder.entries()){
  const snapshot=draft.imagePromptSnapshots?.[id],inherited=snapshot&&parent?.imagePromptSnapshots?.[id]&&canonicalStringify(snapshot)===canonicalStringify(parent.imagePromptSnapshots[id]);
  if(inherited&&snapshot.visualDigest===basis.frames[id].visualDigest)continue;
  const incomplete=planning.filter(f=>f.severity==='incomplete'&&f.path.startsWith(`keyframePlan.frames[${index}]`));
  if(incomplete.length){if(working.imagePromptSnapshots)delete working.imagePromptSnapshots[id];findings.push(...incomplete.map(f=>({...f,severity:'advisory' as const})));continue;}
  const result=await assembleImagePrompt(draft,id,media);
  if(result.ready){
   if(snapshot&&!inherited&&snapshot.visualDigest===basis.frames[id].visualDigest&&(snapshot.full!==result.snapshot.full||snapshot.compact!==result.snapshot.compact))findings.push({code:'FRAME_CANONICAL_TEXT',path:`imagePromptSnapshots.${id}`,severity:'blocking',message:'Edited raw text cannot be certified as canonical using a copied visual digest. Keep this text in the Manual image editor and review it explicitly.'});
   canonical[id]=result.snapshot;
  }else{if(working.imagePromptSnapshots)delete working.imagePromptSnapshots[id];findings.push(...result.findings.map(f=>({...f,severity:f.severity==='incomplete'||['IMAGE_ADAPTATION','IMAGE_CAMERA'].includes(f.code)?'advisory' as const:f.severity})));}
 }
 const images=resolveFrameOutputs(working,basis,canonical,choices.frameOutputDecisions);findings.push(...images.findings);
 const sourceOutputs:Record<OutputMode,string>=parent&&parent.authoringMode!=='direct_prompt'?{...parent.outputs}:assembleScenePrompt(draft).outputs;
 for(const mode of ['full','structured','compact'] as const)if(draft.manualOutputs[mode])sourceOutputs[mode]=draft.manualOutputs[mode]!.text;
 const video=await planFrameVideoReview(draft,sourceOutputs,basis,choices.frameVideoDecision,choices.blockingOutputDecisions);findings.push(...video.findings);
 const ids=new Set([...Object.values(basis.frames),...Object.values(before.frames)].flatMap(frame=>frame.referenceProvenance.map(p=>p.association.mediaId)));
 for(const source of [draft,...(parent?[parent]:[])])for(const link of getActiveSourceMediaLinks(source))ids.add(link.mediaId);
 const mediaSignatures:[string,string|null][]=[...ids].map(id=>[id,media.has(id)?frameMediaSignature(media.get(id)!):null]);
 const {authoredProjectTarget:_,...sigDraft}=draft;
 return{draftSignature:canonicalStringify(sigDraft),choicesSignature:frameChoicesSignature(choices),sourceSignature:canonicalStringify(parent??null),mediaSignatures,basis,differences,images,video,findings,beforeBlocking:structuredClone(parent?.blocking),afterBlocking:structuredClone(draft.blocking),beforePlan:structuredClone(parent?.keyframePlan),afterPlan:structuredClone(draft.keyframePlan),frames:await prepareFramePromptProofs(images,basis)};
}

/** No WebCrypto or decoding inside the atomic write boundary. */
export function assertPreparedFrameAuthoring(prepared:PreparedFrameAuthoring,draft:SceneDraft,parent:SavedScene|undefined,media:ReadonlyMap<string,MediaAsset>,choices:FrameAuthoringChoices):void{
 const {authoredProjectTarget:_,...sigDraft}=draft;
 if(prepared.draftSignature!==canonicalStringify(sigDraft)||prepared.choicesSignature!==frameChoicesSignature(choices)||prepared.sourceSignature!==canonicalStringify(parent??null)||prepared.mediaSignatures.some(([id,signature])=>signature!==(media.has(id)?frameMediaSignature(media.get(id)!):null)))throw Error('Frame source, current media, draft or reviewed choices changed during preparation. Preview again; no scene was saved.');
 const errors=prepared.findings.filter(f=>f.severity==='blocking');if(errors.length)throw Error(errors.map(f=>f.message).join(' '));
}
