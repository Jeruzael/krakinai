import {makeBlockingFixture} from './blockingFixture';
import {prepareBlockingSources} from '../../domain/blockingPatch';
import {assembleScenePrompt} from '../../domain/promptAssembler';
export async function blockingChangeScenario(){
 const f=makeBlockingFixture(),parent=f.state.scenes.find(s=>s.id===f.parentSceneId)!;parent.blocking=structuredClone(f.draft.blocking);parent.outputs=assembleScenePrompt({...parent,inputRevision:1}).outputs;
 const proofs=await prepareBlockingSources(f.state.scenes),proof=proofs.get(parent.id)!;
 const op={operationId:'revise',type:'scene.revise_recipe',clientRef:'new-take',project:{id:f.projectId,expectedRevision:f.state.collections[0].project!.revision},shot:{id:f.shotId},sceneId:parent.id,expectedHeadId:parent.id,expectedSourceRevision:parent.revision,expectedSourceRecipeDigest:proof.recipeDigest,expectedBlockingDigest:proof.blockingDigest,blocking:{version:1,expectedBaseDigest:proof.blockingDigest,participantUpserts:[{participant:{kind:'ensemble',participantId:'primary'},end:{headDirection:{kind:'target',target:{kind:'landmark',landmarkId:'door'}},pose:'Aya keeps her original gown and looks toward the chapel door.'}}]}};
 return{...f,parent,proofs,op,input:{schema:'krakinai.change-set.v5',changeSetId:'blocking-change',source:{kind:'codex'},operations:[op]}};
}
