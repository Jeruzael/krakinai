import type {FrameVideoReviewBasis} from './keyframes';
export interface FrameImageIdentity{shotId:string;sceneId:string;frameId:string}
export interface FrameImageTarget extends FrameImageIdentity{collectionId:string;expectedProjectRevision:number;expectedSceneRevision:number;expectedVisualDigest:string;expectedAssociationRevision:number}
export type FrameImageCommand=
 |{kind:'link';target:FrameImageTarget;mediaId:string;provenance?:FrameImageEvent['provenance']}
 |{kind:'clear';target:FrameImageTarget}
 |{kind:'review';target:FrameImageTarget;reviewStatus:'approved'|'needs_changes';note?:string};
export interface FrameImageEvent extends FrameImageIdentity {
 id:string;revision:number;kind:'linked'|'cleared'|'reviewed'|'retired';
 mediaId?:string;sha256?:string;promptDigest:string;visualDigest:string;bindingDigest:string;referenceDigest:string;
 provenance:{kind:'existing_media'|'external_upload'|'carry_over'|'reuse_changed_basis'|'legacy_adoption';sourceEventId?:string};
 reviewStatus:'needs_review'|'approved'|'needs_changes';note?:string;createdAt:string;
}
export interface FrameVideoReviewEvent{ id:string;shotId:string;sceneId:string;kind:'requested'|'reviewed';basis:FrameVideoReviewBasis;createdAt:string;note?:string }
export interface FrameImagePointer extends FrameImageIdentity{eventId:string}
export interface FrameProductionV1{version:1;revision:number;imageEvents:FrameImageEvent[];active:FrameImagePointer[];videoReviews:FrameVideoReviewEvent[]}
export interface DraftFrameImageAssignment extends Omit<FramePromptProof,'promptDigest'>{promptDigest?:string;mediaId:string;sha256:string;provenance:FrameImageEvent['provenance'];updatedAt:string}
export interface FramePromptProof{visualDigest:string;bindingDigest:string;referenceDigest:string;promptDigest:string}
export interface FrameMediaProof{signature:string;sha256:string}
