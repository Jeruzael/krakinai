import type {ChangeSet,ChangeSetPlan,ChangeSetReceipt,ChangeSetState} from '../types/changeSet';
/** Actual planned IDs only; a receipt never grants plan, prompt or media access. */
export function frameReceiptResults(input:ChangeSet,plan:ChangeSetPlan,state:ChangeSetState):Extract<ChangeSetReceipt,{version:3}>['frameResults']{
 const priorEvents=new Set(state.collections.flatMap(c=>c.project?.frameProduction?.imageEvents.map(e=>e.id)??[]));
 return plan.operations.flatMap(row=>{
  const op=input.operations.find(op=>op.operationId===row.operationId),saved=plan.scenes.find(s=>s.id===plan.results.find(r=>r.operationId===row.operationId)?.recordId);
  const resolved=row.resolved as {frameImage?:{sceneId:string;frameId:string;id:string};videoReview?:{sceneId:string}}|undefined;
  const sceneId=saved?.id??resolved?.frameImage?.sceneId??resolved?.videoReview?.sceneId;if(!op||!sceneId)return[];
  const scene=saved??state.scenes.find(s=>s.id===sceneId),associationIds=resolved?.frameImage?[resolved.frameImage.id]:plan.collections.flatMap(c=>c.project?.frameProduction?.imageEvents.filter(e=>e.sceneId===sceneId&&!priorEvents.has(e.id)).map(e=>e.id)??[]);
  return[{operationId:row.operationId,sceneId,frameIds:resolved?.frameImage?[resolved.frameImage.frameId]:(scene?.keyframePlan?.frames.map(f=>f.id)??[]),associationIds}];
 });
}
