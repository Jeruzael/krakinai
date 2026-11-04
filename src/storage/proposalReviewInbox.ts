import {validateReviewDraft,reviewBytes,REVIEW_INBOX_MAX_ITEMS,REVIEW_INBOX_MAX_BYTES} from '../domain/proposalReview';
import type {ReviewInbox,ReviewDraftRecord,ReviewInboxContents,ReviewUpdateOptions} from '../types/proposalReview';

export const REVIEW_INBOX_DB='krakinai_review_inbox_db';
const STORE='packages';
/** Separate uncommitted cache; never opens or changes the eight-store library. */
export class ReviewInboxRepository implements ReviewInbox{
  private database?:Promise<IDBDatabase>;
  private factory:IDBFactory;
  constructor(private options:{factory?:IDBFactory;name?:string}={}){this.factory=options.factory??indexedDB;}
  private open():Promise<IDBDatabase>{
    if(this.database)return this.database;
    this.database=new Promise((resolve,reject)=>{
      const request=this.factory.open(this.options.name??REVIEW_INBOX_DB,1);let failed=false;
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
      request.onerror=()=>{this.database=undefined;reject(request.error??Error('Cannot open local review inbox.'));};
      request.onblocked=()=>{failed=true;this.database=undefined;reject(Error('Local review inbox is blocked by another tab.'));};
      request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();this.database=undefined;};resolve(db);};
    });
    const pending=this.database;
    void pending.catch(()=>{if(this.database===pending)this.database=undefined;});
    return pending;
  }
  private async readAll():Promise<unknown[]>{
    const db=await this.open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll(undefined,REVIEW_INBOX_MAX_ITEMS+1);
      tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error??Error('Cannot read local review inbox.'));
    });
  }
  async list():Promise<ReviewInboxContents>{
    const rows=await this.readAll();if(rows.length>REVIEW_INBOX_MAX_ITEMS)throw Error('Local review inbox exceeds its eight-package limit.');
    const result:ReviewInboxContents={records:[],invalid:[]};
    for(const row of rows){try{result.records.push(await validateReviewDraft(row));}catch(error){result.invalid.push({id:String((row as {id?:unknown})?.id??''),error:error instanceof Error?error.message:'Invalid saved review.'});}}
    return result;
  }
  private async mutate<T>(callback:(rows:ReviewDraftRecord[],store:IDBObjectStore)=>T):Promise<T>{
    const db=await this.open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.getAll(undefined,REVIEW_INBOX_MAX_ITEMS+1);let result:T,failure:unknown;
      request.onsuccess=()=>{try{result=callback(request.result,store);}catch(error){failure=error;tx.abort();}};
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure??tx.error??Error('Local review inbox write failed.'));
    });
  }
  async create(record:ReviewDraftRecord):Promise<ReviewDraftRecord>{
    const checked=await validateReviewDraft(record);
    return this.mutate((rows,store)=>{
      if(rows.length>=REVIEW_INBOX_MAX_ITEMS)throw Error('Local review inbox is full (8 packages). Download or remove an existing draft.');
      if(rows.some(r=>r.id===checked.id||r.changeSetId===checked.changeSetId))throw Error('This change-set identity already has a saved review draft.');
      const saved={...checked,revision:1};this.budget([...rows,saved]);store.add(saved);return saved;
    });
  }
  async update(record:ReviewDraftRecord,expectedRevision:number,options:ReviewUpdateOptions={}):Promise<ReviewDraftRecord>{
    const checked=await validateReviewDraft(record);
    return this.mutate((rows,store)=>{
      const old=rows.find(r=>r.id===checked.id);
      if(!old)throw Error('The saved review was removed or is missing.');
      if(old.revision!==expectedRevision)throw Error('The saved review changed in another tab. Reload before editing.');
      if(old.packageDigest!==checked.packageDigest||old.changeSetId!==checked.changeSetId||old.origin!==checked.origin||old.firstReceivedAt!==checked.firstReceivedAt)throw Error('Saved package identity cannot be changed.');
      if(old.disposition==='applying'&&!options.finishApply)throw Error('This package is applying. Check its actual outcome before editing.');
      if(old.disposition==='rejected'&&checked.disposition!=='rejected'&&!options.reconsider)throw Error('A rejected package needs explicit reconsideration.');
      if(old.disposition==='applied'&&checked.disposition!=='applied'&&!options.finishApply)throw Error('Applied review needs authoritative receipt recovery.');
      if((old.expiresAt!==checked.expiresAt||old.windowStartedAt!==checked.windowStartedAt)&&!options.renew)throw Error('Renew the review window explicitly.');
      const saved={...checked,revision:expectedRevision+1,updatedAt:Math.max(checked.updatedAt,Date.now())};
      this.budget(rows.map(r=>r.id===saved.id?saved:r));store.put(saved);return saved;
    });
  }
  async remove(id:string,expectedRevision:number|null):Promise<void>{
    let invalidFingerprint:string|undefined;
    if(expectedRevision===null){
      const raw=(await this.readAll()).find(row=>(row as {id?:string})?.id===id);
      if(!raw)throw Error('Saved review is missing.');
      let valid=false;try{await validateReviewDraft(raw);valid=true;}catch{/* Explicit deletion is allowed only for the same malformed bytes. */}
      if(valid)throw Error('A valid saved review requires its exact revision.');
      invalidFingerprint=JSON.stringify(raw);
    }
    return this.mutate((rows,store)=>{
      const old=rows.find(r=>r.id===id);if(!old)throw Error('Saved review is missing.');
      if(expectedRevision!==null&&old.disposition==='applying')throw Error('This package is applying. Check its outcome first.');
      if(expectedRevision===null){if(JSON.stringify(old)!==invalidFingerprint)throw Error('Malformed saved review changed in another tab.');}
      else if(old.revision!==expectedRevision)throw Error('Saved review changed in another tab.');
      store.delete(id);
    });
  }
  async exportRaw(id:string):Promise<string>{
    const row=(await this.readAll()).find(row=>(row as {id?:string})?.id===id);
    if(!row)throw Error('Saved review is unavailable.');
    if(reviewBytes(row)>REVIEW_INBOX_MAX_BYTES)throw Error('Malformed review is too large to export safely.');
    return JSON.stringify(row,null,2)+'\n';
  }
  private budget(rows:unknown[]){if(reviewBytes(rows)>REVIEW_INBOX_MAX_BYTES)throw Error('Local review inbox exceeds its 10 MiB allowance.');}
  async close(){const db=await this.database;db?.close();this.database=undefined;}
}
