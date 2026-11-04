import {it,expect} from 'vitest';
import {encodeImportEvidence} from '../domain/importEvidence';
import * as history from '../domain/changeSetLedger';
import {emptyChangeSetApproval} from '../types/changeSet';
import {receiptProjection} from '../domain/mcpReads';
const content='{"collections":[],"findings":[],"operations":[],"scenes":[]}';
const base={changeSetId:'synthetic-receipt',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex'},appliedAt:'2026-11-05T00:00:00Z',approval:emptyChangeSetApproval(),idMappings:{},operations:[{operationId:'update',type:'project.update',recordId:'project',status:'updated'}],projectRevisions:{project:{before:1,after:2}}};
const compact=async()=>({...base,version:4,changeSetSchema:'krakinai.change-set.v6',frameResults:[],reviewedEvidence:await encodeImportEvidence(content)});
it('validates and verifies compact v4 beside unchanged legacy receipts',async()=>{
 const legacy={...base,version:1,changeSetId:'old'},r=await compact(),ledger={version:4,receipts:[legacy,r],candidates:[]};
 expect(()=>history.validateImportLedger(ledger)).not.toThrow();
 const proof=await history.prepareImportLedger(ledger as any);expect(proof.expandedBytes).toBe(new TextEncoder().encode(content).length);
 expect(ledger.receipts[0]).toEqual(legacy);
 await expect(history.prepareImportLedger({...ledger,receipts:[{...r,reviewedEvidence:{...r.reviewedEvidence,sha256:'0'.repeat(64)}}]} as any)).rejects.toThrow(/hash/i);
 expect(()=>history.validateImportLedger({...ledger,version:3})).toThrow();
});
it('projects storage v4 as the existing logical receipt without private evidence',async()=>{
 const r=await compact(),result=receiptProjection(r as any,{scenes:[]} as any);
 expect(result).toMatchObject({version:3,changeSetSchema:'krakinai.change-set.v6',frameResults:[]});
 expect(result).not.toHaveProperty('reviewedEvidence');expect(JSON.stringify(result)).not.toContain(r.reviewedEvidence.data);
});
it('uses the 8 MiB stored target only in the protected v4 ledger',()=>{
 const evidence=JSON.stringify({collections:[],findings:[],operations:[],scenes:[],padding:'x'.repeat(2300000)});
 // Existing v6 evidence shape is strict; use a legitimate findings message instead.
 const reviewed=JSON.stringify({collections:[],findings:[{message:'x'.repeat(2300000)}],operations:[],scenes:[]});
 const receipts=[0,1].map(i=>({...base,changeSetId:'r'+i,version:3,changeSetSchema:'krakinai.change-set.v6',reviewedContent:reviewed,frameResults:[]}));
 expect(evidence.length).toBeGreaterThan(2000000);
 expect(history.MAX_IMPORT_LEDGER_BYTES).toBe(8*1024*1024);
 expect(()=>history.validateImportLedger({version:4,receipts,candidates:[]})).not.toThrow();
 expect(()=>history.validateImportLedger({version:3,receipts,candidates:[]})).toThrow(/4 MiB/);
});
it('keeps old receipts unchanged while new appends mark the protected ledger',async()=>{
 const previous:any={version:1,receipts:[{...base,version:1,changeSetId:'old'}],candidates:[]},r=await compact();
 const next=history.appendImportReceipt(previous,{candidates:[]} as any,r as any);
 expect(next.version).toBe(4);expect(next.receipts[0]).toEqual(previous.receipts[0]);expect(previous.version).toBe(1);
});
it('binds asynchronous verification to the exact ledger captured at entry',async()=>{
 const r=await compact(),other=await encodeImportEvidence(content.replace('"findings":[]','"findings":[{}]')),ledger:any={version:4,receipts:[r],candidates:[]},original=JSON.stringify(ledger);
 const pending=history.prepareImportLedger(ledger);r.reviewedEvidence.data=other.data;
 const proof=await pending;expect(proof.comparison).toBe((await import('../domain/changeSetCanonical')).canonicalStringify(JSON.parse(original)));
});
