import React from'react';
import{it,expect,vi}from'vitest';
import{render,screen}from'@testing-library/react';
import userEvent from'@testing-library/user-event';
import{RecipeMappingEditor}from'../components/RecipeMappingEditor';
import{conversionScenario}from'./fixtures/recipeConversionFixture';
it('does not add a candidate past the existing 250-operation package limit',async()=>{
 const f=await conversionScenario(),op=f.input.operations[0],input={...f.input,operations:Array.from({length:250},(_,index)=>({...op,operationId:'conversion-'+index}))};
 render(<RecipeMappingEditor input={input} operation={op} source={f.state.scenes[0]} state={f.state} onChange={vi.fn()}/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));await user.type(screen.getByRole('textbox',{name:'Candidate title'}),'Synthetic candidate');await user.type(screen.getByRole('textbox',{name:'Candidate prompt'}),'Explicit synthetic instructions.');expect(screen.getByRole('button',{name:'Add candidate to mapping'})).toBeDisabled();
});
