import { it, expect, beforeEach } from "vitest";
import {
  getAllSnapshot,
  saveSceneDraft,
  saveSceneFromDraft,
  createDraftFromSavedScene as copySavedSceneToDraft,
  saveDraftAsTemplate,
  createDraftFromTemplate,
  collectReferencedMediaIds,
  getAssetDeletionDependencies,
  deletePromptAsset,
} from "../storage/db";
import {
  buildRevisionDraft,
  saveAuthoredScene,
  createSceneRevisionDraft,
} from "../storage/sceneAuthoring";
import { syncEnsemblePrimary, enableSceneEnsemble } from "../domain/ensemble";
import { collectReferenceCandidates } from "../domain/referencePack";
import {
  ensembleStorageFixture,
  writeRecord,
} from "./fixtures/ensembleStorageFixture";
import type { SceneDraft } from "../types/domain";
let input: SceneDraft;
beforeEach(async () => {
  input = await ensembleStorageFixture();
});
it('advances opted-in draft revisions and rejects a stale explicit save without changing the newer record',async()=>{
 const first=await saveSceneDraft(input), second=await saveSceneDraft({...first,title:'Newer synthetic draft',expectedInputRevision:first.inputRevision});
 expect(second.inputRevision).toBe(first.inputRevision+1);
 const metadata=await saveSceneDraft({...second,reviewNotes:'Metadata only',bumpInputRevision:false,expectedInputRevision:second.inputRevision});
 expect(metadata.inputRevision).toBe(second.inputRevision);
 await expect(saveSceneDraft({...first,title:'Stale local edit',expectedInputRevision:first.inputRevision})).rejects.toThrow(/another tab|compare/i);
 expect((await getAllSnapshot()).drafts.find(d=>d.id===first.id)).toEqual(metadata);
});
it("preserves an exact optional ensemble in a stored draft, both immutable save paths, copies and revision plans", async () => {
  const d = await saveSceneDraft(input);
  expect(d.ensemble).toEqual(input.ensemble);
  const scene = await saveSceneFromDraft(d.id);
  expect(scene.ensemble).toEqual(d.ensemble);
  const copy = await copySavedSceneToDraft(scene.id);
  expect(copy.ensemble).toEqual(scene.ensemble);
  const snap = await getAllSnapshot(),
    revision = buildRevisionDraft(scene.id, snap);
  expect(revision.ensemble).toEqual(scene.ensemble);
  const savedRevision = await saveSceneDraft(revision);
  const saved = await saveAuthoredScene(savedRevision.id, {
    requestId: "ensemble-revision",
    expectedInputRevision: savedRevision.inputRevision,
  });
  expect(saved.ensemble).toEqual(scene.ensemble);
  expect(
    (await getAllSnapshot()).scenes.find((s) => s.id === scene.id),
  ).toEqual(scene);
});
it("blocks a mismatched primary mirror or wrong-parent secondary outfit before a draft write", async () => {
  const before = await getAllSnapshot();
  input.ensemble!.participants[1].wardrobe!.parentCharacterId = "character";
  await expect(saveSceneDraft(input)).rejects.toThrow(/parent/i);
  expect(await getAllSnapshot()).toEqual(before);
  input.ensemble!.participants[1].wardrobe!.parentCharacterId = "lucas";
  input.slots.character!.promptText = "Silently replaced identity";
  await expect(saveSceneDraft(input)).rejects.toThrow(/mirror/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it("keeps incomplete cue text saveable as a draft and blocks immutable assembly", async () => {
  input.ensemble!.dialogueCues[1].line = "";
  const d = await saveSceneDraft(input);
  expect(d.ensemble).toEqual(input.ensemble);
  await expect(saveSceneFromDraft(d.id)).rejects.toThrow(/exact spoken line/i);
  expect((await getAllSnapshot()).scenes).toEqual([]);
});
it("freezes participants and ordered cues during a Camera-only revision after another live Character changes", async () => {
  const d = await saveSceneDraft(input),
    first = await saveAuthoredScene(d.id, {
      requestId: "first",
      expectedInputRevision: d.inputRevision,
    });
  expect(first.ensemble).toEqual(input.ensemble);
  const state = await getAllSnapshot(),
    lucas = state.assets.find((a) => a.id === "lucas")!;
  await writeRecord("assets", {
    ...lucas,
    promptText: "Changed LIVE identity only.",
    revision: lucas.revision + 1,
    identityRevision: 2,
  });
  let next = await createSceneRevisionDraft(first.id);
  next = await saveSceneDraft({
    ...next,
    slots: {
      ...next.slots,
      camera: {
        slot: "camera",
        sourceType: "asset",
        sourceId: "camera",
        sourceTitle: "Camera revision",
        sourceRevision: 2,
        promptText: "Slow camera push.",
        mediaLinks: [],
      },
    },
  });
  const saved = await saveAuthoredScene(next.id, {
    requestId: "camera-only",
    expectedInputRevision: next.inputRevision,
  });
  expect(saved.ensemble).toEqual(first.ensemble);
  expect(saved.outputs.full).not.toContain("Changed LIVE identity only.");
  expect(
    (await getAllSnapshot()).scenes.find((s) => s.id === first.id),
  ).toEqual(first);
});
it("resolves stale secondary anchors without rewriting the frozen master text or inventing approval", async () => {
  const p = input.ensemble!.participants[1],
    at = "2026-11-01T00:00:00.000Z";
  p.character.identityAnchor = {
    text: "Approved synthetic Lucas.",
    approvedText: "Approved synthetic Lucas.",
    approvedAt: at,
    approvedMasterIdentityRevision: 1,
  };
  p.generation = {
    identitySource: "approved_anchor",
    anchor: {
      text: "Approved synthetic Lucas.",
      approvedAt: at,
      approvedMasterIdentityRevision: 1,
    },
  };
  const d = await saveSceneDraft(syncEnsemblePrimary(input)),
    scene = await saveAuthoredScene(d.id, {
      requestId: "stale-anchor",
      expectedInputRevision: d.inputRevision,
    });
  expect(scene.ensemble!.participants[1].generation).toMatchObject({
    identitySource: "master",
    fallbackReason: expect.stringMatching(/stale|unavailable/i),
  });
  expect(scene.ensemble!.participants[1].character).toEqual(p.character);
});
it("requires an explicit ensemble template choice and shared-only omission confirmation", async () => {
  const draft = await saveSceneDraft(input),
    before = await getAllSnapshot(),
    params = {
      draft,
      name: "Synthetic template",
      description: "",
      includeCharacterIdentity: true,
    };
  await expect(saveDraftAsTemplate(params)).rejects.toThrow(
    /ensemble.*choice|choose.*ensemble/i,
  );
  await expect(
    saveDraftAsTemplate({ ...params, ensembleMode: "shared_only" } as any),
  ).rejects.toThrow(/confirm|omission/i);
  expect(await getAllSnapshot()).toEqual(before);
  const shared = await saveDraftAsTemplate({
    ...params,
    ensembleMode: "shared_only",
    confirmEnsembleOmissions: true,
  } as any);
  expect(shared.ensembleDefault).toBeUndefined();
  expect(shared.includedCharacterSnapshot).toBeUndefined();
  expect(shared.defaults.wardrobe).toBeUndefined();
  expect(
    (await getAllSnapshot()).drafts.find((d) => d.id === draft.id),
  ).toEqual(draft);
});
it("round trips full template participants, exact cues, frozen template sources and selected associations", async () => {
  input = await ensembleStorageFixture(true);
  const p = input.ensemble!.participants[0];
  p.character.sourceType = "template";
  p.character.sourceId = "legacy-template";
  p.wardrobe = {
    ...p.wardrobe!,
    sourceType: "template",
    sourceId: "legacy-template",
    parentCharacterId: undefined,
  };
  input = syncEnsemblePrimary(input);
  const refs = collectReferenceCandidates(
    input,
    new Map((await getAllSnapshot()).media.map((m) => [m.id, m])),
  );
  input.referencePack = { version: 1, entries: [{ ...refs[1], order: 0 }] };
  const draft = await saveSceneDraft(input);
  const template = await saveDraftAsTemplate({
    draft,
    name: "Full ensemble template",
    description: "",
    includeCharacterIdentity: false,
    ensembleMode: "full",
  } as any);
  expect(template.ensembleDefault?.ensemble).toEqual(draft.ensemble);
  expect(template.includedCharacterSnapshot).toBeUndefined();
  expect(template.defaults.wardrobe).toBeUndefined();
  const restored = await createDraftFromTemplate(template.id);
  expect(restored.ensemble).toEqual(draft.ensemble);
  expect(restored.referencePack).toEqual(draft.referencePack);
  expect(restored.slots.character?.sourceType).toBe("template");
  expect(restored.slots.wardrobe?.sourceType).toBe("template");
});
it("retains nested secondary and off-camera attachments even without optional pack metadata", async () => {
  input = await ensembleStorageFixture(true);
  input.ensemble!.participants[0].character.mediaLinks = [];
  input.ensemble!.participants[1].presence = "off_camera";
  input.ensemble!.dialogueCues[1].mode = "voiceover";
  input = syncEnsemblePrimary(input);
  const before = await getAllSnapshot();
  const id = input.ensemble!.participants[1].character.mediaLinks[0].mediaId;
  expect(
    collectReferencedMediaIds(
      { ...before, drafts: [input] },
      { includeOptionalMetadata: false },
    ).has(id),
  ).toBe(true);
  const template = {
    ...before.templates[0],
    ensembleDefault: { version: 1 as const, ensemble: input.ensemble! },
  };
  expect(
    collectReferencedMediaIds(
      { ...before, drafts: [], scenes: [], templates: [template] },
      { includeOptionalMetadata: false },
    ).has(id),
  ).toBe(true);
  const d = await saveSceneDraft(input);
  expect(
    (await getAssetDeletionDependencies("lucas")).usedInDrafts.map((d) => d.id),
  ).toContain(d.id);
  await deletePromptAsset("lucas");
  expect((await getAllSnapshot()).media.some((m) => m.id === id)).toBe(true);
});
it("rejects Direct Prompt conversion instead of dropping an ensemble while preparing a revision", async () => {
  const d = await saveSceneDraft(input),
    scene = await saveSceneFromDraft(d.id),
    before = await getAllSnapshot();
  expect(() =>
    buildRevisionDraft(scene.id, before, { asDirect: true }),
  ).toThrow(/B3|conversion|ensemble/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it("appends an explicit ensemble revision without changing the old preferred take or saved scene", async () => {
  const d = await saveSceneDraft(input),
    target = {
      collectionId: "project",
      shotId: "shot",
      expectedProjectRevision: 1,
    };
  const first = await saveAuthoredScene(d.id, {
    requestId: "preferred-first",
    expectedInputRevision: d.inputRevision,
    target,
    selectAsPreferred: true,
  });
  const before = await getAllSnapshot(),
    collection = before.collections.find((c) => c.id === "project")!,
    nextTarget = {
      ...target,
      expectedProjectRevision: collection.project!.revision,
    };
  const revision = await createSceneRevisionDraft(first.id, {
    target: nextTarget,
  });
  const next = await saveAuthoredScene(revision.id, {
    requestId: "preferred-preserved",
    expectedInputRevision: revision.inputRevision,
    target: nextTarget,
  });
  const after = await getAllSnapshot(),
    shot = after.collections.find((c) => c.id === "project")!.project!.shots[0];
  expect(shot.selectedSceneId).toBe(first.id);
  expect(shot.takeSceneIds).toEqual([first.id, next.id]);
  expect(after.scenes.find((s) => s.id === first.id)).toEqual(first);
  expect(next.ensemble).toEqual(first.ensemble);
});
it("does not let an older caller erase stored ensemble metadata by omitting the field", async () => {
  const saved = await saveSceneDraft(input),
    before = await getAllSnapshot(),
    { ensemble, ...olderCaller } = saved;
  expect(ensemble).toBeDefined();
  await expect(
    saveSceneDraft({ ...olderCaller, sceneInstructions: "Old tab write." }),
  ).rejects.toThrow(/ensemble|current workspace/i);
  expect(await getAllSnapshot()).toEqual(before);
});
it("maps only the selected primary legacy associations on explicit opt-in without changing the original", async () => {
  input = await ensembleStorageFixture(true);
  const { ensemble, ...legacy } = input;
  const media = new Map((await getAllSnapshot()).media.map((m) => [m.id, m]));
  legacy.referencePack = {
    version: 1,
    entries: [collectReferenceCandidates(legacy, media)[0]],
  };
  const before = structuredClone(legacy),
    next = enableSceneEnsemble(legacy);
  expect(ensemble).toBeDefined();
  expect(next.referencePack!.entries).toHaveLength(1);
  expect(next.referencePack!.entries[0]).toMatchObject({
    participantId: "primary",
    sourceId: "character",
  });
  expect(next.referencePack!.entries[0].associationId).toBe(
    collectReferenceCandidates(next, media)[0].associationId,
  );
  expect(legacy).toEqual(before);
});
