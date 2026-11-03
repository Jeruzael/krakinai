import type {SceneDraft} from '../../types/domain';
import type {SceneBlockingV1} from '../../types/blocking';
import {canonicalStringify} from '../../domain/changeSetCanonical';
type Source=Pick<SceneDraft,'id'|'inputRevision'|'blocking'>;
interface HeldBlockingEdit{baseline:string;value:SceneBlockingV1|undefined}
// Current-tab memory only. No database, browser storage, approval or saved prompt writes.
const held=new Map<string,HeldBlockingEdit>();
const key=(source:Source)=>JSON.stringify([source.id,source.inputRevision]);
export function recoverBlockingEdit(source:Source):HeldBlockingEdit|undefined{const item=held.get(key(source));return item?.baseline===canonicalStringify(source.blocking??null)?structuredClone(item):undefined;}
export function holdBlockingEdit(source:Source,baseline:string,value:SceneBlockingV1|undefined){held.set(key(source),{baseline,value:structuredClone(value)});}
export function discardBlockingEdit(source:Source){held.delete(key(source));}
