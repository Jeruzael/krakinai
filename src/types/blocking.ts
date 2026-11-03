import type {ComponentSnapshot,SceneDraft} from './domain';

export const BLOCKING_LIMITS=Object.freeze({participants:8,landmarks:16,props:16,interactions:32,waypoints:4,id:64,label:120,text:500,description:1000,bytes:64*1024});
export const BLOCKING_LOCAL_ID_PATTERN='^(?!(?:constructor|prototype|__proto__)$)[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$';
export type BlockingSource=Pick<SceneDraft,'slots'|'ensemble'|'shotType'|'authoringMode'>;
export interface BlockingFinding {code:string;path:string;severity:'blocking'|'incomplete'|'advisory';message:string}
export type ParticipantRef={kind:'primary'}|{kind:'ensemble';participantId:string};
export type TargetRef={kind:'participant';participant:ParticipantRef}|{kind:'landmark';landmarkId:string}|{kind:'camera'};
export type InteractionTargetRef=TargetRef|{kind:'prop';propId:string};
export type ScreenZone='left'|'center'|'right'|'unspecified';
export type BlockingDepth='foreground'|'midground'|'background'|'unspecified';
export type BlockingDirection={kind:'target';target:TargetRef}|{kind:'screen';direction:'toward_camera'|'away_from_camera'|'screen_left'|'screen_right'|'toward_left'|'toward_right'|'away_left'|'away_right'};
export interface BlockingPhase {visibility?:'on_screen'|'out_of_frame'|'unspecified';zone?:ScreenZone;depth?:BlockingDepth;scenePlacement?:{landmarkId:string;relation:'at'|'near'|'left_of'|'right_of'|'in_front_of'|'behind'};bodyDirection?:BlockingDirection;headDirection?:BlockingDirection;eyeline?:TargetRef;pose?:string}
export type BlockingInteraction={id:string}&(
 |{kind:'approach'|'follow'|'face'|'touch'|'gesture_to'|'avoid';target:InteractionTargetRef}
 |{kind:'transfer_prop';propId:string;from:ParticipantRef;to:ParticipantRef}
 |{kind:'custom';description:string;target?:InteractionTargetRef}
);
export interface BlockingAction {kind:'hold'|'move'|'enter'|'exit'|'custom'|'unspecified';text?:string;waypointLandmarkIds?:string[];interactions?:BlockingInteraction[]}
export interface ParticipantBlocking {participant:ParticipantRef;bindingToken:string;wardrobeBindingToken?:string;start?:BlockingPhase;action?:BlockingAction;end?:BlockingPhase}
export interface BlockingLandmark {id:string;label:string;description?:string;screen?:{zone?:ScreenZone;depth?:BlockingDepth}}
export type BlockingHolder={kind:'participant';participant:ParticipantRef}|{kind:'shared';participants:ParticipantRef[]}|{kind:'landmark';landmarkId:string}|{kind:'unheld'}|{kind:'unspecified'};
export interface BlockingProp {id:string;label:string;description?:string;startHolder?:BlockingHolder;endHolder?:BlockingHolder}
export interface BlockingSpace {id:string;environmentBindingToken?:string;originLandmarkId?:string;forwardLandmarkId?:string}
export interface BlockingCamera {direction?:TargetRef;axis?:{id:string;from:TargetRef;to:TargetRef;side:'A'|'B'|'on_axis'|'unspecified'}}
export interface SceneBlockingV1 {version:1;space?:BlockingSpace;landmarks:BlockingLandmark[];props:BlockingProp[];participants:ParticipantBlocking[];camera?:BlockingCamera}
export interface BlockingParticipantSource {ref:ParticipantRef;character:ComponentSnapshot;wardrobe?:ComponentSnapshot;presence:'on_camera'|'off_camera'}
