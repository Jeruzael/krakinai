import {parseChangeSet} from './changeSetValidation';
import {changeSetDigest} from './changeSetCanonical';
import {MCP_LIMITS} from './mcpProtocol';
import {findCandidateMatches, normalize, normalizeBaseTitle} from './changeSetCandidates';
import type {ChangeSet, ChangeSetApproval, ChangeSetState} from '../types/changeSet';
import type {McpScope} from '../types/mcp';
import type {ReviewDraftRecord,ReviewProgress} from '../types/proposalReview';

export const REVIEW_WINDOW_MS=MCP_LIMITS.proposalMs;
/** Not a valid change-set operation ID, so global findings cannot collide. */
export const REVIEW_BATCH_ID='@batch';
export const REVIEW_INBOX_MAX_ITEMS=8;
export const REVIEW_INBOX_MAX_BYTES=10*1024*1024;
export const REVIEW_METADATA_MAX_BYTES=64*1024;
export const REVIEW_FEEDBACK_MAX_CHARACTERS=2000;
export const REVIEW_FEEDBACK_MAX_BYTES=8*1024;
export const reviewBytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
const fail=(message:string):never=>{throw Error(message);};
function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Invalid saved review record.');
  return value as Record<string,unknown>;
}
function keys(value:Record<string,unknown>,allowed:readonly string[],required:readonly string[]=allowed){
  if(Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))fail('Unknown or missing saved review field. Authorization cannot be restored.');
}
const timestamp=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(v);
export function validateReviewFeedback(text:string):string{
  if(typeof text!=='string')fail('Feedback must be plain text.');
  if([...text].length>REVIEW_FEEDBACK_MAX_CHARACTERS)fail('Feedback is limited to 2,000 Unicode characters.');
  if(new TextEncoder().encode(text).length>REVIEW_FEEDBACK_MAX_BYTES)fail('Feedback is limited to 8 KiB UTF-8.');
  return text;
}
function validateProgress(input:unknown):ReviewProgress{
  const p=object(input);keys(p,['selectedOperationId','selectedTab','viewedOperations','draftDecisions'],['viewedOperations']);
  if(p.selectedOperationId!==undefined&&p.selectedOperationId!==REVIEW_BATCH_ID&&!id(p.selectedOperationId))fail('Invalid selected operation.');
  if(p.selectedTab!==undefined&&(typeof p.selectedTab!=='string'||!['summary','recipe','blocking','frames','video','data'].includes(p.selectedTab)))fail('Invalid review tab.');
  const viewed=object(p.viewedOperations);
  if(Object.entries(viewed).some(([key,value])=>(key!==REVIEW_BATCH_ID&&!id(key))||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)))fail('Invalid viewed-operation fingerprint.');
  if(p.draftDecisions!==undefined)keys(object(p.draftDecisions),['assetDecisions','variantDecisions','conversionDecisions','blockingOutputDecisions','frameOutputDecisions'],[]);
  return structuredClone(p) as unknown as ReviewProgress;
}
export function reviewWindowExpired(record:Pick<ReviewDraftRecord,'expiresAt'>,now:number){return now>=record.expiresAt;}
export async function validateReviewDraft(input:unknown):Promise<ReviewDraftRecord>{
  const r=object(input);
  const required=['version','id','revision','origin','changeSetId','packageDigest','changeSet','firstReceivedAt','windowStartedAt','expiresAt','updatedAt','disposition','progress'];
  keys(r,[...required,'feedback'],required);
  if(r.version!==1||!id(r.id)||!timestamp(r.revision))fail('Unsupported saved review version or revision.');
  if(typeof r.origin!=='string')fail('Invalid saved review origin.');
  let origin:URL;try{origin=new URL(r.origin as string);}catch{fail('Invalid saved review origin.');}
  if(origin!.protocol!=='http:'||!['localhost','127.0.0.1'].includes(origin!.hostname)||origin!.origin!==r.origin)fail('Invalid saved review origin.');
  for(const key of['firstReceivedAt','windowStartedAt','expiresAt','updatedAt'])if(!timestamp(r[key]))fail('Invalid saved review timestamp.');
  if(Number(r.windowStartedAt)<Number(r.firstReceivedAt)||Number(r.expiresAt)-Number(r.windowStartedAt)!==REVIEW_WINDOW_MS||Number(r.updatedAt)<Number(r.firstReceivedAt))fail('Invalid saved review window.');
  if(!['review','rejected','applying','applied'].includes(String(r.disposition)))fail('Invalid saved review disposition.');
  if(reviewBytes(r.changeSet)>MCP_LIMITS.package)fail('Review package exceeds the existing 1 MiB MCP package limit.');
  const changeSet=parseChangeSet(r.changeSet);
  if(changeSet.changeSetId!==r.changeSetId||await changeSetDigest(changeSet)!==r.packageDigest)fail('Saved review package digest or identity changed.');
  const progress=validateProgress(r.progress);
  if(r.feedback!==undefined){const f=object(r.feedback);keys(f,['text','rejectedAt','sharedPreviously']);validateReviewFeedback(f.text as string);if(!timestamp(f.rejectedAt)||typeof f.sharedPreviously!=='boolean')fail('Invalid saved feedback.');}
  const {changeSet:unused,...metadata}=r;void unused;
  if(reviewBytes(metadata)>REVIEW_METADATA_MAX_BYTES)fail('Saved review metadata exceeds 64 KiB.');
  return {...structuredClone(r),changeSet:structuredClone(changeSet),progress} as unknown as ReviewDraftRecord;
}
export async function createReviewDraft(changeSet:ChangeSet,now:number,origin='http://localhost:5173'):Promise<ReviewDraftRecord>{
  if(reviewBytes(changeSet)>MCP_LIMITS.package)fail('Review package exceeds the existing 1 MiB MCP package limit.');
  const parsed=parseChangeSet(changeSet);
  return validateReviewDraft({version:1,id:crypto.randomUUID(),revision:0,origin,changeSetId:parsed.changeSetId,packageDigest:await changeSetDigest(parsed),changeSet:parsed,firstReceivedAt:now,windowStartedAt:now,expiresAt:now+REVIEW_WINDOW_MS,updatedAt:now,disposition:'review',progress:{viewedOperations:{}}});
}

export function buildSmartInitialApproval(
  changeSet: ChangeSet,
  state: Pick<ChangeSetState, 'assets' | 'templates'> & { variants?: ChangeSetState['variants'] },
  scope?: McpScope,
): ChangeSetApproval {
  const approval: ChangeSetApproval = {
    storyboard: true,
    scenes: true,
    preferred: true,
    statuses: true,
    assetDecisions: {},
    variantDecisions: {},
    allowDuplicateSceneOperations: [],
    ...(changeSet.schema === 'krakinai.change-set.v5' || changeSet.schema === 'krakinai.change-set.v6' ? { blocking: true } : {}),
    ...(changeSet.schema === 'krakinai.change-set.v6' ? { keyframes: true, frameImages: true, frameVideo: true } : {}),
  };

  const scopedAssets = scope ? (state.assets ?? []).filter((a) => scope.assetIds.includes(a.id)) : (state.assets ?? []);
  const scopedTemplates = scope ? (state.templates ?? []).filter((t) => (scope.templateIds ?? []).includes(t.id)) : (state.templates ?? []);

  for (const op of changeSet.operations) {
    if (op.type === 'asset.propose') {
      const candidate = {
        kind: op.kind,
        title: op.title,
        promptText: op.promptText ?? '',
        tags: op.tags ?? [],
      };
      const matches = findCandidateMatches(candidate, { assets: scopedAssets, templates: scopedTemplates });
      if (matches.length > 0) {
        const top = matches[0];
        approval.assetDecisions[op.operationId] = {
          action: 'reuse',
          assetId: top.id,
          expectedRevision: top.revision,
        };
      } else {
        approval.assetDecisions[op.operationId] = {
          action: 'create',
          acknowledgeDuplicate: false,
        };
      }
    } else if (op.type === 'variant.propose') {
      const parentId = (op as any).parentCharacterId;
      const scopedVariants = (state.variants ?? []).filter((v) =>
        (!scope || scope.variantIds.includes(v.id)) &&
        (!parentId || v.parentCharacterId === parentId)
      );
      const matched = scopedVariants.find((v) =>
        normalize(v.name) === normalize((op as any).label) ||
        normalizeBaseTitle(v.name) === normalizeBaseTitle((op as any).label)
      );
      if (matched) {
        approval.variantDecisions![op.operationId] = {
          action: 'reuse',
          variantId: matched.id,
          expectedRevision: matched.revision,
        };
      } else {
        approval.variantDecisions![op.operationId] = {
          action: 'create',
          acknowledgeDuplicate: false,
        };
      }
    }
  }

  return approval;
}
