import {beforeEach,it,expect} from 'vitest';
import {ProposalBroker} from '../connections/proposalBroker';
import {feedbackForCurrentContext} from '../domain/proposalFeedback';
import {createReviewDraft} from '../domain/proposalReview';
import {midoriChangeSet,emptyState} from './fixtures/changeSetFixture';
import {emptyMcpScope} from '../domain/mcpScope';
import {clearAllStoresForTesting,initializeDatabase} from '../storage/db';
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();});
it('projects only the exact explicitly shared comment in its current binding',async()=>{
 const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');r.disposition='rejected';r.feedback={text:'  Keep <this> text.\r\n😊  ',rejectedAt:1001,sharedPreviously:true};
 const context={sessionId:'current',scopeEpoch:3};
 const proof={...context,proposalId:r.id,packageDigest:r.packageDigest,text:r.feedback.text,rejectedAt:1001};
 expect(feedbackForCurrentContext(r,proof,context)).toEqual({comment:r.feedback.text,rejectedAt:new Date(1001).toISOString()});
 for(const change of[{sessionId:'old'},{scopeEpoch:2},{proposalId:'different'},{packageDigest:'a'.repeat(64)},{text:'Different comment'},{rejectedAt:1002}])expect(feedbackForCurrentContext(r,{...proof,...change},context)).toBeUndefined();
});
it('treats persisted sharing history as local history, never a new sharing grant',async()=>{
 const r=await createReviewDraft(midoriChangeSet(),1000,'http://localhost:5173');r.feedback={text:'Private local reason',rejectedAt:1001,sharedPreviously:true};
 expect(feedbackForCurrentContext(r,undefined,{sessionId:'new',scopeEpoch:1})).toBeUndefined();
});
it('refuses synthetic rejection/sharing events without changing records',async()=>{
 const broker=new ProposalBroker();broker.connect('current',{...emptyMcpScope(),allowProposals:true,allowNewProjects:true,assetIds:['asset_synthetic_camera']});
 const submitted=await broker.handle({requestId:'one',tool:'krakinai_submit_change_set',args:{changeSet:midoriChangeSet()}},'current');expect(submitted.ok).toBe(true);
 const p=broker.getState().proposals[0];await expect(broker.rejectWithFeedback(p.id,'Reason',true,new Event('click'))).rejects.toThrow();
 expect(broker.getState().proposals[0].status).toBe('review_required');
});
it('rechecks legacy proposal status when its selected project disappears',async()=>{
 const state=emptyState(),project={id:'scoped-project',name:'Synthetic selected project',description:'',members:[],createdAt:'2026-11-04',updatedAt:'2026-11-04',project:{version:1 as const,revision:0,shots:[]}};state.collections=[project];
 const input=midoriChangeSet();input.operations=[{operationId:'shot',type:'shot.create',clientRef:'new-shot',project:{id:project.id,expectedRevision:0},code:'01',title:'Synthetic planned shot'}];
 const broker=new ProposalBroker({readState:async()=>state});broker.connect('current',{...emptyMcpScope(),projectIds:[project.id],allowProposals:true});
 expect(await broker.handle({requestId:'submit',tool:'krakinai_submit_change_set',args:{changeSet:input}},'current')).toMatchObject({ok:true});
 const id=broker.getState().proposals[0].id;state.collections=[];
 expect(await broker.handle({requestId:'status',tool:'krakinai_get_proposal_status',args:{proposalId:id}},'current')).toMatchObject({ok:false,error:{code:'PERMISSION_DENIED'}});
});
