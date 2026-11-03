import type {BlockingPhase,BlockingHolder,ParticipantRef} from './blocking';
import type {CameraComposition} from './cinematography';
import type {ReferencePackEntry,OutputMode} from './domain';
export const KEYFRAME_LIMITS=Object.freeze({frames:16,id:64,label:120,instructions:2000,expression:500,planBytes:128*1024,modeBytes:256*1024,takeOutputBytes:1024*1024,historyEvents:2000,historyBytes:4*1024*1024});
export interface KeyframeFinding{code:string;path:string;severity:'blocking'|'incomplete'|'advisory';message:string}
export interface FrameInstantParticipant{participant:ParticipantRef;bindingToken:string;wardrobeBindingToken?:string;phase:BlockingPhase}
export interface FrameInstantProp{propId:string;holder:BlockingHolder}
export type KeyframeInstant={kind:'linked_phase';phase:'start'|'end'}|{kind:'custom';participants:FrameInstantParticipant[];props?:FrameInstantProp[]};
export interface FrameStaticComposition{instructions?:string;cameraComposition?:CameraComposition}
export interface FrameExpression{participant:ParticipantRef;text:string}
export interface PlannedKeyframeV1{id:string;label:string;role:'start'|'intermediate'|'end'|'custom';relativePosition?:number;timeSeconds?:number;participantRefs:ParticipantRef[];visualInstructions?:string;instant?:KeyframeInstant;expressions?:FrameExpression[];composition?:FrameStaticComposition;referenceAssociationIds:string[]}
export interface StillSourceAdaptations{camera?:string;action?:string;sceneInstructions?:string;omittedSources?:('camera'|'action'|'sceneInstructions')[]}
export interface KeyframePlanV1{version:1;id:string;frames:PlannedKeyframeV1[];stillSourceAdaptations?:StillSourceAdaptations}
type Fields<T>={[K in keyof T]?:T[K]|null};
export interface FrameInstantParticipantPatch{participant:ParticipantRef;bindingToken?:string;wardrobeBindingToken?:string|null;bindToRecipe?:true;phase?:Fields<BlockingPhase>|null}
export type KeyframeInstantPatch={kind:'linked_phase';phase:'start'|'end'}|{kind:'custom';participantUpserts?:FrameInstantParticipantPatch[];removeParticipants?:ParticipantRef[];participantOrder?:ParticipantRef[];propUpserts?:FrameInstantProp[];removePropIds?:string[]};
export interface KeyframeUpsert extends Omit<Fields<PlannedKeyframeV1>,'id'|'instant'|'composition'|'expressions'>{id:string;instant?:KeyframeInstantPatch|null;composition?:Fields<FrameStaticComposition>|null;expressionUpserts?:{participant:ParticipantRef;text:string|null}[]}
export interface KeyframePatchV1{version:1;expectedBaseDigest:string;id?:string;frameUpserts?:KeyframeUpsert[];removeFrameIds?:string[];frameOrder?:string[];stillSourceAdaptations?:Fields<StillSourceAdaptations>|null}
export type ImagePromptMode='full'|'compact';
export interface FrameReferenceProvenance{association:ReferencePackEntry;sha256?:string;missing?:true}
export interface ImagePromptSnapshotV1{schema:'krakinai.image-prompt.v1';assemblerVersion:1;full:string;compact?:string;visualDigest:string;sourceDigest:string;referenceProvenance:FrameReferenceProvenance[]}
export interface ManualImageOutput{text:string;basedOnVisualDigest:string;updatedAt:string}
export type ManualImageOutputs=Record<string,Partial<Record<ImagePromptMode,ManualImageOutput>>>;
export type FrameOutputDecisions=Record<string,Partial<Record<ImagePromptMode,'canonical'|'keep_manual_unverified'>>>;
export interface FrameVideoReviewBasis{sourceSceneId?:string;planDigest:string;videoInputDigest:string;videoTextDigests:Partial<Record<OutputMode,string>>}
export interface KeyframeBasis{planDigest:string;videoReviewDigest:string;frameOrder:string[];frames:Record<string,{visualDigest:string;metadataDigest:string;bindingDigest:string;referenceProvenance:FrameReferenceProvenance[]}>}
export interface KeyframeDependencyDiff{addedFrameIds:string[];removedFrameIds:string[];reorderedFrameIds:string[];metadataOnlyFrameIds:string[];visuallyChangedFrameIds:string[];videoReviewRequired:boolean}
