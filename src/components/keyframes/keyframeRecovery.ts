import type {SceneDraft} from '../../types/domain';
import type {KeyframePlanV1} from '../../types/keyframes';
import {canonicalStringify} from '../../domain/changeSetCanonical';
type Owner=Pick<SceneDraft,'id'|'inputRevision'|'keyframePlan'>;
interface Held {baseline:string;plan:KeyframePlanV1|undefined;selectedId:string|undefined}
// Current-tab memory only. No storage, crash durability or automatic rebasing.
const held=new Map<string,Held>(),key=(owner:Owner)=>JSON.stringify([owner.id,owner.inputRevision]);
export function recoverKeyframeEdit(owner:Owner){const value=held.get(key(owner));return value?.baseline===canonicalStringify(owner.keyframePlan??null)?structuredClone(value):undefined;}
export function holdKeyframeEdit(owner:Owner,baseline:string,plan:KeyframePlanV1|undefined,selectedId?:string){held.set(key(owner),{baseline,plan:structuredClone(plan),selectedId});}
export function discardKeyframeEdit(owner:Owner){held.delete(key(owner));}
