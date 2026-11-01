import React,{useState}from'react';
import{beforeEach,afterEach,it,expect,vi}from'vitest';
import{render,screen,within,waitFor,cleanup}from'@testing-library/react';
import userEvent from'@testing-library/user-event';
import{ChangeSetPreview}from'../components/ChangeSetPreview';
import{previewChangeSet}from'../storage/changeSets';
import{clearAllStoresForTesting,initializeDatabase,openDatabase,getAllSnapshot}from'../storage/db';
import{conversionScenario,conversionSourceText}from'./fixtures/recipeConversionFixture';
beforeEach(async()=>{
 await clearAllStoresForTesting();await initializeDatabase();const{state}=await conversionScenario(),db=await openDatabase();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['assets','scenes','collections'],'readwrite');for(const key of['assets','scenes','collections']as const)for(const record of state[key])tx.objectStore(key).put(record);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});
});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
async function setup(uncertain=false){
 const f=await conversionScenario();delete f.approval.conversionDecisions;if(uncertain)f.input.operations[0].conversion.mappings[0].assessment='uncertain';
 const p=await previewChangeSet(f.input,f.approval),snapshot=await getAllSnapshot();
 function Harness(){const[preview,setPreview]=useState(p);return <ChangeSetPreview preview={preview} snapshot={snapshot} disabled={false} onApproval={async a=>setPreview(await previewChangeSet(f.input,a))}/>}
 render(<Harness/>);return p;
}
it('shows collapsed original and actual component mapping without changing any database store',async()=>{
 const user=userEvent.setup(),p=await setup(),before=await getAllSnapshot();await user.click(screen.getByRole('button',{name:'Review convert'}));
 const dialog=screen.getByRole('dialog'),table=within(dialog).getByRole('table',{name:'Direct Prompt conversion mapping'});
 expect(table).toHaveTextContent('Synthetic Courtyard');expect(table).toHaveTextContent('environment');expect(table).toHaveTextContent('rev 2');
 expect(within(dialog).getByText('Original Direct Prompt (preserved)',{exact:true}).closest('details')).not.toHaveAttribute('open');
 expect(within(dialog).getByRole('checkbox',{name:'I reviewed conversion mapping (convert)'})).not.toBeChecked();
 expect(p.plan.operations[0].currentPrompt).toBe(conversionSourceText);expect(await getAllSnapshot()).toEqual(before);
});
it('requires individual uncertainty acknowledgement and whole mapping review before the blocker clears',async()=>{
 const user=userEvent.setup();await setup(true);await user.click(screen.getByRole('button',{name:'Review convert'}));
 await user.click(screen.getByRole('checkbox',{name:'Acknowledge environment-map (uncertain)'}));
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Acknowledge environment-map (uncertain)'})).toBeChecked());
 await user.click(screen.getByRole('checkbox',{name:'I reviewed conversion mapping (convert)'}));
 await waitFor(()=>expect(screen.queryByText('Review the original and every proposed conversion mapping before saving a new recipe take.')).not.toBeInTheDocument());
 expect(screen.getByRole('checkbox',{name:'I reviewed conversion mapping (convert)'})).toBeChecked();
});
it('copies each complete newly assembled mode and never substitutes the original prose',async()=>{
 const user=userEvent.setup(),p=await setup();let copied='';vi.spyOn(navigator.clipboard,'writeText').mockImplementation(async text=>{copied=text});
 await user.click(screen.getByRole('button',{name:'Review convert'}));
 for(const[mode,label]of[['full','Full'],['structured','Structured'],['compact','Compact']]as const){
  await user.click(screen.getByRole('tab',{name:label}));await user.click(screen.getByRole('button',{name:'Copy '+label+' recipe'}));
  expect(copied).toBe(p.plan.scenes[0].outputs[mode]);expect(copied).not.toContain('SOURCE_ONLY_DO_NOT_COPY');
 }
});
