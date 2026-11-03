import {it,expect} from 'vitest';
import {validateChangeSetApproval,validateImportLedger,appendImportReceipt,MAX_IMPORT_LEDGER_BYTES} from '../domain/changeSetLedger';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
import {emptyChangeSetApproval} from '../types/changeSet';
import {receiptProjection} from '../domain/mcpReads';
it('accepts explicit v6 approvals while preserving strict legacy approval formats',async()=>{
 const f=await keyframeChangeScenario();expect(()=>validateChangeSetApproval(f.approval,f.input.operations,'krakinai.change-set.v6')).not.toThrow();expect(()=>validateChangeSetApproval(f.approval,f.input.operations,'krakinai.change-set.v5')).toThrow();expect(()=>validateChangeSetApproval({...f.approval,frameOutputDecisions:{unknown:{middle:{full:'canonical'}}}},f.input.operations,'krakinai.change-set.v6')).toThrow();expect(MAX_IMPORT_LEDGER_BYTES).toBe(4*1024*1024);
});
it('projects actual v6 frame results without internal review text or implied grants',async()=>{
 const f=await keyframeChangeScenario(),frameResults=[{operationId:'revise',sceneId:'new-take-id',frameIds:['start','middle','end'],associationIds:['carried-image-id']}],receipt:any={version:3,changeSetSchema:'krakinai.change-set.v6',frameResults,changeSetId:'receipt',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),appliedAt:'2026-11-03T00:00:00Z',reviewedContent:'PRIVATE_REVIEWED_FRAME_CANARY',idMappings:{take:{kind:'scene',id:'new-take-id'}},operations:[],projectRevisions:{}};
 const projection=receiptProjection(receipt,f.state);expect(projection).toMatchObject({version:3,changeSetSchema:'krakinai.change-set.v6',frameResults});expect(JSON.stringify(projection)).not.toContain('PRIVATE_REVIEWED_FRAME_CANARY');expect(projection).not.toHaveProperty('keyframeSceneIds');
});
it('retains mixed receipt versions, exact frame IDs and a monotonic ledger3',()=>{
 const base={changeSetId:'old',packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex'},appliedAt:'2026-11-03T00:00:00Z',approval:emptyChangeSetApproval(),idMappings:{},operations:[{operationId:'update',type:'project.update',recordId:'project',status:'updated'}],projectRevisions:{project:{before:1,after:2}}};
 const r1={...base,version:1},r2={...base,changeSetId:'b',version:2,changeSetSchema:'krakinai.change-set.v5',reviewedContent:'{"blockingContinuity":[],"blockingScenes":[],"review":{}}'},r3={...base,changeSetId:'c',version:3,changeSetSchema:'krakinai.change-set.v6',reviewedContent:'{"collections":[],"findings":[],"operations":[],"scenes":[]}',frameResults:[]};
 const ledger:any={version:3,receipts:[r1,r2,r3],candidates:[]};expect(()=>validateImportLedger(ledger)).not.toThrow();expect(()=>validateImportLedger({...ledger,version:2})).toThrow();
 const next=appendImportReceipt(ledger,{candidates:[]} as any,{...r1,changeSetId:'d'} as any);expect(next.version).toBe(3);expect(next.receipts.slice(0,3)).toEqual(ledger.receipts);
 expect(()=>validateImportLedger({...ledger,receipts:[{...r3,reviewedContent:'x'.repeat(MAX_IMPORT_LEDGER_BYTES)}]})).toThrow(/4 MiB/);
});
