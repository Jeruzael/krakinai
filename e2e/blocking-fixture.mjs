// Only call from a fresh synthetic Playwright context, never a user's browser.
export async function seedBlocking(page,options={}){
 await page.goto('/__qa_ready');
 const ids=await page.evaluate(async options=>{
  const {seedBlockingStorage}=await import('/src/__tests__/fixtures/blockingStorageFixture.ts');
  const {writeRecord}=await import('/src/__tests__/fixtures/ensembleStorageFixture.ts');
  const {assembleScenePrompt}=await import('/src/domain/promptAssembler.ts');
  const f=await seedBlockingStorage({saveScene:!!options.saved,select:!!options.saved});
  let previousSceneId;
  if(options.sequence){
   const db=await import('/src/storage/db.ts'),author=await import('/src/storage/sceneAuthoring.ts'),continuity=await import('/src/storage/projectContinuity.ts');
   const state=await db.getAllSnapshot(),collection=state.collections.find(c=>c.id===f.projectId),input={...author.buildRevisionDraft('blocking-before',state,{target:{collectionId:f.projectId,shotId:'shot-before',expectedProjectRevision:collection.project.revision}}),blocking:structuredClone(f.draft.blocking)};
   input.blocking.participants[0].end.zone='left';const priorDraft=await db.saveSceneDraft(input),previous=await author.saveAuthoredScene(priorDraft.id,{requestId:'synthetic-previous-blocking',expectedInputRevision:priorDraft.inputRevision,selectAsPreferred:true});previousSceneId=previous.id;
   await continuity.updateProjectFrames({collectionId:f.projectId,shotId:'shot-before',lastFrameMediaId:'blocking-media'});
   const updated=await continuity.updateProjectFrames({collectionId:f.projectId,shotId:f.shotId,firstFrameMediaId:'blocking-media'});
   await continuity.upsertProjectTransition({collectionId:f.projectId,expectedRevision:updated.project.revision,transition:{fromShotId:'shot-before',toShotId:f.shotId,type:'match_cut',description:'Synthetic unchanged transition.',notes:'Keep existing image associations.'}});
  }
  if(options.stale)f.draft.blocking.participants[0].bindingToken='synthetic-stale-binding';
  if(options.manual)f.draft.manualOutputs.full={text:'Synthetic exact manual output.\r\nKeep every byte. ✨\n',basedOnInputRevision:f.draft.inputRevision,updatedAt:f.draft.updatedAt};
  if(options.legacy){delete f.draft.blocking;delete f.draft.ensemble;delete f.draft.revisionIntent;delete f.draft.authoredProjectTarget;delete f.draft.sourceSceneId;f.draft.dialogue={speaker:'Aya',line:'We are ready.',mode:'spoken'};}
  if(options.long){f.draft.sceneInstructions='Synthetic long instructions; remain collapsed. '.repeat(100);f.draft.ensemble.participants[0].character.sourceTitle='Aya / Base Identity · '+ 'long name '.repeat(15);f.draft.slots.character=structuredClone(f.draft.ensemble.participants[0].character);}
  await writeRecord('drafts',f.draft);
  const assembled=assembleScenePrompt(f.draft);
  return {draftId:f.draft.id,projectId:f.projectId,shotId:f.shotId,parentSceneId:f.parentSceneId,sceneId:f.scene?.id,previousSceneId,outputs:assembled.outputs,manual:f.draft.manualOutputs.full?.text};
 },options);
 await page.goto('/#/builder/'+ids.draftId);await page.getByRole('button',{name:'Assemble Prompt',exact:true}).waitFor();return ids;
}
