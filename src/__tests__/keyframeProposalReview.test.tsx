import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {previewChangeSet} from '../storage/changeSets';
import {getAllSnapshot} from '../storage/db';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {prepareBlockingSources} from '../domain/blockingPatch';
import {KeyframeProposalReview} from '../components/keyframes/KeyframeProposalReview';
afterEach(cleanup);
it('shows complete frame/Blocking/video differences while retaining separate explicit approvals',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),preview=await previewChangeSet(f.input,f.approval);render(<KeyframeProposalReview preview={preview} snapshot={before} disabled={false} onApproval={()=>{}}/>);
 const next=preview.plan.scenes[0];expect(screen.getByLabelText('middle full original image prompt').textContent).toBe(f.parent.imagePromptSnapshots!.middle.full);expect(screen.getByLabelText('middle full proposed image prompt').textContent).toBe(next.imagePromptSnapshots!.middle.full);expect(screen.getByLabelText('full proposed video prompt').textContent).toBe(next.outputs.full);
 expect(screen.getByRole('checkbox',{name:'Approve keyframe and image-prompt changes'})).toBeChecked();expect(screen.getByRole('checkbox',{name:'Approve frame video decision'})).toBeChecked();expect(screen.getByText(/original saved take remains immutable/i)).toBeInTheDocument();expect(await getAllSnapshot()).toEqual(before);
});
it('requires per-mode manual choices and resets C consent after changing a decision',async()=>{
 const f=await seedKeyframeStorage();f.parent.manualImageOutputs={middle:{full:{text:'EXACT MANUAL MIDDLE IMAGE BUFFER',basedOnVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,updatedAt:f.parent.updatedAt}}};await writeRecord('scenes',f.parent);f.op.expectedSourceRecipeDigest=(await prepareBlockingSources([f.parent])).get(f.parent.id)!.recipeDigest;
 const preview=await previewChangeSet(f.input,f.approval),onApproval=vi.fn();render(<KeyframeProposalReview preview={preview} snapshot={await getAllSnapshot()} disabled={false} onApproval={onApproval}/>);
 expect(screen.getByLabelText('middle full manual image buffer').textContent).toBe('EXACT MANUAL MIDDLE IMAGE BUFFER');await userEvent.setup().click(screen.getByRole('radio',{name:'middle full: keep exact manual text, unverified'}));expect(onApproval).toHaveBeenCalledWith(expect.objectContaining({keyframes:false,frameImages:false,frameVideo:false,frameOutputDecisions:{revise:{middle:{full:'keep_manual_unverified'}}}}));
});
it('renders removal and addition by stable ID without moving focus or saving records',async()=>{
 const f=await seedKeyframeStorage();f.op.keyframes={...f.op.keyframes,removeFrameIds:['middle'],frameUpserts:[{...f.plan.frames[1],id:'new-middle',instant:{kind:'linked_phase',phase:'start'}}],frameOrder:['start','new-middle','end']} as any;
 const preview=await previewChangeSet(f.input,f.approval),before=await getAllSnapshot();const button=document.createElement('button');document.body.append(button);button.focus();render(<KeyframeProposalReview preview={preview} snapshot={before} disabled={false} onApproval={()=>{}}/>);expect(document.activeElement).toBe(button);expect(screen.getByText(/Removed frame: middle/)).toBeInTheDocument();expect(screen.getByText(/Added frame: new-middle/)).toBeInTheDocument();expect(await getAllSnapshot()).toEqual(before);button.remove();
});
