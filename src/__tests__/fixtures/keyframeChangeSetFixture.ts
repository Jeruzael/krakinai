import {makeKeyframeFixture} from './keyframeFixture';
import {prepareBlockingSources} from '../../domain/blockingPatch';
import {prepareKeyframeSources} from '../../domain/keyframeChangeSet';
import {assembleImagePrompt} from '../../domain/imagePromptDocument';
import {assembleScenePrompt} from '../../domain/promptAssembler';
import {emptyChangeSetApproval,type ChangeSet} from '../../types/changeSet';
import type {KeyframeChangeFields} from '../../types/keyframeChangeSet';
import {installSyntheticRasterDecoder} from './syntheticRasterDecoder';
export async function keyframeChangeScenario(){
 installSyntheticRasterDecoder();
 const f=makeKeyframeFixture(),parent=f.state.scenes.find(s=>s.id===f.parentSceneId)!;
 Object.assign(parent,{slots:structuredClone(f.draft.slots),ensemble:structuredClone(f.draft.ensemble),blocking:structuredClone(f.draft.blocking),settings:structuredClone(f.draft.settings),keyframePlan:structuredClone(f.plan),referencePack:structuredClone(f.draft.referencePack),imagePromptSnapshots:{}});
 for(const frame of f.plan.frames){const result=await assembleImagePrompt(f.draft,frame.id,f.media);if(!result.ready)throw Error(JSON.stringify(result.findings));parent.imagePromptSnapshots![frame.id]=result.snapshot;}
 parent.outputs=assembleScenePrompt(f.draft).outputs;
 const proofs=await prepareBlockingSources([parent]),sources=await prepareKeyframeSources([parent],f.media),proof=proofs.get(parent.id)!;
 const op={operationId:'revise',type:'scene.revise_recipe' as const,clientRef:'new-take',project:{id:f.projectId,expectedRevision:f.state.collections[0].project!.revision},shot:{id:f.shotId},sceneId:parent.id,expectedHeadId:parent.id,expectedSourceRevision:parent.revision,expectedSourceRecipeDigest:proof.recipeDigest,expectedBlockingDigest:proof.blockingDigest,expectedKeyframeDigest:sources.get(parent.id)!.basis.planDigest,keyframes:{version:1 as const,expectedBaseDigest:sources.get(parent.id)!.basis.planDigest,frameUpserts:[{id:'middle',visualInstructions:'Aya turns toward the chapel door while preserving her original appearance and gown.'}]},videoDecision:'keep_exact_unverified' as const};
 const extendedOp:typeof op&Pick<KeyframeChangeFields,'imageCarryOver'>=op;
 const input:ChangeSet={schema:'krakinai.change-set.v6',changeSetId:'synthetic-frame-change',source:{kind:'codex'},operations:[extendedOp]};
 const approval={...emptyChangeSetApproval(),storyboard:true,scenes:true,blocking:true,keyframes:true,frameVideo:true};
 return{...f,parent,proofs,sources,op:extendedOp,input,approval};
}
