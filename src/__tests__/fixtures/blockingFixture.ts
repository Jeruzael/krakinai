import {ensembleParentState} from './ensemblePlanningFixture';
import {actor} from './ensembleFixture';
import {recipeTime} from './recipeChangeSetFixture';
import {blockingBindingToken} from '../../domain/blockingValidation';
import {buildRevisionDraft} from '../../storage/sceneAuthoring';
import {assembleScenePrompt} from '../../domain/promptAssembler';
import {projectMembersFromShots} from '../../domain/projectStoryboard';
import type {SceneBlockingV1,ParticipantRef,TargetRef} from '../../types/blocking';
import type {LibrarySnapshot} from '../../storage/db';
import type {SceneDraft,SavedScene} from '../../types/domain';

/** All records and decodable 32×32 blue PNG bytes are generated synthetic fixtures. */
export function makeBlockingFixture(){
 const initial=ensembleParentState(),parent=initial.scenes[0];
 const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGOwSjpJU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAAtflExI08gfAAAAAElFTkSuQmCC'),c=>c.charCodeAt(0));
 const media={id:'blocking-media',filename:'synthetic-blue.png',safeFilename:'synthetic-blue.png',mimeType:'image/png',byteSize:bytes.length,blob:new Blob([bytes],{type:'image/png'}),width:32,height:32,createdAt:recipeTime};
 const link={mediaId:media.id,role:'reference' as const,altText:'Synthetic blue QA reference; no inferred traits.',order:0};
 const source=parent.ensemble!.participants[0];source.character.mediaLinks=[link];parent.slots.character=structuredClone(source.character);
 const environment=initial.assets.find(a=>a.id==='environment')!;environment.title='Synthetic Chapel';environment.promptText='A fictional chapel with an aisle, altar and entrance door.';environment.compactText='Fictional chapel.';
 Object.assign(parent.slots.environment!,{sourceTitle:environment.title,promptText:environment.promptText,compactText:environment.compactText});
 const asset=initial.assets.find(a=>a.id==='character')!;asset.mediaLinks=[link];asset.coverMediaId=media.id;
 parent.ensemble!.participants.push({id:'marco',character:actor('marco','Marco'),presence:'off_camera'});
 if(parent.authoringMode==='direct_prompt')throw Error('Blocking fixture requires a legacy recipe parent.');
 const assembled=assembleScenePrompt({...parent,inputRevision:1});parent.outputs=assembled.outputs;parent.references=assembled.references;
 const before={...structuredClone(parent),id:'blocking-before',title:'Synthetic Shot 08',sceneRevision:{version:1 as const,rootSceneId:'blocking-before',sequence:1,createdAt:recipeTime}} as SavedScene;
 const after={...structuredClone(parent),id:'blocking-after',title:'Synthetic Shot 10',sceneRevision:{version:1 as const,rootSceneId:'blocking-after',sequence:1,createdAt:recipeTime}} as SavedScene;
 const collection=initial.collections[0],shot=collection.project!.shots[0];Object.assign(shot,{code:'09',order:1,title:'Synthetic look toward the chapel door'});
 collection.project!.shots=[{...structuredClone(shot),id:'shot-before',code:'08',order:0,title:before.title,takeSceneIds:[before.id],selectedSceneId:before.id},shot,{...structuredClone(shot),id:'shot-after',code:'10',order:2,title:after.title,takeSceneIds:[after.id],selectedSceneId:after.id}];
 collection.members=projectMembersFromShots(collection,collection.project!.shots);
 const state:LibrarySnapshot={...initial,variants:initial.variants??[],drafts:[],media:[media],scenes:[before,parent,after]};
 const aya:ParticipantRef={kind:'ensemble',participantId:'primary'},lucas:ParticipantRef={kind:'ensemble',participantId:'lucas'};
 const target=(landmarkId:string):TargetRef=>({kind:'landmark',landmarkId});
 const blocking:SceneBlockingV1={version:1,space:{id:'chapel',environmentBindingToken:blockingBindingToken(parent.slots.environment!),originLandmarkId:'door',forwardLandmarkId:'altar'},
  landmarks:[{id:'door',label:'Chapel door',screen:{zone:'left',depth:'foreground'}},{id:'aisle',label:'Aisle midpoint',screen:{zone:'center',depth:'midground'}},{id:'altar',label:'Altar',screen:{zone:'center',depth:'background'}}],
  props:[{id:'bouquet',label:'Bridal bouquet',startHolder:{kind:'participant',participant:aya},endHolder:{kind:'participant',participant:aya}}],
  participants:parent.ensemble!.participants.filter(p=>p.presence==='on_camera').map(p=>({participant:{kind:'ensemble',participantId:p.id},bindingToken:blockingBindingToken(p.character),...(p.wardrobe?{wardrobeBindingToken:blockingBindingToken(p.wardrobe)}:{}),
   start:{visibility:'on_screen',zone:p.id==='primary'?'center':'right',depth:p.id==='primary'?'foreground':'background',bodyDirection:{kind:'target',target:target(p.id==='primary'?'altar':'door')},eyeline:p.id==='primary'?target('altar'):{kind:'participant',participant:aya}},
   action:{kind:p.id==='primary'?'move':'hold',text:p.id==='primary'?'Walk to the aisle midpoint, stop, and turn her head toward the chapel door.':'Remain at the altar.',waypointLandmarkIds:p.id==='primary'?['aisle']:[],interactions:[]},
   end:{visibility:'on_screen',zone:p.id==='primary'?'center':'right',depth:p.id==='primary'?'midground':'background',scenePlacement:{landmarkId:p.id==='primary'?'aisle':'altar',relation:'near'},bodyDirection:{kind:'target',target:target(p.id==='primary'?'altar':'door')},headDirection:{kind:'target',target:p.id==='primary'?target('door'):{kind:'participant',participant:aya}},eyeline:p.id==='primary'?target('door'):{kind:'participant',participant:aya},pose:p.id==='primary'?'Keep the bouquet in both hands.':'Watch Aya without moving.'}})),
  camera:{direction:target('altar'),axis:{id:'aya-lucas',from:{kind:'participant',participant:aya},to:{kind:'participant',participant:lucas},side:'A'}}};
 const draft:SceneDraft={...buildRevisionDraft(parent.id,state,{target:{collectionId:collection.id,shotId:shot.id,expectedProjectRevision:collection.project!.revision!}}),id:'blocking-draft',inputRevision:1,updatedAt:recipeTime,blocking};
 state.drafts=[draft];return{draft,state,projectId:collection.id,shotId:shot.id,parentSceneId:parent.id,otherSceneIds:[before.id,after.id]};
}
