import React from'react';
import{beforeEach,afterEach,it,expect,vi}from'vitest';
import{render,screen,within,waitFor,cleanup,act}from'@testing-library/react';
import userEvent from'@testing-library/user-event';
import App from'../App';
import{clearAllStoresForTesting,initializeDatabase,openDatabase,getAllSnapshot}from'../storage/db';
import{conversionScenario}from'./fixtures/recipeConversionFixture';
import{previewChangeSet,applyApprovedChangeSet}from'../storage/changeSets';
import * as changeSetStorage from'../storage/changeSets';
import{stageRecipePackage}from'../domain/recipePackageHandoff';
beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();const{state}=await conversionScenario(),db=await openDatabase();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['assets','scenes','collections'],'readwrite');for(const key of['assets','scenes','collections']as const)for(const r of state[key])tx.objectStore(key).put(r);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error)});window.location.hash='#/recipes/ai?scene=direct-source&collection=project&shot=shot';});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
async function setup(){render(<App/>);await screen.findByRole('heading',{name:'AI Recipe Builder'}, {timeout:5000});await screen.findByRole('button',{name:'Change Environment'}, {timeout:5000});}
it('initializes a new guided mapping under the production StrictMode lifecycle',async()=>{
 render(<React.StrictMode><App/></React.StrictMode>);expect(await screen.findByRole('button',{name:'Change Environment'},{timeout:5000})).toBeEnabled();
},10000);
it('does not announce a recipe preview as ready when the read-only calculation failed',async()=>{
 const f=await conversionScenario();stageRecipePackage(f.input);vi.spyOn(changeSetStorage,'previewChangeSet').mockRejectedValue(Error('Synthetic preview read failure'));await setup();expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic preview read failure');expect(screen.queryByText('Review the assembled recipe before saving.',{exact:true})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Download mapping package'})).toBeEnabled();
});
it('opens a transient same-shot mapping workspace without expanding source prose or writing drafts',async()=>{
 const before=await getAllSnapshot();await setup();expect(screen.getByText('Original Direct Prompt (preserved)',{exact:true}).closest('details')).not.toHaveAttribute('open');
 expect(screen.getByRole('button',{name:'Change Environment'})).toBeEnabled();expect(screen.getByRole('button',{name:'Review and save alternate take'})).toBeInTheDocument();
 expect(await getAllSnapshot()).toEqual(before);expect(screen.getByText(/Mapping edits stay in this tab/)).toBeInTheDocument();
});
it('searches real components, maps an exact record and restores focus when its dialog closes',async()=>{
 const user=userEvent.setup();await setup();const before=await getAllSnapshot();
 await user.click(screen.getByRole('button',{name:'Change Environment'}));const dialog=screen.getByRole('dialog');
 await user.type(within(dialog).getByRole('searchbox',{name:'Search Environment'}),'Courtyard');
 await user.selectOptions(within(dialog).getByRole('combobox',{name:'Environment asset'}),'environment');
 await user.click(within(dialog).getByRole('button',{name:'Done mapping'}));expect(screen.getByRole('button',{name:'Change Environment'})).toHaveFocus();
 expect(screen.getByRole('table',{name:'Scene recipe mapping'})).toHaveTextContent('Synthetic Courtyard');expect(await getAllSnapshot()).toEqual(before);
});
it('copies an IDs-only Codex request and does not grant access or include original text',async()=>{
 const user=userEvent.setup();let copied='';vi.spyOn(navigator.clipboard,'writeText').mockImplementation(async text=>{copied=text});await setup();
 await user.click(screen.getByRole('button',{name:'Prepare Codex mapping request'}));expect(copied).toContain('direct-source');expect(copied).toContain('project');expect(copied).not.toContain('SOURCE_ONLY_DO_NOT_COPY');
 expect(copied).toContain('krakinai_get_scene');expect(copied).toContain('browser');
});
it('hands the mapped package to existing review without any pre-approval database writes',async()=>{
 const user=userEvent.setup();await setup();await user.click(screen.getByRole('button',{name:'Change Environment'}));
 await user.selectOptions(screen.getByRole('combobox',{name:'Environment asset'}),'environment');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 const before=await getAllSnapshot();await user.click(screen.getByRole('button',{name:'Review and save alternate take'}));
 await screen.findByRole('heading',{name:'Change-set preview'},{timeout:5000});expect(screen.getByRole('button',{name:'Apply approved changes'})).toBeDisabled();
 expect(await getAllSnapshot()).toEqual(before);
 await user.click(screen.getByRole('button',{name:'Back to Recipe mapping'}));await screen.findByRole('heading',{name:'AI Recipe Builder'});
 expect(screen.getByRole('table',{name:'Scene recipe mapping'})).toHaveTextContent('Synthetic Courtyard');
});
it('requires explicit selection when the source belongs to several shots and no context was supplied',async()=>{
 const snapshot=await getAllSnapshot(),collection=structuredClone(snapshot.collections[0]);collection.id='other';collection.name='Other project';collection.project!.shots[0].id='other-shot';
 const db=await openDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put(collection);tx.oncomplete=()=>resolve()});window.location.hash='#/recipes/ai?scene=direct-source';
 render(<App/>);await screen.findByRole('heading',{name:'AI Recipe Builder'},{timeout:5000});expect(screen.getByRole('combobox',{name:'Destination project and shot'})).toHaveValue('');
 expect(screen.queryByRole('button',{name:'Review and save alternate take'})).not.toBeInTheDocument();
});
it('makes scene-only revision and library editing explicit without changing any record when opening the choices',async()=>{
 const f=await conversionScenario(),p=await previewChangeSet(f.input,f.approval),receipt=await applyApprovedChangeSet(p,p.approvedDigest);
 window.location.hash='#/output/'+receipt.idMappings.converted.id;render(<App/>);const user=userEvent.setup();
 await screen.findByRole('button',{name:'Compare Versions'},{timeout:5000});const before=await getAllSnapshot();
 await user.click(screen.getByText('Scene or reusable asset',{exact:true}));expect(screen.getByRole('button',{name:'Revise This Scene'})).toBeEnabled();
 await user.click(screen.getByRole('button',{name:'Create or Revise Reusable Asset'}));expect(screen.getByRole('dialog')).toHaveTextContent('Saved scene snapshots stay unchanged');
 expect(await getAllSnapshot()).toEqual(before);
});
it('keeps the just-selected Character when participants are enabled before the preview resolves',async()=>{
 const realPreview=changeSetStorage.previewChangeSet;
 vi.spyOn(changeSetStorage,'previewChangeSet').mockImplementation(async(...args)=>{await new Promise(r=>setTimeout(r,600));return realPreview(...args)});
 const user=userEvent.setup();await setup();await user.click(screen.getByRole('button',{name:'Change Character Identity'}));
 await user.selectOptions(screen.getByRole('combobox',{name:'Character Identity asset'}),'character');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 await user.click(screen.getByRole('button',{name:'Enable participants & ordered cues'}));await user.click(screen.getByRole('button',{name:'Enable for this draft'}));
 expect(await screen.findByRole('button',{name:'Participants (1)'},{timeout:5000})).toBeEnabled();
},15000);
it('computes a real read-only assembled preview after selecting a component',async()=>{
 const user=userEvent.setup();await setup();await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.selectOptions(screen.getByRole('combobox',{name:'Environment asset'}),'environment');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 expect(await screen.findByText('Recipe inputs selected; production references remain pending.',{exact:true},{timeout:5000})).toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
},15000);
it('keeps an imported mapping downloadable when its saved source is missing',async()=>{
 const f=await conversionScenario();stageRecipePackage(f.input);const db=await openDatabase();await new Promise<void>(resolve=>{const tx=db.transaction('scenes','readwrite');tx.objectStore('scenes').delete('direct-source');tx.oncomplete=()=>resolve()});
 render(<App/>);await screen.findByRole('heading',{name:'AI Recipe Builder'},{timeout:5000});expect(screen.getByRole('button',{name:'Download mapping package'})).toBeEnabled();expect(screen.queryByRole('button',{name:'Review and save alternate take'})).not.toBeInTheDocument();
});
it('keeps unsubmitted candidate drafts with their own component instead of carrying them into another category',async()=>{
 const user=userEvent.setup();await setup();await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));await user.type(screen.getByRole('textbox',{name:'Candidate title'}),'Courtyard draft');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 await user.click(screen.getByRole('button',{name:'Change Camera & Movement'}));await user.click(screen.getByRole('button',{name:'Propose missing Camera & Movement'}));expect(screen.getByRole('textbox',{name:'Candidate title'})).toHaveValue('');
 await user.click(screen.getByRole('button',{name:'Done mapping'}));await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));expect(screen.getByRole('textbox',{name:'Candidate title'})).toHaveValue('Courtyard draft');
});
it('preserves unsubmitted candidate text when returning from review to mapping',async()=>{
 const user=userEvent.setup();await setup();await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));await user.type(screen.getByRole('textbox',{name:'Candidate title'}),'Unfinished local idea');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 await user.click(screen.getByRole('button',{name:'Review and save alternate take'}));await screen.findByRole('heading',{name:'Change-set preview'},{timeout:5000});await user.click(screen.getByRole('button',{name:'Back to Recipe mapping'}));
 await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));expect(screen.getByRole('textbox',{name:'Candidate title'})).toHaveValue('Unfinished local idea');
});
it('reports unavailable clipboard access instead of crashing the workspace',async()=>{
 await setup();const user=userEvent.setup();Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
 await user.click(screen.getByRole('button',{name:'Prepare Codex mapping request'}));expect(await screen.findByRole('alert')).toHaveTextContent('Copy failed');expect(screen.getByRole('button',{name:'Download mapping package'})).toBeEnabled();
});
it('guards a mapping against browser unload until it is saved or deliberately discarded',async()=>{
 await setup();const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
 cleanup();const after=new Event('beforeunload',{cancelable:true});window.dispatchEvent(after);expect(after.defaultPrevented).toBe(false);
});
it('keeps guarding an unsubmitted candidate idea after the reviewed package has committed',async()=>{
 const f=await conversionScenario();stageRecipePackage(f.input);const user=userEvent.setup();await setup();
 await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));await user.type(screen.getByRole('textbox',{name:'Candidate title'}),'Not submitted yet');await user.click(screen.getByRole('button',{name:'Done mapping'}));
 await user.click(screen.getByRole('button',{name:'Review and save alternate take'}));await screen.findByRole('heading',{name:'Change-set preview'},{timeout:5000});await user.click(screen.getByRole('button',{name:'Review convert'}));
 await user.click(screen.getByRole('checkbox',{name:'I reviewed conversion mapping (convert)'}));await user.keyboard('{Escape}');
 await user.click(screen.getByRole('checkbox',{name:'Approve storyboard changes'}));await user.click(screen.getByRole('checkbox',{name:'Approve new immutable scenes'}));await user.click(screen.getByRole('checkbox',{name:'I reviewed this exact preview'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Apply approved changes'})).toBeEnabled());await user.click(screen.getByRole('button',{name:'Apply approved changes'}));await screen.findByRole('region',{name:'Import receipt'},{timeout:5000});
 await user.click(screen.getByRole('button',{name:'Home'}));expect(await screen.findByRole('dialog')).toHaveTextContent('Unsaved Changes');await user.click(screen.getByRole('button',{name:'Stay on Page'}));await user.click(screen.getByRole('button',{name:'Back to Recipe mapping'}));await user.click(screen.getByRole('button',{name:'Change Environment'}));await user.click(screen.getByRole('button',{name:'Propose missing Environment'}));expect(screen.getByRole('textbox',{name:'Candidate title'})).toHaveValue('Not submitted yet');
},20000);

function delayedMappingFile(){let resolve!:(text:string)=>void;const pending=new Promise<string>(r=>{resolve=r}),file=new File(['{}'],'synthetic-mapping.json',{type:'application/json'});Object.defineProperty(file,'text',{value:()=>pending});return{file,resolve}}
it('ignores an older resumed file after a newer mapping edit',async()=>{
 const user=userEvent.setup(),f=await conversionScenario();await setup();const older=delayedMappingFile();await user.upload(screen.getByLabelText('Resume mapping package'),older.file);const title=screen.getByRole('textbox',{name:'New recipe title'});await user.clear(title);await user.type(title,'NEWER UNSAVED WORK');f.input.operations[0].title='STALE FILE';vi.spyOn(window,'confirm').mockReturnValue(true);await act(async()=>older.resolve(JSON.stringify(f.input)));expect(title).toHaveValue('NEWER UNSAVED WORK');
});
it('keeps the later resumed file when file reads finish out of order',async()=>{
 const user=userEvent.setup(),a=await conversionScenario(),b=await conversionScenario();await setup();vi.spyOn(window,'confirm').mockReturnValue(true);const older=delayedMappingFile(),newer=delayedMappingFile();a.input.operations[0].title='OLDER FILE';b.input.operations[0].title='LATEST FILE';await user.upload(screen.getByLabelText('Resume mapping package'),older.file);await user.upload(screen.getByLabelText('Resume mapping package'),newer.file);await act(async()=>newer.resolve(JSON.stringify(b.input)));await waitFor(()=>expect(screen.getByRole('textbox',{name:'New recipe title'})).toHaveValue('LATEST FILE'));await act(async()=>older.resolve(JSON.stringify(a.input)));expect(screen.getByRole('textbox',{name:'New recipe title'})).toHaveValue('LATEST FILE');
});
it('does not replace a newly selected source and its unsaved work when a read started with no package',async()=>{
 const user=userEvent.setup(),f=await conversionScenario();window.location.hash='#/recipes/ai';render(<App/>);await screen.findByRole('heading',{name:'AI Recipe Builder'});const older=delayedMappingFile();await user.upload(screen.getByLabelText('Resume mapping package'),older.file);await user.selectOptions(screen.getByRole('combobox',{name:'Saved Direct Prompt'}),'direct-source');await screen.findByRole('textbox',{name:'New recipe title'});await user.type(screen.getByRole('textbox',{name:'New recipe title'}),' NEW USER EDIT');const expected=(screen.getByRole('textbox',{name:'New recipe title'})as HTMLInputElement).value;f.input.operations[0].title='STALE NO-PACKAGE FILE';const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);await act(async()=>older.resolve(JSON.stringify(f.input)));expect(screen.getByRole('textbox',{name:'New recipe title'})).toHaveValue(expected);expect(confirm).not.toHaveBeenCalled();
});

it('discards pending file completions after unmount without a late confirmation or database write',async()=>{const user=userEvent.setup(),f=await conversionScenario();await setup();const before=await getAllSnapshot(),older=delayedMappingFile();await user.upload(screen.getByLabelText('Resume mapping package'),older.file);const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);cleanup();await act(async()=>older.resolve(JSON.stringify(f.input)));expect(confirm).not.toHaveBeenCalled();expect(await getAllSnapshot()).toEqual(before)});
