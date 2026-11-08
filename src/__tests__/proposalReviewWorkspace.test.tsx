import React from 'react';
import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,within,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ProposalReviewWorkspace} from '../components/aiConnections/ProposalReviewWorkspace';
import {ProposalRejectionDialog} from '../components/aiConnections/ProposalRejectionDialog';
import {ReviewPromptText} from '../components/aiConnections/ReviewPromptText';
import {previewChangeSet} from '../storage/changeSets';
import {getAllSnapshot,clearAllStoresForTesting,initializeDatabase,openDatabase} from '../storage/db';
import {recipeState,recipeChangeSet,recipeApproval} from './fixtures/recipeChangeSetFixture';
import type {McpProposalView} from '../types/mcp';
beforeEach(async()=>{
 await clearAllStoresForTesting();await initializeDatabase();const state=recipeState(),db=await openDatabase();
 await new Promise<void>(yes=>{const tx=db.transaction(['assets','collections'],'readwrite');state.assets.forEach(a=>tx.objectStore('assets').put(a));state.collections.forEach(c=>tx.objectStore('collections').put(c));tx.oncomplete=()=>yes();});
});
async function setup(options:{expired?:boolean;batchConflict?:boolean;two?:boolean;operationId?:string}={}){
 const input=recipeChangeSet();if(options.operationId)input.operations[0].operationId=options.operationId;if(options.two){const op=structuredClone(input.operations[0]);op.operationId='recipe-two';op.clientRef='recipe-two';if('sceneInstructions'in op)op.sceneInstructions='A different synthetic moment.';input.operations.push(op);}
 const preview=await previewChangeSet(input,recipeApproval()),snapshot=await getAllSnapshot();
 if(options.batchConflict)preview.plan.findings.push({severity:'blocking',code:'PROJECT_VALIDATION',message:'Project cast reference must be an existing image.'});
 const proposal:McpProposalView={id:'proposal-ui',sessionId:'current',scopeEpoch:1,changeSetId:input.changeSetId,packageDigest:preview.packageDigest,receivedAt:Date.now(),expiresAt:Date.now()+(options.expired?-1:86400000),status:options.expired?'expired':'review_required',preview,needsRevalidation:false};
 const onApproval=vi.fn(),onConfirmReview=vi.fn(),onApply=vi.fn(),onRevalidate=vi.fn(),onRemove=vi.fn(),onProgress=vi.fn(),onReject=vi.fn();
 render(<ProposalReviewWorkspace proposal={proposal} snapshot={snapshot} connected={true} bound={true} reviewed={false} onApproval={onApproval} onConfirmReview={onConfirmReview} onApply={onApply} onRevalidate={onRevalidate} onRemove={onRemove} onProgress={onProgress} onReject={onReject} onBack={()=>{}}/>);
 return{proposal,onApproval,onApply,onProgress};
}
it('mounts one selected operation detail while the compact list retains the whole batch',async()=>{
 const user=userEvent.setup();await setup({two:true});
 await user.click(screen.getByRole('button',{name:'Review recipe'}));await user.click(screen.getByRole('tab',{name:'Recipe'}));
 expect(screen.getAllByRole('table',{name:'Resolved recipe components'})).toHaveLength(1);
 await user.click(screen.getByRole('button',{name:'Review recipe-two'}));
 expect(screen.getByRole('region',{name:'Selected change'})).toHaveAttribute('data-operation-id','recipe-two');
});
it('puts a global blocker on Batch and moves focus to its visible explanation',async()=>{
 const user=userEvent.setup();await setup({batchConflict:true});
 expect(screen.getByText('1 conflict',{exact:true})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Go to PROJECT_VALIDATION (Batch)'}));
 expect(screen.getByRole('heading',{name:'Batch & project checks'})).toHaveFocus();
 expect(within(screen.getByRole('region',{name:'Selected change'})).getByText('Project cast reference must be an existing image.',{exact:true})).toBeInTheDocument();
});
it('keeps expired packages inspectable and downloadable while Apply stays blocked',async()=>{
 const user=userEvent.setup();await setup({expired:true});
 expect(screen.getByRole('button',{name:'Download recipe package (JSON)'})).toBeEnabled();
 await user.click(screen.getByRole('button',{name:'Review recipe'}));
 expect(screen.getByRole('region',{name:'Selected change'})).toHaveAttribute('data-operation-id','recipe');
 expect(screen.getByRole('button',{name:'Apply reviewed batch'})).toBeDisabled();
});
it('provides arrow-key detail tabs and viewed marks without approving content',async()=>{
 const user=userEvent.setup(),api=await setup();await user.click(screen.getByRole('button',{name:'Review recipe'}));
 await user.click(screen.getByRole('tab',{name:'Summary'}));await user.keyboard('{ArrowRight}');
 expect(screen.getByRole('tab',{name:'Recipe'})).toHaveFocus();
 await user.click(screen.getByRole('checkbox',{name:'Mark this item viewed'}));expect(api.onProgress).toHaveBeenCalled();expect(api.onApply).not.toHaveBeenCalled();expect(api.onApproval).not.toHaveBeenCalled();
});
it('copies the entire prompt including exact final whitespace',async()=>{
 const user=userEvent.setup(),text='  Full prompt\r\n'.repeat(500)+'END\n  ';let copied='';
 vi.spyOn(navigator.clipboard,'writeText').mockImplementation(async value=>{copied=value;});
 render(<ReviewPromptText label="Complete selected frame" text={text}/>);
 await user.click(screen.getByRole('button',{name:'Copy Complete selected frame'}));expect(copied).toBe(text);
});
it('requires an entered reason for sharing and keeps local rejection available',async()=>{
 const user=userEvent.setup(),reject=vi.fn();
 render(<ProposalRejectionDialog title="Synthetic proposal" canShare={true} onClose={()=>{}} onReject={reject}/>);
 expect(screen.getByRole('button',{name:'Reject locally'})).toBeEnabled();expect(screen.getByRole('button',{name:'Reject and share feedback'})).toBeDisabled();
 await user.type(screen.getByRole('textbox',{name:'Reason for rejection'}),'Keep the current outfit.');
 await user.click(screen.getByRole('button',{name:'Reject and share feedback'}));
 await waitFor(()=>expect(reject).toHaveBeenCalledWith('Keep the current outfit.',true,expect.any(Event)));
});
it('closes the issue drawer onto the destination heading rather than its opener',async()=>{
 const user=userEvent.setup();await setup({batchConflict:true});
 await user.click(screen.getByRole('button',{name:'Issues & approvals'}));
 const dialog=screen.getByRole('dialog',{name:'Issues and approvals'});
 await user.click(within(dialog).getByRole('button',{name:'Go to PROJECT_VALIDATION (Batch)'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Batch & project checks'})).toHaveFocus();
});
it('filters to the actual Batch conflict without losing its explanation',async()=>{
 const user=userEvent.setup();await setup({batchConflict:true});
 await user.click(within(screen.getByRole('navigation',{name:'Changes navigator'})).getByRole('button',{name:'Conflicts'}));
 expect(screen.queryByRole('button',{name:'Review recipe'})).not.toBeInTheDocument();
 expect(screen.getByRole('region',{name:'Selected change'})).toHaveTextContent('Project cast reference must be an existing image.');
});
it('retains feedback after a save failure and warns before discarding it',async()=>{
 const user=userEvent.setup(),close=vi.fn();render(<ProposalRejectionDialog title="Synthetic proposal" canShare={true} onClose={close} onReject={async()=>{throw Error('Synthetic quota failure; comment not saved.');}}/>);
 await user.type(screen.getByRole('textbox',{name:'Reason for rejection'}),'Preserve this reason.');await user.click(screen.getByRole('button',{name:'Reject locally'}));
 await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'Reason for rejection'})).toHaveValue('Preserve this reason.');
 await user.click(screen.getByRole('button',{name:'Close Reject this proposal'}));expect(close).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Keep editing'})).toBeInTheDocument();
});

it('keeps Batch navigation distinct from a valid operation named batch',async()=>{
 const user=userEvent.setup();await setup({batchConflict:true,operationId:'batch'});
 await user.click(screen.getByRole('button',{name:'Go to PROJECT_VALIDATION (Batch)'}));expect(screen.getByRole('heading',{name:'Batch & project checks'})).toHaveFocus();
 await user.click(screen.getByRole('button',{name:'Review batch'}));expect(screen.getByRole('region',{name:'Selected change'})).toHaveAttribute('data-operation-id','batch');
});

it('groups DEPENDENCY_BLOCKED conflicts, provides 1-click bulk create, and keeps candidate decisions visible when a scene is selected', async () => {
  const user = userEvent.setup();
  const input = recipeChangeSet();
  input.operations = [
    {
      operationId: 'op-char-silvester',
      type: 'asset.propose',
      clientRef: 'char-silvester',
      kind: 'character',
      title: 'Silvester Character',
      promptText: 'Young man in robes',
      tags: [],
    },
    {
      operationId: 'op-env-sacred-hall',
      type: 'asset.propose',
      clientRef: 'env-sacred-hall',
      kind: 'environment',
      title: 'Sacred Hall Environment',
      promptText: 'Grand stone nave',
      tags: [],
    },
    {
      operationId: 'op-scene-s01',
      type: 'scene.create_recipe',
      clientRef: 'scene-01',
      title: 'Beat 1: Opposing Columns',
      project: { id: 'project', expectedRevision: 1 },
      shot: { id: 'shot' },
      shotType: 'character_scene',
      settings: { aspectRatio: '16:9', durationSeconds: 5 },
      assetRefs: [{ slot: 'environment', asset: { ref: 'env-sacred-hall' } }],
    },
    {
      operationId: 'op-scene-s02',
      type: 'scene.create_recipe',
      clientRef: 'scene-02',
      title: 'Beat 2: Nave',
      project: { id: 'project', expectedRevision: 1 },
      shot: { id: 'shot' },
      shotType: 'property_environment',
      settings: { aspectRatio: '16:9', durationSeconds: 5 },
      assetRefs: [{ slot: 'environment', asset: { ref: 'env-sacred-hall' } }],
    },
  ];
  const approval = recipeApproval();
  const preview = await previewChangeSet(input, approval);
  preview.plan.findings.push(
    { operationId: 'op-scene-s01', severity: 'blocking', code: 'DEPENDENCY_BLOCKED', message: 'Scene 1 blocked by deferred candidate' },
    { operationId: 'op-scene-s02', severity: 'blocking', code: 'DEPENDENCY_BLOCKED', message: 'Scene 2 blocked by deferred candidate' },
  );
  const snapshot = await getAllSnapshot();
  const onApproval = vi.fn();
  const proposal: McpProposalView = {
    id: 'proposal-deps',
    sessionId: 'current',
    scopeEpoch: 1,
    changeSetId: input.changeSetId,
    packageDigest: preview.packageDigest,
    receivedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    status: 'review_required',
    preview,
    needsRevalidation: false,
  };
  render(
    <ProposalReviewWorkspace
      proposal={proposal}
      snapshot={snapshot}
      connected={true}
      bound={true}
      reviewed={false}
      onApproval={onApproval}
      onConfirmReview={vi.fn()}
      onApply={vi.fn()}
      onRevalidate={vi.fn()}
      onRemove={vi.fn()}
      onProgress={vi.fn()}
      onReject={vi.fn()}
      onBack={() => {}}
    />
  );

  const bulkBtn = screen.getByRole('button', { name: /Create all new candidates \(2\)/i });
  expect(bulkBtn).toBeInTheDocument();
  await user.click(bulkBtn);
  expect(onApproval).toHaveBeenCalledWith(expect.objectContaining({
    assetDecisions: expect.objectContaining({
      'op-char-silvester': { action: 'create' },
      'op-env-sacred-hall': { action: 'create' },
    }),
  }));

  expect(screen.getByText(/DEPENDENCY_BLOCKED · 2 scenes blocked/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Review op-scene-s01' }));
  expect(screen.getByLabelText('Decision for op-env-sacred-hall')).toBeInTheDocument();
});
