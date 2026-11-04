import {it,expect} from 'vitest';
import {validateImportLedger,prepareImportLedger,MAX_IMPORT_LEDGER_BYTES} from '../domain/changeSetLedger';
import {encodeImportEvidence} from '../domain/importEvidence';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {emptyChangeSetApproval} from '../types/changeSet';
import {assessImportCapacity} from '../domain/changeSetCapacity';
import {emptyState,syntheticCamera} from './fixtures/changeSetFixture';
import {incompressibleImportLedger} from './fixtures/importHistoryFixture';
const base={version:1 as const,changeSetId:'history',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex' as const},appliedAt:'2026-11-05T00:00:00Z',approval:emptyChangeSetApproval(),idMappings:{},operations:[{operationId:'update',type:'project.update' as const,status:'updated' as const}],projectRevisions:{}};
const review=(bytes:number)=>{const shape={collections:[],findings:[{message:''}],operations:[],scenes:[]},overhead=canonicalStringify(shape).length;shape.findings[0].message='x'.repeat(bytes-overhead);return canonicalStringify(shape);};
it('constructs exactly 4 MiB of high-entropy evidence including literal dollar replacement patterns',async()=>{
 const ledger=await incompressibleImportLedger();expect((await prepareImportLedger(ledger)).expandedBytes).toBe(4*1024*1024);expect(JSON.stringify(ledger).length).toBeGreaterThan(4*1024*1024);
},30000);
it('accepts exactly 8 MiB stored and rejects one byte over without discarding legacy evidence',()=>{
 const receipt=(i:number,bytes:number)=>({...base,version:3,changeSetId:'history-'+i,changeSetSchema:'krakinai.change-set.v6',reviewedContent:review(bytes),frameResults:[]});
 const ledger:any={version:4,receipts:[receipt(1,4*1024*1024),receipt(2,4*1024*1024-2000)],candidates:[]};
 const difference=MAX_IMPORT_LEDGER_BYTES-new TextEncoder().encode(JSON.stringify(ledger)).length;ledger.receipts[1].reviewedContent=review(4*1024*1024-2000+difference);
 expect(new TextEncoder().encode(JSON.stringify(ledger)).length).toBe(MAX_IMPORT_LEDGER_BYTES);expect(()=>validateImportLedger(ledger)).not.toThrow();
 ledger.receipts[1].title='x';expect(()=>validateImportLedger(ledger)).toThrow(/8 MiB/);
});
it('accepts 32 MiB expanded evidence and rejects another compact receipt while stored bytes still fit',async()=>{
 const evidence=await encodeImportEvidence(review(4*1024*1024)),receipt=(i:number)=>({...base,version:4 as const,changeSetId:'expanded-'+i,changeSetSchema:'krakinai.change-set.v6' as const,reviewedEvidence:evidence,frameResults:[]});
 const ledger={version:4 as const,receipts:Array.from({length:8},(_,i)=>receipt(i)),candidates:[]};
 expect((await prepareImportLedger(ledger)).expandedBytes).toBe(32*1024*1024);expect(JSON.stringify(ledger).length).toBeLessThan(MAX_IMPORT_LEDGER_BYTES);
 expect(()=>validateImportLedger({...ledger,receipts:[...ledger.receipts,receipt(8)]})).toThrow(/32 MiB/);
},30000);
it('enforces the unchanged receipt and combined candidate count bounds independently',()=>{
 const receipts=Array.from({length:1000},(_,i)=>({...base,changeSetId:'count-'+i})),ledger:any={version:4,receipts,candidates:[]};expect(()=>validateImportLedger(ledger)).not.toThrow();
 expect(()=>validateImportLedger({...ledger,receipts:[...receipts,{...base,changeSetId:'extra'}]})).toThrow(/1,000/);
 const candidates=Array.from({length:250},(_,i)=>({id:'candidate-'+i,revision:1,kind:'environment',title:'Synthetic candidate '+i,promptText:'Unreviewed synthetic environment.',description:'',tags:[],notes:'',source:{kind:'codex'},changeSetId:'candidates',operationId:'asset-'+i,status:'pending',createdAt:base.appliedAt,updatedAt:base.appliedAt}));
 const source={...base,changeSetId:'candidates',operations:candidates.map(c=>({operationId:c.operationId,type:'asset.propose',status:'candidate_pending'}))};
 expect(()=>validateImportLedger({version:4,receipts:[source],candidates})).not.toThrow();expect(()=>validateImportLedger({version:4,receipts:[source],candidates,variantCandidates:[{}]})).toThrow(/250/);
});
it('reports all independently exceeded allowances and leaves backup metadata at 20 MiB',()=>{
 const state=emptyState(),plan:any={assets:[],variants:[],scenes:[],templates:[],collections:[],candidates:[]},camera=syntheticCamera();
 state.assets=Array.from({length:215},(_,i)=>({...camera,id:'synthetic-large-'+i,promptText:'x'.repeat(97000)}));
 plan.assets=Array.from({length:4},(_,i)=>({...camera,id:'synthetic-add-'+i,promptText:'y'.repeat(97000)}));
 const previous:any={version:4,receipts:Array.from({length:1000},(_,i)=>({...base,changeSetId:'many-'+i})),candidates:[]};
 const result=assessImportCapacity(state,plan,previous,base.appliedAt,{...base,changeSetId:'added'});
 expect(result.status).toBe('blocked');expect(result.findings.map(f=>f.code)).toContain('LEDGER_RECEIPT_CAPACITY');expect(result.findings.map(f=>f.code)).toContain('BACKUP_METADATA_CAPACITY');expect(result.backupMetadataLimit).toBe(20*1024*1024);expect(result.prospective!.storedBytes).toBeLessThan(MAX_IMPORT_LEDGER_BYTES);
});
it('reports both stored bytes and receipt count when one prospective batch exceeds both',()=>{
 const large={...base,version:3,changeSetSchema:'krakinai.change-set.v6',reviewedContent:review(4*1024*1024),frameResults:[]};
 const previous:any={version:4,receipts:[large,...Array.from({length:999},(_,i)=>({...base,changeSetId:'small-'+i}))],candidates:[]};
 expect(()=>validateImportLedger(previous)).not.toThrow();
 const result=assessImportCapacity(emptyState(),{assets:[],variants:[],scenes:[],templates:[],collections:[],candidates:[]} as any,previous,base.appliedAt,{...large,changeSetId:'another'} as any);
 expect(result.findings.map(f=>f.code)).toEqual(expect.arrayContaining(['LEDGER_CAPACITY','LEDGER_RECEIPT_CAPACITY']));
});
