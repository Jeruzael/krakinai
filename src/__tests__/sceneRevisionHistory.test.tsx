import { beforeEach, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryProvider, useLibrary } from "../context/LibraryContext";
import { SceneRevisionActions } from "../components/SceneRevisionHistory";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  getAllSnapshot,
  createCollection,
} from "../storage/db";
import {
  createDirectPromptDraft,
  createSceneRevisionDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import { addProjectShot } from "../storage/projects";
import type { SavedScene } from "../types/domain";
function Harness({ scene }: { scene: SavedScene }) {
  const { loading } = useLibrary();
  return loading ? null : <SceneRevisionActions scene={scene} />;
}
const setup = async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "MIDORI 05",
    directPrompt: {
      version: 1,
      text: "  Slow physical tracking\n\nKeep exact architecture.  ",
    },
  });
  const first = await saveAuthoredScene(draft.id, {
    requestId: "one",
    expectedInputRevision: draft.inputRevision,
  });
  let next = await createSceneRevisionDraft(first.id);
  next = await saveSceneDraft({
    ...next,
    directPrompt: {
      version: 1,
      text: "  Stationary camera with subtle zoom\n\nKeep exact architecture.  ",
    },
    settings: { aspectRatio: "9:16", durationSeconds: 8 },
  });
  const second = await saveAuthoredScene(next.id, {
    requestId: "two",
    expectedInputRevision: next.inputRevision,
  });
  return { first, second };
};
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("opens Compare Versions with complete exact originals and metadata disclosure", async () => {
  const user = userEvent.setup(),
    { first, second } = await setup();
  render(
    <LibraryProvider>
      <Harness scene={second} />
    </LibraryProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "Compare Versions" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Revision History" });
  expect(
    within(dialog).getByRole("region", { name: "Previous prompt" }).textContent,
  ).toBe(first.outputs.full);
  expect(
    within(dialog).getByRole("region", { name: "Current prompt" }).textContent,
  ).toBe(second.outputs.full);
  expect(
    within(dialog).getByText(/Metadata changed: Aspect ratio, Duration/),
  ).toBeVisible();
});
it("restores as an editable new version, preserving both immutable scenes and preference", async () => {
  const user = userEvent.setup(),
    { first, second } = await setup();
  render(
    <LibraryProvider>
      <Harness scene={second} />
    </LibraryProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "View Revision History" }),
  );
  await user.click(
    screen.getAllByRole("button", { name: "Restore as New Version" })[0],
  );
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).drafts.some(
        (d) => d.revisionIntent?.restoredFromSceneId === first.id,
      ),
    ).toBe(true),
  );
  expect((await getAllSnapshot()).scenes).toEqual(
    expect.arrayContaining([first, second]),
  );
});
it("selects a preferred saved version only on explicit user action", async () => {
  const user = userEvent.setup(),
    { first, second } = await setup();
  const c = await createCollection({ name: "MIDORI" });
  const p = await addProjectShot({
    collectionId: c.id,
    title: "05",
    sceneId: first.id,
  });
  const { addProjectTake } = await import("../storage/projects");
  await addProjectTake({
    collectionId: c.id,
    shotId: p.project!.shots[0].id,
    sceneId: second.id,
  });
  render(
    <LibraryProvider>
      <Harness scene={second} />
    </LibraryProvider>,
  );
  await user.click(
    await screen.findByRole("button", { name: "View Revision History" }),
  );
  expect(
    (await getAllSnapshot()).collections[0].project!.shots[0].selectedSceneId,
  ).toBe(first.id);
  await user.click(
    screen.getByRole("button", { name: "Set as Preferred · MIDORI / 01" }),
  );
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).collections[0].project!.shots[0].selectedSceneId,
    ).toBe(second.id),
  );
});
