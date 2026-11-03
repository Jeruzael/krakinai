import {makeBlockingFixture} from './blockingFixture';
import {planAuthoredScene,buildRevisionDraft} from '../../storage/sceneAuthoring';
import type {SceneDraft} from '../../types/domain';
export function makeBlockingSequenceFixture(){
 const fixture=makeBlockingFixture(),state=structuredClone(fixture.state),now=fixture.draft.updatedAt;
 const main=planAuthoredScene(fixture.draft,{requestId:'main-sequence',expectedInputRevision:1,selectAsPreferred:true},state,{id:'scene_blocking_selected',now});
 state.scenes.push(main.scene);state.collections=[main.collection!];
 const priorId=fixture.otherSceneIds[0],target={collectionId:fixture.projectId,shotId:'shot-before',expectedProjectRevision:main.collection!.project!.revision!};
 const draft:SceneDraft={...buildRevisionDraft(priorId,state,{target}),id:'sequence-prior-draft',inputRevision:1,updatedAt:now,blocking:structuredClone(fixture.draft.blocking)};
 draft.blocking!.participants[0].end!.zone='left';
 const prior=planAuthoredScene(draft,{requestId:'prior-sequence',expectedInputRevision:1,selectAsPreferred:true},state,{id:'scene_blocking_previous',now});
 state.scenes.push(prior.scene);state.collections=[prior.collection!];
 return{...fixture,state,scene:main.scene,previous:prior.scene,collection:prior.collection!};
}
