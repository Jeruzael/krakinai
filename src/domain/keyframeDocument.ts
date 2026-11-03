import type {KeyframePlanV1,ImagePromptSnapshotV1,ManualImageOutputs} from '../types/keyframes';
import {assertPlainKeyframeJson} from './keyframeValidation';
export interface KeyframeDocumentSource{keyframePlan?:KeyframePlanV1;imagePromptSnapshots?:Record<string,ImagePromptSnapshotV1>;manualImageOutputs?:ManualImageOutputs}
export interface KeyframeDocumentProjection{plan:KeyframePlanV1;imagePrompts?:Record<string,ImagePromptSnapshotV1>;manualImageOutputs?:ManualImageOutputs}
export function hasKeyframeDocumentData(source:KeyframeDocumentSource):boolean{return source.keyframePlan!==undefined||source.imagePromptSnapshots!==undefined||source.manualImageOutputs!==undefined;}
/** Frozen authored data and strings only; inspecting/exporting never reassembles a saved prompt. */
export function projectKeyframeDocument(source:KeyframeDocumentSource):KeyframeDocumentProjection|undefined{
 if(!hasKeyframeDocumentData(source))return;
 if(!source.keyframePlan)throw Error('A C document needs its exact frame plan. Preserve the draft and review Image Frames.');
 assertPlainKeyframeJson(source.keyframePlan);
 return{plan:structuredClone(source.keyframePlan),...(source.imagePromptSnapshots!==undefined?{imagePrompts:structuredClone(source.imagePromptSnapshots)}:{}),...(source.manualImageOutputs!==undefined?{manualImageOutputs:structuredClone(source.manualImageOutputs)}:{})};
}
