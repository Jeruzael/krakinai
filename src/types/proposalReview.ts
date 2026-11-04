import type {ChangeSet,ChangeSetApproval} from './changeSet';

/** Local review hints only. None of these fields can confer save or sharing authority. */
export interface ReviewProgress {
  selectedOperationId?: string;
  selectedTab?: string;
  viewedOperations: Record<string,string>;
  draftDecisions?: Pick<ChangeSetApproval,'assetDecisions'|'variantDecisions'|'conversionDecisions'|'blockingOutputDecisions'|'frameOutputDecisions'>;
}
export interface ReviewFeedback {
  text: string;
  rejectedAt: number;
  /** Display history only. A restored value never authorizes disclosure in another session. */
  sharedPreviously: boolean;
}
export interface ReviewDraftRecord {
  version: 1;
  id: string;
  revision: number;
  origin: string;
  changeSetId: string;
  packageDigest: string;
  changeSet: ChangeSet;
  firstReceivedAt: number;
  windowStartedAt: number;
  expiresAt: number;
  updatedAt: number;
  disposition: 'review'|'rejected'|'applying'|'applied';
  progress: ReviewProgress;
  feedback?: ReviewFeedback;
}
export interface InvalidReviewDraft {id:string;error:string}
export interface ReviewInboxContents {records:ReviewDraftRecord[];invalid:InvalidReviewDraft[]}
export interface ReviewUpdateOptions {renew?:boolean;reconsider?:boolean;finishApply?:boolean}
export interface ReviewInbox {
  list():Promise<ReviewInboxContents>;
  create(record:ReviewDraftRecord):Promise<ReviewDraftRecord>;
  update(record:ReviewDraftRecord,expectedRevision:number,options?:ReviewUpdateOptions):Promise<ReviewDraftRecord>;
  remove(id:string,expectedRevision:number|null):Promise<void>;
  exportRaw(id:string):Promise<string>;
  close():Promise<void>;
}
