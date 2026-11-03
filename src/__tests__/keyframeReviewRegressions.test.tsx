import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FrameWorkspace,useFrameOutputPreview} from '../components/keyframes/FrameWorkspace';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot,saveSceneDraft} from '../storage/db';
import {uploadDraftFrameImage} from '../storage/frameImages';
import {assembleImagePrompt} from '../domain/imagePromptDocument';
import {prepareFrameAuthoring} from '../domain/frameAuthoring';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import rasters from './fixtures/frame-raster-fixtures.json';
import type {SceneDraft,MediaAsset,SavedScene} from '../types/domain';

const library=vi.hoisted(()=>({setDirtyFormGuard:vi.fn(),hashPath:'/output/synthetic?outputTab=frames&frame=middle',navigate:vi.fn()}));
vi.mock('../context/LibraryContext',()=>({useLibrary:()=>library}));
afterEach(()=>{cleanup();vi.restoreAllMocks();window.location.hash='';});
function Workspace({draft,parent,media}:{draft:SceneDraft;parent:SavedScene;media:ReadonlyMap<string,MediaAsset>}){
 const preview=useFrameOutputPreview(draft,parent,media,{});
 return <FrameWorkspace source={draft} draft={draft} parent={parent} mediaMap={media} preview={preview} onChanged={async()=>{}} onEditCopy={()=>{}}/>;
}
for(const control of ['manual','clear','plan'] as const)it(`rejects stale Output ${control} writes and retains unsaved edits`,async()=>{
 const f=await seedKeyframeStorage();let draft=f.draft;
 if(control==='clear'){
  const file=new File([Uint8Array.from(atob(rasters.files[0].base64),c=>c.charCodeAt(0))],'synthetic.png',{type:'image/png'});
  await uploadDraftFrameImage({draftId:draft.id,expectedInputRevision:draft.inputRevision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,file});
  draft=(await getAllSnapshot()).drafts.find(d=>d.id===draft.id)!;
 }
 const state=await getAllSnapshot(),user=userEvent.setup();window.location.hash='#/output/synthetic?outputTab=frames&frame=middle';
 render(<Workspace draft={draft} parent={f.parent} media={new Map(state.media.map(m=>[m.id,m]))}/>);
 const edit=screen.getByRole('button',{name:'Edit manual image prompt'});await waitFor(()=>expect(edit).toBeEnabled());
 if(control==='manual'){await user.click(edit);await user.clear(screen.getByRole('textbox',{name:'Manual full image prompt'}));await user.type(screen.getByRole('textbox',{name:'Manual full image prompt'}),'Unsaved local text');}
 if(control==='plan'){await user.click(screen.getByRole('button',{name:'Edit frame plan'}));await user.clear(screen.getByRole('textbox',{name:'Frame label'}));await user.type(screen.getByRole('textbox',{name:'Frame label'}),'Unsaved local label');}
 await saveSceneDraft({...draft,title:'Newer title saved by another tab',expectedInputRevision:draft.inputRevision});const newer=await getAllSnapshot();
 await user.click(screen.getByRole('button',{name:control==='manual'?'Save manual image text':control==='clear'?'Clear draft frame image association':'Save frame plan'}));
 await screen.findByText(/This draft changed in another tab/);expect(await getAllSnapshot()).toEqual(newer);
 if(control==='manual')expect(screen.getByRole('textbox',{name:'Manual full image prompt'})).toHaveValue('Unsaved local text');
 if(control==='plan')expect(screen.getByRole('textbox',{name:'Frame label'})).toHaveValue('Unsaved local label');
});
it('advances ordinary C recipe revisions for creation, edits, manual text and removal, preserving non-bumping metadata',async()=>{
 const f=await seedKeyframeStorage(),base={...f.draft,id:'ordinary-c',sourceSceneId:undefined,revisionIntent:undefined,ensemble:undefined,blocking:undefined,keyframePlan:undefined,imagePromptSnapshots:undefined,manualImageOutputs:undefined,frameImageAssignments:undefined};
 let draft=await saveSceneDraft(base);
 const plan={version:1 as const,id:'ordinary-plan',frames:[{id:'still',label:'Unresolved still',role:'custom' as const,participantRefs:[],referenceAssociationIds:[]}]};
 for(const fields of [{keyframePlan:plan},{keyframePlan:{...plan,frames:[{...plan.frames[0],label:'Changed label'}]}},{manualImageOutputs:{still:{full:{text:'Exact text',basedOnVisualDigest:'a'.repeat(64),updatedAt:draft.updatedAt}}}},{keyframePlan:undefined,manualImageOutputs:undefined,confirmKeyframeRemoval:true}]){
  const old=draft;draft=await saveSceneDraft({...draft,...fields,expectedInputRevision:draft.inputRevision,bumpInputRevision:true});expect(draft.inputRevision).toBe(old.inputRevision+1);
  const state=await getAllSnapshot();await expect(saveSceneDraft({...old,title:'Stale overwrite',expectedInputRevision:old.inputRevision})).rejects.toThrow(/changed in another tab/);expect(await getAllSnapshot()).toEqual(state);
 }
 const unchanged=await saveSceneDraft({...draft,keyframePlan:plan,expectedInputRevision:draft.inputRevision,bumpInputRevision:false});expect(unchanged.inputRevision).toBe(draft.inputRevision);
});
it('assembles complete neighboring frames while retaining an unresolved middle and rejects plan-wide structural damage',async()=>{
 const {draft,media}=makeKeyframeFixture(),start=await assembleImagePrompt(draft,'start',media),end=await assembleImagePrompt(draft,'end',media);delete draft.keyframePlan!.frames[1].instant;
 for(const [id,original]of [['start',start],['end',end]] as const){const result=await assembleImagePrompt(draft,id,media);expect(result.ready).toBe(true);if(result.ready&&original.ready){expect(result.snapshot.full).toBe(original.snapshot.full);expect(result.snapshot.compact).toBe(original.snapshot.compact);}}
 expect((await assembleImagePrompt(draft,'middle',media)).ready).toBe(false);
 const prepared=await prepareFrameAuthoring(draft,undefined,media,{frameVideoDecision:'reassemble'});expect(prepared.findings.filter(f=>f.severity==='blocking')).toEqual([]);expect(Object.keys(prepared.images.imagePromptSnapshots??{})).toEqual(['start','end']);expect(prepared.afterPlan).toEqual(draft.keyframePlan);
 draft.keyframePlan!.frames[1].id='start';expect((await assembleImagePrompt(draft,'end',media)).ready).toBe(false);
});
for(const last of [false,true])it(`removes the ${last?'last frame':'whole plan'} through Output without touching saved history or media`,async()=>{
 const f=await seedKeyframeStorage();let draft=f.draft;
 if(last)draft=await saveSceneDraft({...draft,keyframePlan:{...draft.keyframePlan!,frames:[draft.keyframePlan!.frames[1]]},imagePromptSnapshots:{middle:draft.imagePromptSnapshots!.middle}});
 const before=await getAllSnapshot();window.location.hash='#/output/synthetic?outputTab=frames&frame=middle';const user=userEvent.setup();render(<Workspace draft={draft} parent={f.parent} media={new Map(before.media.map(m=>[m.id,m]))}/>);
 await user.click(screen.getByRole('button',{name:'Edit frame plan'}));await user.click(screen.getByRole('button',{name:last?'Remove selected frame':'Remove frame plan'}));await user.click(screen.getByRole('button',{name:last?'Confirm remove frame':'Confirm remove frame plan'}));await user.click(screen.getByRole('button',{name:'Save frame plan'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 const after=await getAllSnapshot();expect(after.drafts.find(d=>d.id===draft.id)!.keyframePlan).toBeUndefined();expect(after.scenes).toEqual(before.scenes);expect(after.collections).toEqual(before.collections);expect(after.media).toEqual(before.media);
});
