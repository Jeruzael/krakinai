import type {ChangeSetApproval,ChangeSetPreview} from '../../types/changeSet';
import type {PreparedFrameAuthoring} from '../../domain/frameAuthoring';
export function KeyframeProposalApprovals({preview,disabled,onApproval}:{preview:ChangeSetPreview;disabled:boolean;onApproval(value:ChangeSetApproval):void}){
  if(preview.changeSet.schema!=='krakinai.change-set.v6')return null;
  const values=preview.plan.operations.map(row=>(row.resolved as {keyframes?:PreparedFrameAuthoring}|undefined)?.keyframes);
  const plans=values.some(v=>v?.beforePlan||v?.afterPlan),blocking=values.some(v=>v?.beforeBlocking||v?.afterBlocking);
  const images=preview.changeSet.operations.some(op=>op.type.startsWith('frame_image.')||'imageCarryOver'in op&&!!op.imageCarryOver?.length);
  const video=plans||preview.changeSet.operations.some(op=>op.type==='frame_video.request_review');
  return <fieldset className="card pr-frame-approvals" disabled={disabled}><legend>Approve exact frame changes</legend>{([{field:'blocking',label:'Approve Blocking changes',needed:blocking},{field:'keyframes',label:'Approve keyframe and image-prompt changes',needed:plans},{field:'frameImages',label:'Approve image associations and carry-over',needed:images},{field:'frameVideo',label:'Approve frame video decision',needed:video}] as const).filter(item=>item.needed).map(item=><label className="import-check" key={item.field}><input type="checkbox" aria-label={item.label} checked={!!preview.approval[item.field]} onChange={event=>onApproval({...preview.approval,[item.field]:event.target.checked})}/><span>{item.label}</span></label>)}</fieldset>;
}
