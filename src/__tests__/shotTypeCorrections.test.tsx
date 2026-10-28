import { beforeEach, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryProvider } from '../context/LibraryContext';
import { PromptOutputScreen } from '../screens/PromptOutputScreen';
import { assembleScenePrompt } from '../domain/promptAssembler';
import { buildGenerationDocument } from '../domain/generationDocument';
import { serializeSceneJson } from '../domain/sceneDocument';
import { legacyDraft } from './fixtures/legacyScene';
import { clearAllStoresForTesting, initializeDatabase, createDraftFromSavedScene, getAllSnapshot, replaceAllStoresTransactionally, saveMediaAsset, saveSceneDraft, saveSceneFromDraft } from '../storage/db';
import { exportFullBackupZip, restoreFullBackupZip, validateBackupZip } from '../storage/backup';

beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();window.location.hash='#/';});
async function characterCopy() {
  const original=await saveMediaAsset({filename:'synthetic-source.png',mimeType:'image/png',blob:new Blob(['opaque unit fixture'],{type:'image/png'})});
  const d=structuredClone(legacyDraft);delete d.dialogue;d.manualOutputs={};d.avoidText='Authored no text overlay.';
  for(const slot of Object.values(d.slots)){slot!.mediaLinks=[];delete slot!.avoidText;}
  d.slots.character!.avoidText='no red clothing';d.slots.environment!.avoidText='no forest';
  const link={mediaId:original.id,filename:original.filename,mimeType:original.mimeType,role:'reference' as const,altText:'Original image',order:0};
  d.slots.character!.mediaLinks=[link];
  d.referencePack={version:1,entries:[{...link,associationId:'character-original',sourceSlot:'character',sourceId:d.slots.character!.sourceId,sourceTitle:'Character',purpose:'identity'}]};
  const stored=await saveSceneDraft(d),saved=await saveSceneFromDraft(stored.id);
  return {copy:await createDraftFromSavedScene(saved.id),link};
}
it.each(['copy','copy of a copy','refreshed copy','older refreshed copy','refreshed saved copy','older refreshed saved copy'] as const)('excludes inherited inactive negatives in a graphic %s while retaining authored text',async variant=>{
  const fixture=await characterCopy();let copy=fixture.copy;
  // Legacy Character copies retain their existing aggregate-negative behavior.
  expect(assembleScenePrompt(copy).avoidText).toBe('no red clothing, no forest, no red clothing, no forest, Authored no text overlay.');
  if(variant==='copy of a copy')copy=await createDraftFromSavedScene((await saveSceneFromDraft(copy.id)).id);
  if(variant==='older refreshed copy'){
    delete copy.inheritedAvoidPrefix;
    const snapshot=await getAllSnapshot();delete snapshot.drafts.find(d=>d.id===copy.id)!.inheritedAvoidPrefix;
    await replaceAllStoresTransactionally(snapshot);
  }
  if(variant.includes('refreshed')){copy.slots.character!.avoidText='refreshed character negative';copy.slots.environment!.avoidText='refreshed environment negative';}
  if(variant.includes('saved copy')){
    const stored=await saveSceneDraft(copy),scene=await saveSceneFromDraft(stored.id);
    if(variant.startsWith('older')){
      const snapshot=await getAllSnapshot();for(const value of snapshot.scenes)delete (value as typeof value & {inheritedAvoidPrefix?:string}).inheritedAvoidPrefix;
      await replaceAllStoresTransactionally(snapshot);
    }
    copy=await createDraftFromSavedScene(scene.id);
  }
  const graphic=await saveSceneDraft({...copy,shotType:'graphic_motion',sourceMediaLinks:[fixture.link],sceneInstructions:'Preserve the original graphic. Subtle zoom.'});
  expect(assembleScenePrompt(graphic).avoidText).toBe('Authored no text overlay.');
  expect(buildGenerationDocument(graphic).negativeInstructions).toEqual(['Authored no text overlay.']);
  expect(JSON.parse(serializeSceneJson(graphic)).avoidText).toBe('Authored no text overlay.');
  const scene=await saveSceneFromDraft(graphic.id);
  expect(scene.avoidText).toBe('Authored no text overlay.');
  expect(buildGenerationDocument(scene).negativeInstructions).toEqual(['Authored no text overlay.']);
  expect((await getAllSnapshot()).drafts.find(d=>d.id===graphic.id)!.slots.character).toBeDefined();
});
it('keeps a reference pack applied from Output restorable with inactive entries retained',async()=>{
  const {copy,link}=await characterCopy();
  const graphic=await saveSceneDraft({...copy,shotType:'graphic_motion',sourceMediaLinks:[link],sceneInstructions:'Preserve the original graphic.'});
  render(<LibraryProvider><PromptOutputScreen id={graphic.id}/></LibraryProvider>);
  await userEvent.click(await screen.findByRole('tab',{name:'References'}));
  await userEvent.click(screen.getByRole('button',{name:'Manage Reference Pack'}));
  await userEvent.click(await screen.findByRole('button',{name:'Apply Reference Pack'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Reference Pack Manager'})).not.toBeInTheDocument());
  const draft=(await getAllSnapshot()).drafts.find(d=>d.id===graphic.id)!;
  expect(draft.referencePack!.entries.map(e=>e.order)).toEqual([0,1]);
  expect(draft.referencePack!.entries.some(e=>e.sourceSlot==='character')).toBe(true);
  const zip=await exportFullBackupZip();expect((await validateBackupZip(zip)).valid).toBe(true);
  await restoreFullBackupZip(zip);
  expect((await getAllSnapshot()).drafts.find(d=>d.id===graphic.id)!.referencePack).toEqual(draft.referencePack);
});
