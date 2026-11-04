import React from 'react';
import {it,expect,vi,beforeEach} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {McpProposalReview} from '../components/McpProposalReview';
import {getAllSnapshot,clearAllStoresForTesting,initializeDatabase,openDatabase} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {midoriChangeSet,syntheticCamera,allContentApproval} from './fixtures/changeSetFixture';
import type {McpProposalView} from '../types/mcp';
const harness=vi.hoisted(()=>({connection:{} as unknown,library:{} as unknown}));
vi.mock('../connections/AiConnectionContext',()=>({useAiConnection:()=>harness.connection}));
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>harness.library}));
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();const db=await openDatabase();await new Promise<void>(yes=>{const t=db.transaction('assets','readwrite');t.objectStore('assets').put(syntheticCamera());t.oncomplete=()=>yes();});});
async function setup(applied=false){
 const preview=await previewChangeSet(midoriChangeSet(),allContentApproval());preview.plan.findings=[];
 const receipt=applied?await applyApprovedChangeSet(preview,preview.approvedDigest):undefined;
 const proposal:McpProposalView={id:'owner-review',changeSetId:preview.changeSet.changeSetId,packageDigest:preview.packageDigest,sessionId:'current',scopeEpoch:1,receivedAt:Date.now(),expiresAt:Date.now()+86400000,status:applied?'applied':'review_required',preview,receipt};
 const broker={isReviewed:()=>true,getState:()=>({proposals:[proposal]}),applyFromUserEvent:async()=>{proposal.error='Nothing was applied. Exact source revision changed; request a fresh package.';throw Error('Exact source revision changed; request a fresh package.');},removeDraft:vi.fn()};
 harness.connection={broker,view:{connected:true,sessionId:'current',scope:{epoch:1},proposals:[proposal]}};harness.library={snapshot:await getAllSnapshot(),navigate:vi.fn()};
 const mounted=render(<McpProposalReview proposalId={proposal.id} onClose={()=>{}}/>);return{...mounted,proposal,broker};
}
it('announces one precise failure and save outcome rather than duplicate alerts',async()=>{
 const user=userEvent.setup(),api=await setup();await user.click(screen.getByRole('button',{name:'Apply reviewed batch'}));api.rerender(<McpProposalReview proposalId={api.proposal.id} onClose={()=>{}}/>);
 await waitFor(()=>expect(screen.getAllByRole('alert')).toHaveLength(1));expect(screen.getByRole('alert')).toHaveTextContent('Nothing was applied. Exact source revision changed');
});
it('keeps local package download and removal reachable beside a confirmed receipt',async()=>{
 await setup(true);expect(screen.getByRole('heading',{name:'Import receipt'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Download recipe package (JSON)'})).toBeEnabled();expect(screen.getByRole('button',{name:'Remove local review draft'})).toBeEnabled();
});
