import {it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {useState} from 'react';
import {ChangeSetPreview} from '../components/ChangeSetPreview';
import {blockingChangeScenario} from './fixtures/blockingChangeSetFixture';
import {allocationFor} from './fixtures/changeSetFixture';
import {parseChangeSet} from '../domain/changeSetValidation';
import {planChangeSet} from '../domain/changeSetPlanner';
import {emptyChangeSetApproval,type ChangeSetApproval} from '../types/changeSet';
import {prepareBlockingSources} from '../domain/blockingPatch';
async function setup(manual=false){const f=await blockingChangeScenario();if(manual){f.parent.manualOutputs.full={text:'Exact inherited manual buffer\r\nKEEP ALL BYTES',basedOnInputRevision:1,updatedAt:f.parent.updatedAt};f.parent.outputs.full=f.parent.manualOutputs.full.text;f.proofs=await prepareBlockingSources(f.state.scenes);f.op.expectedSourceRecipeDigest=f.proofs.get(f.parent.id)!.recipeDigest;}
 const input=parseChangeSet(f.input),allocation=allocationFor(input);let latest:ChangeSetApproval|undefined;
 function Harness(){const[approval,setApproval]=useState<ChangeSetApproval>({...emptyChangeSetApproval(),storyboard:true,scenes:true});latest=approval;const plan=planChangeSet(input,approval,f.state,allocation,new Map(),f.proofs);return <ChangeSetPreview preview={{version:1,changeSet:input,approval,allocation,plan,packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64)}} snapshot={f.state} disabled={false} onApproval={setApproval}/>;}
 const before=structuredClone(f.state);render(<Harness/>);return{f,before,latest:()=>latest!};}
it('shows exact blocking and complete video differences with a separate unresolved blocking approval',async()=>{
 const{f,before,latest}=await setup();expect(screen.getByLabelText('Approve blocking changes')).not.toBeChecked();expect(screen.getByRole('region',{name:'Blocking proposal revise'})).toBeInTheDocument();expect(screen.getByLabelText('Full canonical output')).toHaveTextContent('Aya keeps her original gown');expect(screen.getByText(/Proposed unselected take vs previous selected take/)).toBeInTheDocument();
 fireEvent.click(screen.getByLabelText('Approve blocking changes'));expect(latest().blocking).toBe(true);expect(f.state).toEqual(before);
});
it('uses the same explicit per-mode choices and preserves exact inherited buffers without legacy discard consent',async()=>{
 const{f,before,latest}=await setup(true);expect(screen.getByLabelText('Full exact manual output').textContent).toBe('Exact inherited manual buffer\r\nKEEP ALL BYTES');expect(screen.getByLabelText('Full output decision')).toHaveValue('');expect(screen.queryByText(/Discard.*manual/i)).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Full output decision'),{target:{value:'keep_manual_unverified'}});expect(latest().blockingOutputDecisions).toEqual({revise:{full:'keep_manual_unverified'}});expect(latest().blocking).not.toBe(true);fireEvent.change(screen.getByLabelText('Full output decision'),{target:{value:''}});expect(latest().blockingOutputDecisions).toEqual({revise:{}});expect(f.state).toEqual(before);
});
