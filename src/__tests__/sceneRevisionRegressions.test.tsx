import { beforeEach, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strFromU8, unzipSync } from "fflate";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  saveSceneFromDraft,
  getAllSnapshot,
  saveMediaAsset,
  createCollection,
  createDraftFromSavedScene,
} from "../storage/db";
import {
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import { addProjectShot } from "../storage/projects";
import { compareSceneVersions } from "../domain/sceneRevisions";
import { buildProjectExport } from "../domain/projectExport";
import { LibraryProvider, useLibrary } from "../context/LibraryContext";
import { DirectPromptWorkspace } from "../components/DirectPromptWorkspace";
import { assembleScenePrompt } from "../domain/promptAssembler";
const recipe = async () => {
  const slot = (
    name: "character" | "environment" | "action",
    promptText: string,
  ) => ({
    slot: name,
    sourceType: "asset" as const,
    sourceId: `asset-${name}`,
    sourceRevision: 1,
    sourceTitle: name === "character" ? "Mika / Base Identity" : name,
    promptText,
    mediaLinks: [],
  });
  return saveSceneDraft({
    title: "Mika original recipe",
    slots: {
      character: slot("character", "Mika, a fictional adult."),
      environment: {
        ...slot("environment", "A quiet room."),
        avoidText: "No distortion",
      },
      action: slot("action", "Mika closes a notebook."),
    },
    extraRequiredSlots: [],
    sceneInstructions: "Keep exact framing.",
    dialogue: {
      speaker: "Mika",
      line: "  “Dito tayo.”\nTara na 😊  ",
      mode: "on_camera",
      language: "Taglish",
      deliveryNotes: "Keep the pause.",
    },
    settings: { aspectRatio: "9:16", durationSeconds: 8 },
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: "",
    reviewStatus: "unreviewed",
  });
};
const final = async (
  draft: Awaited<ReturnType<typeof recipe>>,
  requestId: string,
) =>
  saveAuthoredScene(draft.id, {
    requestId,
    expectedInputRevision: draft.inputRevision,
  });
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("retains repeated explicit direct associations to one stored blob in the export pack", async () => {
  const media = await saveMediaAsset({
    filename: "repeat.png",
    mimeType: "image/png",
    blob: new Blob(["synthetic"], { type: "image/png" }),
  });
  const link = {
    mediaId: media.id,
    role: "reference" as const,
    altText: "Same guide",
    order: 0,
  };
  let d = await createDirectPromptDraft();
  d = await saveSceneDraft({
    ...d,
    title: "Repeated association",
    directPrompt: { version: 1, text: "Complete" },
    directReferences: [link],
    referencePack: {
      version: 1,
      entries: [
        {
          ...link,
          associationId: "first",
          sourceSlot: "legacy",
          sourceId: "origin",
          sourceTitle: "Original",
          purpose: "general",
        },
      ],
    },
  });
  const first = await final(d, "repeat-one");
  let next = await createSceneRevisionDraft(first.id);
  next = await saveSceneDraft({
    ...next,
    directReferences: [...next.directReferences!, { ...link, order: 1 }],
  });
  const second = await final(next, "repeat-two");
  expect(second.referencePack?.entries).toHaveLength(2);
  expect(second.references).toHaveLength(2);
});
it("keeps shared history linear while attaching a revision only to the explicitly selected project", async () => {
  const first = await saveSceneFromDraft((await recipe()).id),
    a = await createCollection({ name: "A" }),
    b = await createCollection({ name: "B" });
  const pa = await addProjectShot({
      collectionId: a.id,
      title: "A shot",
      sceneId: first.id,
    }),
    pb = await addProjectShot({
      collectionId: b.id,
      title: "B shot",
      sceneId: first.id,
    });
  const ta = {
      collectionId: a.id,
      shotId: pa.project!.shots[0].id,
      expectedProjectRevision: pa.project!.revision,
    },
    tb = {
      collectionId: b.id,
      shotId: pb.project!.shots[0].id,
      expectedProjectRevision: pb.project!.revision,
    };
  const second = await final(
    await createSceneRevisionDraft(first.id, { target: ta }),
    "shared-two",
  );
  const before = (await getAllSnapshot()).collections.find(
    (c) => c.id === a.id,
  );
  const third = await final(
    await createSceneRevisionDraft(first.id, { target: tb }),
    "shared-three",
  );
  expect(third.sceneRevision).toMatchObject({
    sequence: 3,
    parentSceneId: second.id,
  });
  expect(
    (await getAllSnapshot()).collections.find((c) => c.id === a.id),
  ).toEqual(before);
  expect(
    (await getAllSnapshot()).collections.find((c) => c.id === b.id)!.project!
      .shots[0].takeSceneIds,
  ).toContain(third.id);
});
it("retains every dialogue field in a recipe new version and restore draft", async () => {
  const first = await saveSceneFromDraft((await recipe()).id);
  const next = await createSceneRevisionDraft(first.id);
  expect(next.dialogue).toEqual(first.dialogue);
  const second = await final(next, "second");
  expect(second.dialogue).toEqual(first.dialogue);
  const restored = await createSceneRevisionDraft(second.id, {
    restoreFromSceneId: first.id,
  });
  expect(restored.dialogue).toEqual(first.dialogue);
});
it("does not duplicate aggregated negative text in an unchanged recipe revision", async () => {
  const first = await saveSceneFromDraft((await recipe()).id),
    next = await createSceneRevisionDraft(first.id);
  expect(assembleScenePrompt(next).avoidText).toBe(first.avoidText);
  const second = await final(next, "negative");
  expect(second.avoidText).toBe(first.avoidText);
  expect(second.outputs).toEqual(first.outputs);
});
it("preserves a frozen manual Full output when explicitly converting a recipe", async () => {
  let draft = await recipe();
  draft = await saveSceneDraft({
    ...draft,
    manualOutputs: {
      full: {
        text: '  Provider-specific {"exact":true}\r\n 😊  ',
        basedOnInputRevision: draft.inputRevision,
        updatedAt: new Date().toISOString(),
      },
    },
  });
  const first = await saveSceneFromDraft(draft.id);
  const converted = await createSceneRevisionDraft(first.id, {
    asDirect: true,
  });
  expect(converted.directPrompt?.text).toBe(first.outputs.full);
  expect(converted.slots).toEqual(first.slots);
});
it("includes new direct and original-source references while preserving an inherited pack exclusion", async () => {
  const image = async (name: string) =>
    saveMediaAsset({
      filename: name,
      mimeType: "image/png",
      blob: new Blob([`synthetic-${name}`], { type: "image/png" }),
    });
  const a = await image("selected.png"),
    excluded = await image("excluded.png"),
    added = await image("added.png"),
    source = await image("source.png");
  let draft = await recipe();
  const link = (media: typeof a, altText: string) => ({
    mediaId: media.id,
    role: "reference" as const,
    altText,
    filename: media.filename,
    mimeType: media.mimeType,
    order: 0,
  });
  draft = await saveSceneDraft({
    ...draft,
    slots: {
      ...draft.slots,
      environment: {
        ...draft.slots.environment!,
        mediaLinks: [link(a, "Selected"), link(excluded, "Excluded")],
      },
    },
    referencePack: {
      version: 1,
      entries: [
        {
          ...link(a, "Selected"),
          associationId: "selected",
          sourceSlot: "environment",
          sourceId: draft.slots.environment!.sourceId,
          sourceTitle: "Room",
          purpose: "environment",
        },
      ],
    },
  });
  const first = await saveSceneFromDraft(draft.id);
  let converted = await createSceneRevisionDraft(first.id, { asDirect: true });
  converted = await saveSceneDraft({
    ...converted,
    shotType: "graphic_motion",
    directReferences: [
      ...converted.directReferences!,
      link(added, "Added after conversion"),
    ],
    sourceMediaLinks: [link(source, "New original source")],
  });
  const scene = await final(converted, "with-new-refs");
  const collection = await createCollection({ name: "Export" });
  const project = await addProjectShot({
    collectionId: collection.id,
    title: "05",
    sceneId: scene.id,
  });
  const result = await buildProjectExport(project, await getAllSnapshot());
  const mediaIds = result.manifest.associations
    .filter((x) => !x.excluded)
    .map((x) => x.mediaId);
  expect(mediaIds).toContain(a.id);
  expect(mediaIds).toContain(added.id);
  expect(mediaIds).toContain(source.id);
  expect(mediaIds).not.toContain(excluded.id);
  expect(
    Object.values(unzipSync(result.bytes)).some(
      (bytes) => strFromU8(bytes) === "synthetic-added.png",
    ),
  ).toBe(true);
});
it("discloses direct reference changes even when both versions have an inherited pack", async () => {
  const a = await saveMediaAsset({
    filename: "first.png",
    mimeType: "image/png",
    blob: new Blob(["a"], { type: "image/png" }),
  });
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Direct",
    directPrompt: { version: 1, text: "Complete" },
    directReferences: [
      { mediaId: a.id, role: "reference", altText: "A", order: 0 },
    ],
    referencePack: {
      version: 1,
      entries: [
        {
          associationId: "a",
          mediaId: a.id,
          sourceSlot: "legacy",
          sourceId: "origin",
          sourceTitle: "Original",
          role: "reference",
          altText: "A",
          purpose: "general",
          order: 0,
        },
      ],
    },
  });
  const before = await final(draft, "diff-original");
  const after = {
    ...before,
    directReferences: [
      ...before.directReferences!,
      { mediaId: "second", role: "reference" as const, altText: "B", order: 1 },
    ],
    references: [
      ...before.references,
      { mediaId: "second", role: "reference" as const, altText: "B", order: 1 },
    ],
  };
  expect(compareSceneVersions(before, after).changes).toContain(
    "Reference associations",
  );
});
it("does not duplicate original-source associations through Edit a Copy and save", async () => {
  const image = await saveMediaAsset({
    filename: "original.png",
    mimeType: "image/png",
    blob: new Blob(["image"], { type: "image/png" }),
  });
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Direct",
    shotType: "graphic_motion",
    directPrompt: { version: 1, text: "Animate the original." },
    sourceMediaLinks: [
      {
        mediaId: image.id,
        role: "reference",
        altText: "Original source",
        mimeType: image.mimeType,
        order: 0,
      },
    ],
  });
  const first = await final(draft, "copy-source"),
    copy = await createDraftFromSavedScene(first.id);
  const second = await saveAuthoredScene(copy.id, {
    requestId: "copy-save",
    expectedInputRevision: copy.inputRevision,
    allowDuplicate: true,
  });
  expect(second.references).toEqual(first.references);
});
it("rejects a managed recipe save against the caller expected draft revision", async () => {
  const first = await saveSceneFromDraft((await recipe()).id),
    draft = await createSceneRevisionDraft(first.id);
  await saveSceneDraft({
    ...draft,
    sceneInstructions: "Another tab changed this.",
  });
  await expect(
    saveSceneFromDraft(draft.id, {
      requestId: "stale-recipe",
      ...{ expectedInputRevision: draft.inputRevision },
    }),
  ).rejects.toThrow(/stale|changed/i);
});
it("keeps the caller project revision bound across the managed recipe adapter", async () => {
  const first = await saveSceneFromDraft((await recipe()).id),
    c = await createCollection({ name: "MIDORI" }),
    project = await addProjectShot({
      collectionId: c.id,
      title: "05",
      sceneId: first.id,
    });
  const draft = await createSceneRevisionDraft(first.id);
  await addProjectShot({ collectionId: c.id, title: "Another tab" });
  await expect(
    saveSceneFromDraft(draft.id, {
      requestId: "stale-project",
      projectTarget: {
        collectionId: c.id,
        shotId: project.project!.shots[0].id,
      },
      ...{
        expectedInputRevision: draft.inputRevision,
        expectedProjectRevision: project.project!.revision,
      },
    }),
  ).rejects.toThrow(/project.*changed|revision/i);
});
it("returns the same managed recipe scene on a successful targeted retry", async () => {
  const first = await saveSceneFromDraft((await recipe()).id),
    c = await createCollection({ name: "MIDORI" }),
    p = await addProjectShot({
      collectionId: c.id,
      title: "05",
      sceneId: first.id,
    });
  const target = {
    collectionId: c.id,
    shotId: p.project!.shots[0].id,
    expectedProjectRevision: p.project!.revision,
  };
  const draft = await createSceneRevisionDraft(first.id, { target });
  const options = {
    requestId: "managed-retry",
    projectTarget: { collectionId: c.id, shotId: target.shotId },
    expectedInputRevision: draft.inputRevision,
    expectedProjectRevision: target.expectedProjectRevision,
  };
  const saved = await saveSceneFromDraft(draft.id, options);
  expect(await saveSceneFromDraft(draft.id, options)).toEqual(saved);
  expect(
    (await getAllSnapshot()).collections[0].project!.shots[0].takeSceneIds,
  ).toHaveLength(2);
});
it("uses explicit project navigation instead of historical save provenance for shared scenes", async () => {
  const c = await createCollection({ name: "Original Project" }),
    p = await addProjectShot({ collectionId: c.id, title: "A" });
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "Shared prompt",
    directPrompt: { version: 1, text: "Complete prompt." },
  });
  const scene = await saveAuthoredScene(draft.id, {
    requestId: "captured-A",
    expectedInputRevision: draft.inputRevision,
    target: {
      collectionId: c.id,
      shotId: p.project!.shots[0].id,
      expectedProjectRevision: p.project!.revision,
    },
  });
  const b = await createCollection({ name: "Explicit Project" }),
    other = await addProjectShot({
      collectionId: b.id,
      title: "B",
      sceneId: scene.id,
    });
  window.location.hash = `#/output/${scene.id}?collection=${b.id}&shot=${other.project!.shots[0].id}`;
  const Harness = () => {
    const { loading } = useLibrary();
    return loading ? null : <DirectPromptWorkspace id={scene.id} preview />;
  };
  const user = userEvent.setup();
  render(
    <LibraryProvider>
      <Harness />
    </LibraryProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Edit as New Version" }),
  );
  await waitFor(async () => {
    const drafts = (await getAllSnapshot()).drafts.filter(
      (d) => d.revisionIntent,
    );
    expect(drafts.at(-1)?.authoredProjectTarget?.collectionId).toBe(b.id);
  });
});
