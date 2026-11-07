import {createReviewDraft,validateReviewDraft,REVIEW_INBOX_MAX_ITEMS} from '../domain/proposalReview';
import {McpError} from '../domain/mcpProtocol';
import {changeSetDigest} from '../domain/changeSetCanonical';
import type {ChangeSet} from '../types/changeSet';
import type {McpProposalView} from '../types/mcp';
import type {ReviewDraftRecord,ReviewInbox,ReviewUpdateOptions,InvalidReviewDraft} from '../types/proposalReview';
const messageOf=(error:unknown,fallback:string)=>error&&typeof error==='object'&&'message'in error&&typeof error.message==='string'?error.message:fallback;

/** Content cache only. The broker never derives session or approval authority from this class. */
export class ProposalInbox {
  private records=new Map<string,ReviewDraftRecord>();
  private persisted=new Set<string>();
  private errors=new Map<string,string>();
  private loading?:Promise<void>;
  private writes:Promise<unknown>=Promise.resolve();
  error?:string;
  invalid:InvalidReviewDraft[]=[];
  constructor(private repository:ReviewInbox|undefined,private origin:string,private now:()=>number){}
  initialize():Promise<void>{
    if(!this.loading)this.loading=(async()=>{
      if(!this.repository)return;
      try{const result=await this.repository.list();this.invalid=result.invalid;
        for(const record of result.records){
          if(record.origin!==this.origin){this.invalid.push({id:record.id,error:'This review belongs to a different application origin.'});continue;}
          this.records.set(record.id,record);this.persisted.add(record.id);
        }
      }catch(error){this.error=messageOf(error,'Cannot load local review drafts.');}
    })();return this.loading;
  }
  all(){return [...this.records.values()].map(r=>structuredClone(r));}
  record(id:string){const r=this.records.get(id);return r?structuredClone(r):undefined;}
  findByChangeSetId(changeSetId:string):ReviewDraftRecord|undefined{
    const r=[...this.records.values()].find(rec=>rec.changeSetId===changeSetId);
    return r?structuredClone(r):undefined;
  }
  annotate(p:McpProposalView){p.draft=this.record(p.id);p.persisted=this.persisted.has(p.id);p.cacheError=this.errors.get(p.id);}
  async upsertDraftChangeSet(changeSet:ChangeSet):Promise<ReviewDraftRecord>{
    await this.initialize();
    const existing=this.findByChangeSetId(changeSet.changeSetId);
    if(!existing){
      return this.admit(changeSet);
    }
    if(existing.disposition==='applying'||existing.disposition==='applied'){
      throw new McpError('CONFLICT','Cannot modify a proposal that is already applying or applied.');
    }
    const packageDigest=await changeSetDigest(changeSet);
    const updated=await this.update(
      existing.id,
      {
        changeSet:structuredClone(changeSet),
        packageDigest,
        disposition:'review',
        progress:{
          ...existing.progress,
          draftDecisions:undefined,
        },
      },
      {allowPackageUpdate:true},
    );
    return updated;
  }
  async discard(idOrChangeSetId:string):Promise<{discarded:true;proposalId:string}>{
    await this.initialize();
    const record=this.records.get(idOrChangeSetId)||this.findByChangeSetId(idOrChangeSetId);
    if(!record){
      throw new McpError('NOT_FOUND',`Proposal "${idOrChangeSetId}" was not found in the Review Inbox.`);
    }
    if(record.disposition==='applying'||record.disposition==='applied'){
      throw new McpError('CONFLICT',`Proposal "${record.id}" is already applying or applied and cannot be discarded.`);
    }
    await this.remove(record.id);
    return {discarded:true,proposalId:record.id};
  }
  async admit(changeSet:ChangeSet):Promise<ReviewDraftRecord>{
    await this.initialize();if(this.error)throw new McpError('QUEUE_FULL','Local review drafts could not be loaded. Resolve the inbox storage error before submitting.');
    if(this.records.size+this.invalid.length>=REVIEW_INBOX_MAX_ITEMS)throw new McpError('QUEUE_FULL','The local review inbox is full. Download or remove an existing draft.');
    let r=await createReviewDraft(changeSet,this.now(),this.origin);
    if(this.repository){
      try{r=await this.repository.create(r);this.persisted.add(r.id);}
      catch(error){
        const message=messageOf(error,'Local draft was not saved.');
        if(/full|identity already|changed in another tab/i.test(message))throw new McpError('QUEUE_FULL',message);
        this.errors.set(r.id,message);
      }
    }
    this.records.set(r.id,r);return structuredClone(r);
  }
  async update(id:string,patch:Partial<ReviewDraftRecord>|((current:ReviewDraftRecord)=>Partial<ReviewDraftRecord>),options:ReviewUpdateOptions={}):Promise<ReviewDraftRecord>{
    const write=async()=>{
      const current=this.records.get(id);if(!current)throw Error('Saved review is missing.');
      const changes=typeof patch==='function'?patch(structuredClone(current)):patch;
      const next=await validateReviewDraft({...current,...structuredClone(changes),id:current.id,updatedAt:this.now()});
      try{
        const saved=this.repository&&this.persisted.has(id)?await this.repository.update(next,current.revision,options):next;
        this.records.set(id,saved);if(this.persisted.has(id))this.errors.delete(id);return structuredClone(saved);
      }catch(error){this.errors.set(id,messageOf(error,'Could not save review progress.'));throw error;}
    };
    const result=this.writes.then(write);this.writes=result.catch(()=>undefined);return result;
  }
  async refresh(id:string):Promise<ReviewDraftRecord>{
    if(!this.repository||!this.persisted.has(id)){const r=this.record(id);if(!r)throw Error('Saved review is missing.');return r;}
    const r=(await this.repository.list()).records.find(r=>r.id===id);
    if(!r)throw Error('Saved review was removed or became unavailable in another tab.');
    if(r.origin!==this.origin)throw Error('Saved review origin changed.');this.records.set(id,r);return structuredClone(r);
  }
  async remove(id:string){
    await this.writes;const r=this.records.get(id);if(!r)throw Error('Saved review is missing.');
    if(this.repository&&this.persisted.has(id))await this.repository.remove(id,r.revision);
    this.records.delete(id);this.persisted.delete(id);this.errors.delete(id);
  }
  async removeInvalid(id:string){if(!this.repository||!this.invalid.some(r=>r.id===id))throw Error('Unavailable review record.');await this.repository.remove(id,null);this.invalid=this.invalid.filter(r=>r.id!==id);}
  async exportRaw(id:string){if(!this.repository)throw Error('The local review repository is unavailable.');return this.repository.exportRaw(id);}
}
