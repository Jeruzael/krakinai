import type {OperationBase,ProjectTarget,RecordTarget} from './changeSet';
import type {FrameOutputDecisions,KeyframePatchV1} from './keyframes';
import type {FrameVideoDecision} from '../domain/frameVideoReview';

export interface KeyframeChangeFields {
 keyframes?:KeyframePatchV1|null;
 expectedKeyframeDigest?:string;
 videoDecision?:FrameVideoDecision;
 imageCarryOver?:{frameId:string;associationId:string;expectedRevision:number}[];
}
export interface KeyframeApprovalFields {
 keyframes?:boolean;
 frameImages?:boolean;
 frameVideo?:boolean;
 frameOutputDecisions?:Record<string,FrameOutputDecisions>;
}
export interface FrameOperationTarget {
 project:ProjectTarget;
 shot:RecordTarget;
 scene:RecordTarget;
 frameId:string;
 expectedSceneRevision?:number;
 expectedFrameDigest:string;
 expectedAssociationRevision:number;
}
export type FrameImageOperation=OperationBase&FrameOperationTarget&(
 {type:'frame_image.link';mediaId:string}|{type:'frame_image.clear'}
);
export type FrameVideoOperation=OperationBase&{
 type:'frame_video.request_review';project:ProjectTarget;shot:RecordTarget;scene:RecordTarget;
 expectedSceneRevision?:number;expectedKeyframeDigest:string;
};
