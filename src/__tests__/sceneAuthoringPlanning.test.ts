import { beforeEach, it, expect } from "vitest";
import {
  initializeDatabase,
  clearAllStoresForTesting,
  getAllSnapshot,
  saveSceneDraft,
} from "../storage/db";
import {
  buildRevisionDraft,
  planAuthoredScene,
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
const exact = '  MIDORI\r\n“Dito tayo!” 😊\r\n{"original":true}  ';
it("plans an exact immutable direct save without any database writes", async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Synthetic exact",
    directPrompt: { version: 1, text: exact },
  });
  const before = await getAllSnapshot();
  const plan = planAuthoredScene(
    draft,
    { requestId: "plan", expectedInputRevision: draft.inputRevision },
    before,
    { id: "scene_pure", now: "2026-10-30T00:00:00.000Z" },
  );
  expect(plan.scene.outputs.full).toBe(exact);
  expect(plan.scene.sceneRevision).toMatchObject({
    rootSceneId: "scene_pure",
    sequence: 1,
  });
  expect(await getAllSnapshot()).toEqual(before);
  const saved = await saveAuthoredScene(draft.id, {
    requestId: "save",
    expectedInputRevision: draft.inputRevision,
  });
  expect(saved.outputs).toEqual(plan.scene.outputs);
  expect(saved.references).toEqual(plan.scene.references);
});
it("constructs a revision draft with identical content and guards without persisting it", async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Synthetic revision",
    directPrompt: { version: 1, text: exact },
  });
  const saved = await saveAuthoredScene(draft.id, {
    requestId: "first",
    expectedInputRevision: draft.inputRevision,
  });
  const before = await getAllSnapshot(),
    pure = buildRevisionDraft(saved.id, before, {});
  expect(await getAllSnapshot()).toEqual(before);
  const persisted = await createSceneRevisionDraft(saved.id);
  // Persistence intentionally omits optional undefined fields; compare every present value.
  expect(persisted).toMatchObject(
    Object.fromEntries(Object.entries(pure).filter(([, v]) => v !== undefined)),
  );
  expect(pure.revisionIntent).toMatchObject({
    parentSceneId: saved.id,
    contextSceneId: saved.id,
    expectedHeadId: saved.id,
  });
});
