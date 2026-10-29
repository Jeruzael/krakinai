import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  getAllSnapshot,
  saveSceneDraft,
  createCollection,
  saveMediaAsset,
  saveSceneFromDraft,
} from "../storage/db";
import { addProjectShot, selectProjectTake } from "../storage/projects";
import {
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
const text =
  "  MIDORI\r\n\r\n“Dito ang tahanan.” 😊 e\u0301\r\nNegative: Do not invent dimensions.  ";
const make = async (value = text) => {
  const draft = await createDirectPromptDraft();
  return saveSceneDraft({
    ...draft,
    title: "MIDORI Shot 05",
    shotType: "property_environment",
    directPrompt: { version: 1, text: value, origin: "chatgpt" },
  });
};
const save = (
  draft: Awaited<ReturnType<typeof make>>,
  requestId: string = crypto.randomUUID(),
  extra: object = {},
) =>
  saveAuthoredScene(draft.id, {
    requestId,
    expectedInputRevision: draft.inputRevision,
    ...extra,
  });
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
describe("direct scene storage", () => {
  it("saves complete text without components or fake assets, and supports the established saver entry", async () => {
    const draft = await make();
    const scene = await saveSceneFromDraft(draft.id, {
      requestId: "legacy-entry",
      expectedInputRevision: draft.inputRevision,
    });
    expect(scene.outputs).toEqual({ full: text });
    expect(scene.directPrompt?.text).toBe(text);
    expect(scene.slots).toEqual({});
    expect((await getAllSnapshot()).assets).toHaveLength(0);
    expect(scene.sceneRevision?.sequence).toBe(1);
  });
  it("creates distinct immutable versions and restores old content as a new revision", async () => {
    const first = await save(await make());
    const initial = structuredClone(first);
    let d2 = await createSceneRevisionDraft(first.id);
    d2 = await saveSceneDraft({
      ...d2,
      directPrompt: {
        version: 1,
        text: "Static wide with subtle optical zoom.",
        origin: "codex",
      },
    });
    const second = await save(d2);
    expect(second.id).not.toBe(first.id);
    expect(second.versionOfSceneId).toBe(first.id);
    expect(second.sceneRevision).toMatchObject({
      rootSceneId: first.id,
      parentSceneId: first.id,
      sequence: 2,
    });
    const restore = await createSceneRevisionDraft(second.id, {
      restoreFromSceneId: first.id,
    });
    const third = await save(restore);
    expect(third.outputs.full).toBe(text);
    expect(third.sceneRevision).toMatchObject({
      sequence: 3,
      parentSceneId: second.id,
      restoredFromSceneId: first.id,
    });
    expect(
      (await getAllSnapshot()).scenes.find((s) => s.id === first.id),
    ).toEqual(initial);
  });
  it("binds retry IDs to exact content and does not duplicate a saved operation", async () => {
    const draft = await make();
    const first = await save(draft, "retry");
    expect(await save(draft, "retry")).toEqual(first);
    await saveSceneDraft({
      ...draft,
      directPrompt: { version: 1, text: "Changed" },
    });
    await expect(save(draft, "retry")).rejects.toThrow(/request|stale/i);
    expect((await getAllSnapshot()).scenes).toHaveLength(1);
  });
  it("rejects stale draft and stale revision-head submissions while preserving drafts", async () => {
    const draft = await make();
    await saveSceneDraft({ ...draft, title: "Updated" });
    await expect(save(draft)).rejects.toThrow(/draft.*changed|stale/i);
    const first = await save(await make("First"));
    const a = await createSceneRevisionDraft(first.id);
    let b = await createSceneRevisionDraft(first.id);
    b = await saveSceneDraft({ ...b, directPrompt: { version: 1, text: "B" } });
    await save(b);
    await expect(save(a)).rejects.toThrow(/newer|head|stale/i);
    expect((await getAllSnapshot()).drafts.some((d) => d.id === a.id)).toBe(
      true,
    );
  });
  it("appends to a planned shot without choosing a preference or changing status", async () => {
    const c = await createCollection({ name: "MIDORI" });
    const p = await addProjectShot({
      collectionId: c.id,
      title: "05 Living room",
    });
    const shot = p.project!.shots[0];
    const target = {
      collectionId: c.id,
      shotId: shot.id,
      expectedProjectRevision: p.project!.revision,
    };
    const draft = await make();
    const scene = await save(draft, "planned", { target });
    const snap = await getAllSnapshot();
    const after = snap.collections[0].project!.shots[0];
    expect(after.takeSceneIds).toEqual([scene.id]);
    expect(after.selectedSceneId).toBeUndefined();
    expect(after.status).toBe("planned");
  });
  it("requires an explicit choice to replace the preferred version and isolates other projects", async () => {
    const first = await save(await make());
    const a = await createCollection({ name: "MIDORI" }),
      b = await createCollection({ name: "Drama" });
    const midori = await addProjectShot({
      collectionId: a.id,
      title: "05",
      sceneId: first.id,
    });
    const drama = await addProjectShot({
      collectionId: b.id,
      title: "Opening",
    });
    const target = {
      collectionId: a.id,
      shotId: midori.project!.shots[0].id,
      expectedProjectRevision: midori.project!.revision,
    };
    const originalDrama = structuredClone(drama);
    let draft = await createSceneRevisionDraft(first.id, { target });
    draft = await saveSceneDraft({
      ...draft,
      directPrompt: { version: 1, text: "Revised camera" },
    });
    const second = await save(draft, "version", { target });
    let snap = await getAllSnapshot();
    expect(
      snap.collections.find((c) => c.id === a.id)!.project!.shots[0]
        .selectedSceneId,
    ).toBe(first.id);
    expect(snap.collections.find((c) => c.id === b.id)).toEqual(originalDrama);
    await selectProjectTake({
      collectionId: a.id,
      shotId: target.shotId,
      sceneId: second.id,
    });
    snap = await getAllSnapshot();
    expect(
      snap.collections.find((c) => c.id === a.id)!.project!.shots[0]
        .selectedSceneId,
    ).toBe(second.id);
  });
  it("rejects a revision targeted at an unrelated project shot", async () => {
    const first = await save(await make());
    const c = await createCollection({ name: "Drama" });
    const p = await addProjectShot({ collectionId: c.id, title: "Drama" });
    const target = {
      collectionId: c.id,
      shotId: p.project!.shots[0].id,
      expectedProjectRevision: p.project!.revision,
    };
    await expect(
      createSceneRevisionDraft(first.id, { target }),
    ).rejects.toThrow(/belong|target|shot/i);
  });
  it("creates a new shot atomically and retries without another shot", async () => {
    const c = await createCollection({ name: "MIDORI" });
    const draft = await make();
    const target = {
      collectionId: c.id,
      newShot: { title: "Living Room" },
      expectedProjectRevision: 0,
    };
    const first = await save(draft, "new-shot", { target });
    expect(await save(draft, "new-shot", { target })).toEqual(first);
    expect((await getAllSnapshot()).collections[0].project!.shots).toHaveLength(
      1,
    );
  });
  it("rejects stale project revision without creating a scene or shot", async () => {
    const c = await createCollection({ name: "MIDORI" });
    await addProjectShot({
      collectionId: c.id,
      title: "Someone else added this",
    });
    const draft = await make();
    const before = await getAllSnapshot();
    await expect(
      save(draft, "stale", {
        target: {
          collectionId: c.id,
          newShot: { title: "New" },
          expectedProjectRevision: 0,
        },
      }),
    ).rejects.toThrow(/project.*changed|revision|stale/i);
    const after = await getAllSnapshot();
    expect(after.scenes).toEqual(before.scenes);
    expect(after.collections).toEqual(before.collections);
  });
  it("saves unresolved source-based text but rejects an asserted missing attachment", async () => {
    let draft = await make();
    draft = await saveSceneDraft({
      ...draft,
      shotType: "graphic_motion",
      pendingInputs: [
        { version: 1, id: "floor", kind: "source_image", label: "Floor plan" },
      ],
    });
    expect((await save(draft)).outputs.full).toBe(text);
    draft = await saveSceneDraft({
      ...draft,
      sourceMediaLinks: [
        {
          mediaId: "missing",
          role: "reference",
          altText: "Original",
          order: 0,
          mimeType: "image/png",
        },
      ],
    });
    await expect(save(draft)).rejects.toThrow(/missing/i);
    expect(
      (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)
        ?.directPrompt?.text,
    ).toBe(text);
  });
  it("captures existing reference names and keeps blobs reachable from direct drafts", async () => {
    const media = await saveMediaAsset({
      filename: "Original image.png",
      mimeType: "image/png",
      blob: new Blob(["png"], { type: "image/png" }),
    });
    let draft = await make();
    draft = await saveSceneDraft({
      ...draft,
      directReferences: [
        {
          mediaId: media.id,
          role: "reference",
          altText: "Original guide",
          order: 0,
        },
      ],
    });
    const scene = await save(draft);
    expect(scene.references).toMatchObject([
      {
        mediaId: media.id,
        filename: "Original image.png",
        namesCaptured: true,
      },
    ]);
    expect((await getAllSnapshot()).media).toHaveLength(1);
  });
  it("rolls back a new scene and new shot when a write throws a quota error", async () => {
    const c = await createCollection({ name: "MIDORI" });
    const draft = await make();
    const before = await getAllSnapshot();
    const original = IDBObjectStore.prototype.add;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "add")
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore["add"]>
      ) {
        if (this.name === "scenes")
          throw new DOMException(
            "Synthetic quota failure",
            "QuotaExceededError",
          );
        return original.apply(this, args);
      });
    try {
      await expect(
        save(draft, "quota", {
          target: {
            collectionId: c.id,
            newShot: { title: "New" },
            expectedProjectRevision: 0,
          },
        }),
      ).rejects.toThrow(/quota/i);
    } finally {
      spy.mockRestore();
    }
    const after = await getAllSnapshot();
    expect(after.scenes).toEqual(before.scenes);
    expect(after.collections).toEqual(before.collections);
    expect(after.preferences).toEqual(before.preferences);
  });
  it("retains each original-source association exactly once when creating a revision", async () => {
    const media = await saveMediaAsset({
      filename: "original.png",
      mimeType: "image/png",
      blob: new Blob(["synthetic"], { type: "image/png" }),
    });
    let draft = await make();
    draft = await saveSceneDraft({
      ...draft,
      shotType: "graphic_motion",
      sourceMediaLinks: [
        {
          mediaId: media.id,
          role: "reference",
          altText: "Original source",
          order: 0,
          mimeType: media.mimeType,
          filename: media.filename,
        },
      ],
    });
    const first = await save(draft),
      next = await createSceneRevisionDraft(first.id);
    const second = await save(next);
    expect(second.references).toEqual(first.references);
    expect(second.sourceMediaLinks).toEqual(first.sourceMediaLinks);
  });
  it("binds the expected revision for an explicit preferred selection", async () => {
    const first = await save(await make());
    const c = await createCollection({ name: "MIDORI" });
    const p = await addProjectShot({
      collectionId: c.id,
      title: "05",
      sceneId: first.id,
    });
    await addProjectShot({ collectionId: c.id, title: "Later edit" });
    await expect(
      selectProjectTake({
        collectionId: c.id,
        shotId: p.project!.shots[0].id,
        sceneId: first.id,
        expectedRevision: p.project!.revision,
      }),
    ).rejects.toThrow(/revision|changed/i);
  });
});
