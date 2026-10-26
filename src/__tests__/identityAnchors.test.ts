import { describe, expect, it } from 'vitest';
import { getIdentityAnchorStatus, getIdentityRevision, resolveGenerationIdentity } from '../domain/identityAnchors';
import { createSnapshotFromAsset } from '../domain/promptAssembler';
import type { PromptAsset } from '../types/domain';
const master = { id:'m', category:'characters', title:'Mika', promptText:'Original master', revision:3, identityAnchor:{text:'Anchor',approvedText:'Anchor',approvedMasterIdentityRevision:3,approvedAt:'2026-10-26T00:00:00.000Z'}, mediaLinks:[] } as unknown as PromptAsset;
describe('identity anchors', () => {
 it('requires exact explicit approval against current identity revision', () => {
  expect(getIdentityRevision(master)).toBe(3);
  expect(getIdentityAnchorStatus(master)).toBe('approved');
  expect(getIdentityAnchorStatus({...master,identityRevision:4})).toBe('stale');
  expect(getIdentityAnchorStatus({...master,identityAnchor:{...master.identityAnchor!,text:'Edited'}})).toBe('draft');
 });
 it('captures anchor snapshots and falls back to selected master when live identity changes', () => {
  const slots={character:createSnapshotFromAsset(master)};
  const source={slots,generation:{identitySource:'approved_anchor' as const,anchor:{text:'Anchor',approvedMasterIdentityRevision:3,approvedAt:'2026-10-26T00:00:00.000Z'}}};
  expect(resolveGenerationIdentity(source,master).identity.description).toBe('Anchor');
  expect(resolveGenerationIdentity(source,{...master,promptText:'New master',identityRevision:4}).identity.description).toBe('Original master');
  expect(resolveGenerationIdentity(source,undefined,true).identity.description).toBe('Anchor');
  expect(resolveGenerationIdentity({slots},master).identity.source).toBe('master');
 });
});
import { beforeEach } from 'vitest';
import { approveIdentityAnchor, clearAllStoresForTesting, createDraftFromSavedScene, getAllSnapshot, initializeDatabase, openDatabase, saveIdentityAnchorDraft, savePromptAsset, saveSceneDraft, saveSceneFromDraft } from '../storage/db';
beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); });
it('guards approval concurrency, preserves draft approval history, and increments only master identity revisions', async () => {
 const original=await savePromptAsset({title:'Mika',category:'characters',promptText:'Original master',tags:[]});
 const approved=await approveIdentityAnchor(original.id,'Anchor',1);
 const edited=await saveIdentityAnchorDraft(original.id,'Draft',1);
 expect(edited.identityAnchor?.approvedText).toBe('Anchor');
 expect(getIdentityAnchorStatus(edited)).toBe('draft');
 const renamed=await savePromptAsset({...edited,title:'Renamed'});
 expect(renamed.identityRevision).toBe(1);
 const changed=await savePromptAsset({...renamed,promptText:'Changed master'});
 expect(changed.identityRevision).toBe(2);
 await expect(approveIdentityAnchor(original.id,'Wrong',1)).rejects.toThrow('identity changed');
 expect((await getAllSnapshot()).assets[0].promptText).toBe('Changed master');
 expect(approved.promptText).toBe('Original master');
});
it('freezes resolved choices and clones packs through scene copies while retaining canonical outputs', async () => {
 const asset=await savePromptAsset({title:'Mika',category:'characters',promptText:'Original master',tags:[]});
 const approved=await approveIdentityAnchor(asset.id,'Anchor',1);
 const character=createSnapshotFromAsset(approved);
 const environment={...character,slot:'environment' as const};
 const action={...character,slot:'action' as const};
 const draft=await saveSceneDraft({title:'Scene',slots:{character,environment,action},extraRequiredSlots:[],sceneInstructions:'',settings:{},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',referencePack:{version:1,entries:[]},generation:{identitySource:'approved_anchor',anchor:{text:'Anchor',approvedMasterIdentityRevision:1,approvedAt:approved.identityAnchor!.approvedAt!}}});
 const scene=await saveSceneFromDraft(draft.id);
 expect(scene.generation?.identitySource).toBe('approved_anchor');
 expect(scene.outputs.full).toContain('Original master');
 await savePromptAsset({...approved,promptText:'Changed master'});
 expect(resolveGenerationIdentity(scene,undefined,true).identity.description).toBe('Anchor');
 const copy=await createDraftFromSavedScene(scene.id);
 expect(copy.referencePack).toEqual({version:1,entries:[]});
 expect(copy.generation).toEqual(scene.generation);
 const staleSaved=await saveSceneFromDraft(copy.id);
 expect(staleSaved.generation?.identitySource).toBe('master');
 expect(staleSaved.generation?.fallbackReason).toBeTruthy();
});
it('materializes legacy identity revision on metadata save', async () => {
 const asset=await savePromptAsset({title:'Mika',category:'characters',promptText:'Master',tags:[]});
 const legacy={...asset,revision:7}; delete legacy.identityRevision;
 const db=await openDatabase();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(legacy);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
 const updated=await savePromptAsset({...legacy,title:'Changed title'});
 expect(updated.identityRevision).toBe(7);
 expect(updated.revision).toBe(8);
});
