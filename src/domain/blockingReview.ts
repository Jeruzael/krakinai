import type {SavedScene,Collection} from '../types/domain';
import type {SceneBlockingV1} from '../types/blocking';
import type {ChangeSetPlan} from '../types/changeSet';
import {canonicalStringify} from './changeSetCanonical';
import {ensembleReviewedProjection} from './changeSetRecipeContent';
import {compareBlockingPair} from './blockingContinuity';

export interface BlockingDifference {path:string;before:unknown;after:unknown}
/** Stable row identity in differences; no index-based retargeting after a removal. */
export function blockingDifferences(before:SceneBlockingV1|undefined,after:SceneBlockingV1|undefined):BlockingDifference[]{
 const changes:BlockingDifference[]=[];
 const walk=(a:unknown,b:unknown,path:string)=>{
  if(canonicalStringify(a??null)===canonicalStringify(b??null))return;
  if(Array.isArray(a)&&Array.isArray(b)){
   const key=(r:any)=>typeof r?.id==='string'?r.id:r?.participant?canonicalStringify(r.participant):undefined;
   if([...a,...b].every(r=>key(r)!==undefined)){
    const left=a.map(key),right=b.map(key);if(canonicalStringify(left)!==canonicalStringify(right))changes.push({path:path+'.order',before:left,after:right});
    for(const id of new Set([...left,...right]))walk(a.find(r=>key(r)===id),b.find(r=>key(r)===id),`${path}[${id}]`);return;
   }
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
   const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;for(const key of new Set([...Object.keys(aa),...Object.keys(bb)]))walk(aa[key],bb[key],path+'.'+key);return;
  }
  changes.push({path,before:structuredClone(a??null),after:structuredClone(b??null)});
 };
 walk(before,after,'blocking');return changes;
}
export function buildBlockingFinalReview(collections:Collection[],scenes:SavedScene[],newScenes:SavedScene[]){
 return collections.filter(c=>!!c.project).map(c=>{
  const shots=c.project!.shots,comparisons:({kind:'selected_takes'|'proposed_unselected_take';previousShotId?:string;shotId:string;previousSceneId?:string;currentSceneId:string;comparison?:ReturnType<typeof compareBlockingPair>})[]=[];
  for(let i=0;i<shots.length;i++){
   const shot=shots[i],previous=i>0?shots[i-1]:undefined,prior=scenes.find(s=>s.id===previous?.selectedSceneId),selected=scenes.find(s=>s.id===shot.selectedSceneId);
   if(selected)comparisons.push({kind:'selected_takes',previousShotId:previous?.id,shotId:shot.id,previousSceneId:prior?.id,currentSceneId:selected.id,...(prior?{comparison:compareBlockingPair(prior,selected)}:{})});
   for(const proposed of newScenes.filter(s=>shot.takeSceneIds.includes(s.id)&&s.id!==shot.selectedSceneId))comparisons.push({kind:'proposed_unselected_take',previousShotId:previous?.id,shotId:shot.id,previousSceneId:prior?.id,currentSceneId:proposed.id,...(prior?{comparison:compareBlockingPair(prior,proposed)}:{})});
  }
  return{projectId:c.id,finalRevision:c.project!.revision,finalShotOrder:shots.map(s=>s.id),selectedTakes:shots.map(s=>({shotId:s.id,sceneId:s.selectedSceneId??null})),comparisons};
 });
}
export type BlockingFinalReview=ReturnType<typeof buildBlockingFinalReview>;
/** V5-only content: legacy reviewed projections are never changed. */
export function blockingReviewedProjection(plan:ChangeSetPlan){
 return{review:ensembleReviewedProjection(plan),blockingScenes:plan.scenes.map(s=>({sceneId:s.id,blocking:s.blocking??null})),blockingContinuity:plan.blockingContinuity??[]};
}
