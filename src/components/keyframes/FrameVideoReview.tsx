import {useEffect,useState} from 'react';
import type {Collection,SavedScene} from '../../types/domain';
import type {FrameVideoDecision} from '../../domain/frameVideoReview';
import {isFrameVideoReviewCurrent} from '../../domain/frameVideoReview';
import type {FrameVideoReviewBasis} from '../../types/keyframes';
import {recordFrameVideoReview} from '../../storage/frameImages';
export function FrameVideoReview({decision,onDecision,collection,scene,shotId,basis,onChanged}:{decision?:FrameVideoDecision;onDecision?(value:FrameVideoDecision|undefined):void;collection?:Collection;scene?:SavedScene;shotId?:string;basis?:FrameVideoReviewBasis;onChanged():Promise<unknown>|unknown}){
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reviewed=collection?.project?.frameProduction?.videoReviews.filter(e=>e.sceneId===scene?.id&&e.shotId===shotId&&e.kind==='reviewed').at(-1),current=basis&&isFrameVideoReviewCurrent(reviewed?.basis,basis);
 useEffect(()=>setChecked(false),[JSON.stringify(basis),collection?.project?.revision,scene?.id,shotId]);
 return <section aria-label="Frame and video correspondence"><h3>Video correspondence</h3>{onDecision?<label>Video prompt decision<select aria-label="Video prompt decision" className="select" value={decision??''} onChange={e=>onDecision((e.target.value||undefined) as FrameVideoDecision|undefined)}><option value="">Choose before saving a new take</option><option value="keep_exact_unverified">Keep exact current video; correspondence unverified</option><option value="reassemble">Reassemble video from Recipe and authored frame moments</option></select></label>:<p>{current?'Reviewed against this exact frame plan and video text.':'Correspondence needs human review.'}</p>}
 <p className="muted-text">Compare motion, blocking, dialogue and each frame. Matching hashes identify the reviewed version; they do not prove semantic agreement.</p>
 {scene&&collection&&shotId&&basis&&<><label><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked the exact frames and video prompt for continuity</label><button className="btn btn-secondary btn-sm" disabled={!checked||busy} onClick={()=>{setBusy(true);setError('');void recordFrameVideoReview({collectionId:collection.id,expectedProjectRevision:collection.project!.revision,shotId,sceneId:scene.id,expectedSceneRevision:scene.revision,expectedBasis:basis}).then(()=>{setChecked(false);return onChanged();}).catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setBusy(false));}}>Record correspondence review</button></>}{error&&<p role="alert">{error}</p>}
 </section>;
}
