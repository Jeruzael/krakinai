import {makeBlockingFixture} from './blockingFixture';
import {blockingBindingToken} from '../../domain/blockingValidation';
import {collectReferenceCandidates} from '../../domain/referencePack';
import {createSnapshotFromAsset} from '../../domain/promptAssembler';
import type {KeyframePlanV1} from '../../types/keyframes';

export function makeKeyframeFixture(){
 const f=makeBlockingFixture(),draft=f.draft;
 if(!draft.slots.camera){
  const camera={id:'keyframe-camera',category:'camera' as const,title:'Synthetic Camera',description:'Synthetic QA only.',provenance:{},promptText:'Synthetic video camera directions for explicit still adaptation.',revision:1,tags:[],mediaLinks:[],favorite:false,reviewStatus:'unreviewed' as const,notes:'',createdAt:draft.updatedAt,updatedAt:draft.updatedAt};
  f.state.assets.push(camera);draft.slots.camera=createSnapshotFromAsset(camera);
 }
 draft.referencePack={version:1,entries:collectReferenceCandidates(draft,new Map(f.state.media.map(m=>[m.id,m])))};
 const participants=draft.ensemble!.participants.filter(p=>p.presence==='on_camera');
 const refs=participants.map(p=>({kind:'ensemble' as const,participantId:p.id}));
 const instant={kind:'custom' as const,participants:participants.map(p=>({participant:{kind:'ensemble' as const,participantId:p.id},bindingToken:blockingBindingToken(p.character),...(p.wardrobe?{wardrobeBindingToken:blockingBindingToken(p.wardrobe)}:{}),phase:{...structuredClone(draft.blocking!.participants.find(t=>t.participant.kind==='ensemble'&&t.participant.participantId===p.id)!.end!)}}))};
 const plan:KeyframePlanV1={version:1,id:'chapel-plan',stillSourceAdaptations:{camera:'A medium rear three-quarter still composition at eye level.',action:'Depict only the specified frozen pose.',sceneInstructions:'Preserve the fictional chapel and original wardrobe.'},frames:[
  {id:'start',label:'Start',role:'start',relativePosition:0,participantRefs:refs,visualInstructions:'Aya stands in the center aisle.',instant:{kind:'linked_phase',phase:'start'},referenceAssociationIds:draft.referencePack.entries.map(e=>e.associationId)},
  {id:'middle',label:'Middle',role:'intermediate',relativePosition:0.5,participantRefs:refs,visualInstructions:'Aya turns her head toward the chapel door. Her body remains toward the altar.',instant,referenceAssociationIds:draft.referencePack.entries.map(e=>e.associationId)},
  {id:'end',label:'End',role:'end',relativePosition:1,participantRefs:refs,visualInstructions:'Aya keeps her bouquet in both hands.',instant:{kind:'linked_phase',phase:'end'},referenceAssociationIds:draft.referencePack.entries.map(e=>e.associationId)},
 ]};
 draft.keyframePlan=plan;draft.settings.durationSeconds=8;
 return{...f,draft,plan,media:new Map(f.state.media.map(m=>[m.id,m]))};
}
