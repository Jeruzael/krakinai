import type {ReviewDraftRecord} from '../types/proposalReview';
export interface FeedbackContext {sessionId?:string;scopeEpoch:number}
/** Ephemeral broker-owned evidence of an explicit share action. Never serialize this proof. */
export interface ReviewFeedbackShare extends FeedbackContext {
  sessionId:string;proposalId:string;packageDigest:string;text:string;rejectedAt:number;
}
export function feedbackForCurrentContext(record:ReviewDraftRecord,proof:ReviewFeedbackShare|undefined,context:FeedbackContext):{comment:string;rejectedAt:string}|undefined{
  const feedback=record.feedback;
  if(!feedback||!proof||record.disposition!=='rejected'||!context.sessionId||proof.sessionId!==context.sessionId||proof.scopeEpoch!==context.scopeEpoch||proof.proposalId!==record.id||proof.packageDigest!==record.packageDigest||proof.text!==feedback.text||proof.rejectedAt!==feedback.rejectedAt)return;
  return{comment:feedback.text,rejectedAt:new Date(feedback.rejectedAt).toISOString()};
}
