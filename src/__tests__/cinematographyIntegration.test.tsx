import React from "react";
import { beforeEach, afterEach, it, expect } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { LibraryProvider, useLibrary } from "../context/LibraryContext";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  loadStarterLibrary,
  getAllSnapshot,
  saveSceneDraft,
  replaceAllStoresTransactionally,
} from "../storage/db";
import { createSnapshotFromAsset } from "../domain/promptAssembler";
import { applyCameraComposition } from "../domain/cameraComposition";
import { searchCinematography } from "../domain/cinematographyRegistry";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  await loadStarterLibrary();
});
afterEach(cleanup);
async function seed() {
  const snapshot = await getAllSnapshot(),
    slots = Object.fromEntries(
      ["environments", "camera", "lighting", "styles"].map((category) => {
        const s = createSnapshotFromAsset(
          snapshot.assets.find((a) => a.category === category)!,
        );
        return [s.slot, s];
      }),
    );
  const draft = await saveSceneDraft({
    title: "Synthetic Camera integration",
    shotType: "property_environment",
    slots,
    extraRequiredSlots: [],
    sceneInstructions: "Preserve this authored instruction.",
    settings: { durationSeconds: 5 },
    manualOutputs: {},
    resultMediaLinks: [],
    reviewNotes: "Keep review notes.",
    reviewStatus: "unreviewed",
  });
  return { snapshot, draft };
}
it("previews and updates the same fallback draft when imported preferences have no active draft ID", async () => {
  const user = userEvent.setup(),
    { draft } = await seed();
  await saveSceneDraft({
    ...draft,
    shotType: "graphic_motion",
    slots: {
      ...draft.slots,
      camera: {
        ...draft.slots.camera!,
        overrideText: "Original source-locked Camera baseline.",
      },
    },
  });
  const snapshot = await getAllSnapshot();
  await replaceAllStoresTransactionally({
    ...snapshot,
    preferences: { ...snapshot.preferences, activeDraftId: undefined },
  });
  const before = await getAllSnapshot();
  window.location.hash = "#/library/camera?view=techniques";
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Compose Camera directions" }),
  );
  const dialog = screen.getByRole("dialog", {
    name: "Compose Camera directions",
  });
  expect(
    within(dialog).getByRole("region", {
      name: "Complete Camera text preview",
    }),
  ).toHaveTextContent("Original source-locked Camera baseline.");
  expect(
    within(dialog).queryByLabelText("Physical camera height"),
  ).not.toBeInTheDocument();
  await user.selectOptions(
    within(dialog).getByLabelText("Source-based graphics"),
    searchCinematography("2D zoom")[0].id,
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Apply Camera directions" }),
  );
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).drafts[0].slots.camera?.overrideText,
    ).toContain("Original source-locked Camera baseline."),
  );
  const after = await getAllSnapshot();
  expect(after.drafts).toHaveLength(1);
  expect(after.assets).toEqual(before.assets);
  expect(after.drafts[0].slots.lighting).toEqual(
    before.drafts[0].slots.lighting,
  );
  expect(after.drafts[0].slots.style).toEqual(before.drafts[0].slots.style);
});
it("uses the Cinematography label on Home and Camera variants while legacy output wording remains separate", async () => {
  const user = userEvent.setup(),
    before = await getAllSnapshot();
  window.location.hash = "#/";
  render(<App />);
  await screen.findByText("Your reusable video creation toolkit.", {
    exact: true,
  });
  expect(
    screen.queryByText("Camera & Movement", { exact: true }),
  ).not.toBeInTheDocument();
  const variant = before.variants.find((v) => v.type === "Camera Angle")!;
  const character = before.assets.find(
    (a) => a.id === variant.parentCharacterId,
  )!;
  cleanup();
  window.location.hash = `#/characters/${character.id}/variants`;
  render(<App />);
  await screen.findByRole("heading", { name: variant.title });
  expect(
    screen.queryByText("Camera & Movement", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText("Camera & Cinematography", { exact: true }).length,
  ).toBeGreaterThan(1);
});
it("keeps Camera presets as the default and opens an explorer without automatic library writes", async () => {
  const user = userEvent.setup();
  await seed();
  const before = await getAllSnapshot();
  window.location.hash = "#/library/camera";
  render(<App />);
  const tab = await screen.findByRole("tab", { name: "Technique explorer" });
  await user.click(tab);
  expect(
    await screen.findByLabelText("Search cinematography techniques"),
  ).toBeVisible();
  expect(await getAllSnapshot()).toEqual(before);
  await user.click(screen.getByRole("tab", { name: "My Camera presets" }));
  expect(
    screen.getByRole("heading", { name: "Close-up Slow Push-in" }),
  ).toBeInTheDocument();
});
it("applies and resets Camera composition in the builder while preserving every other draft field", async () => {
  const user = userEvent.setup(),
    { draft } = await seed(),
    original = structuredClone(draft);
  window.location.hash = `#/builder/${draft.id}`;
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Compose Camera directions" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Shot size"),
    searchCinematography("MCU")[0].id,
  );
  await user.click(
    screen.getByRole("button", { name: "Apply Camera directions" }),
  );
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)?.slots
        .camera?.cameraComposition?.version,
    ).toBe(1),
  );
  let saved = (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)!;
  expect({
    ...saved,
    slots: { ...saved.slots, camera: original.slots.camera },
    inputRevision: original.inputRevision,
    updatedAt: original.updatedAt,
  }).toEqual(original);
  await user.click(
    screen.getByRole("button", { name: "Compose Camera directions" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Reset to Unspecified" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Apply Camera directions" }),
  );
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)?.slots
        .camera,
    ).toEqual(original.slots.camera),
  );
});
it("rebases existing structured controls when a different reusable Camera preset is applied", async () => {
  const user = userEvent.setup(),
    { draft, snapshot } = await seed(),
    composed = applyCameraComposition(draft.slots.camera, {
      version: 1,
      techniqueIds: [searchCinematography("Rule of thirds")[0].id],
    })!;
  await saveSceneDraft({
    ...draft,
    slots: { ...draft.slots, camera: composed },
  });
  const next = snapshot.assets.find(
    (a) => a.category === "camera" && a.id !== draft.slots.camera?.sourceId,
  )!;
  function Harness() {
    const { snapshot: loaded, applyAssetToScene } = useLibrary();
    return (
      <button
        disabled={!loaded}
        onClick={() => void applyAssetToScene(next, false)}
      >
        Choose new Camera preset
      </button>
    );
  }
  render(
    <LibraryProvider>
      <Harness />
    </LibraryProvider>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Choose new Camera preset" }),
    ).toBeEnabled(),
  );
  await user.click(
    screen.getByRole("button", { name: "Choose new Camera preset" }),
  );
  await waitFor(async () => {
    const saved = (await getAllSnapshot()).drafts.find(
      (d) => d.id === draft.id,
    )!;
    expect(saved.slots.camera?.sourceId).toBe(next.id);
    expect(saved.slots.camera?.cameraComposition?.version).toBe(1);
    expect(saved.slots.lighting).toEqual(draft.slots.lighting);
    expect(saved.slots.style).toEqual(draft.slots.style);
  });
});
