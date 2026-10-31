import React, { useState } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeSetPreview } from "../components/ChangeSetPreview";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
  getAllSnapshot,
} from "../storage/db";
import {
  recipeState,
  recipeChangeSet,
  recipeApproval,
} from "./fixtures/recipeChangeSetFixture";
import type { ChangeSetApproval } from "../types/changeSet";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const state = recipeState(),
    db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["assets", "collections"], "readwrite");
    state.assets.forEach((a) => tx.objectStore("assets").put(a));
    state.collections.forEach((c) => tx.objectStore("collections").put(c));
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
});
afterEach(() => vi.restoreAllMocks());
async function setup(
  input: any = recipeChangeSet(),
  approval: ChangeSetApproval = recipeApproval(),
) {
  const p = await previewChangeSet(input, approval),
    snapshot = await getAllSnapshot();
  function Harness() {
    const [preview, setPreview] = useState(p);
    return (
      <ChangeSetPreview
        preview={preview}
        snapshot={snapshot}
        disabled={false}
        onApproval={async (value) =>
          setPreview(await previewChangeSet(input, value))
        }
      />
    );
  }
  render(<Harness />);
  return p;
}
it("shows actual resolved IDs/revisions while component prompt details stay collapsed", async () => {
  const user = userEvent.setup(),
    p = await setup(),
    before = await getAllSnapshot();
  await user.click(screen.getByRole("button", { name: "Review recipe" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("table", { name: "Resolved recipe components" }),
  ).toHaveTextContent("Synthetic Courtyard");
  expect(dialog).toHaveTextContent("environment");
  expect(dialog).toHaveTextContent("rev 2");
  const summary = within(dialog).getByText("Environment prompt details", {
    exact: true,
  });
  expect(summary.closest("details")).not.toHaveAttribute("open");
  await user.click(summary);
  expect(
    within(dialog).getByRole("textbox", { name: "Environment base prompt" }),
  ).toHaveValue("A quiet enclosed courtyard.");
  expect(
    within(dialog).getByRole("textbox", { name: "Recipe Full output recipe" }),
  ).toHaveValue(p.plan.scenes[0].outputs.full);
  expect(await getAllSnapshot()).toEqual(before);
});
it("provides roving keyboard output tabs and copies complete untruncated text", async () => {
  const user = userEvent.setup(),
    input: any = recipeChangeSet();
  let clipboardText = "";
  // The suite uses Node Blob for IndexedDB binary integrity. Stub this external
  // API boundary rather than user-event's incompatible JSDOM FileReader shim.
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
    async (text) => {
      clipboardText = text;
    },
  );
  input.operations[0].sceneInstructions =
    "Keep this exact line.\r\n".repeat(150) + "UNIQUE END OF COMPLETE PROMPT";
  const p = await setup(input);
  await user.click(screen.getByRole("button", { name: "Review recipe" }));
  for (const tab of screen.getAllByRole("tab"))
    expect(
      document.getElementById(tab.getAttribute("aria-controls")!),
    ).not.toBeNull();
  const full = screen.getByRole("tab", { name: "Full" });
  await user.click(full);
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Structured" })).toHaveFocus();
  expect(
    screen.getByRole("textbox", { name: "Recipe Structured output recipe" }),
  ).toHaveValue(p.plan.scenes[0].outputs.structured!.replace(/\r\n/g, "\n"));
  await user.click(
    screen.getByRole("button", { name: "Copy Structured recipe" }),
  );
  expect(clipboardText).toBe(p.plan.scenes[0].outputs.structured);
  await user.keyboard("{End}");
  await user.click(screen.getByRole("tab", { name: "Compact" }));
  await user.click(screen.getByRole("button", { name: "Copy Compact recipe" }));
  expect(clipboardText).toBe(p.plan.scenes[0].outputs.compact);
  expect(clipboardText).toContain("UNIQUE END OF COMPLETE PROMPT");
});
it("downloads a complete blocked planning package and never claims an assembled or saved scene", async () => {
  const user = userEvent.setup(),
    input: any = recipeChangeSet();
  delete input.operations[0].assetRefs;
  const before = await getAllSnapshot();
  await setup(input);
  let downloaded: Blob | undefined;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      downloaded = blob;
      return "blob:synthetic-recipe-package";
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await user.click(
    screen.getByRole("button", { name: "Download recipe package (JSON)" }),
  );
  expect(JSON.parse(await downloaded!.text())).toEqual(input);
  expect(await getAllSnapshot()).toEqual(before);
  await user.click(screen.getByRole("button", { name: "Review recipe" }));
  expect(screen.getByRole("dialog")).toHaveTextContent(
    /not assembled|assembly blocked/i,
  );
  expect(
    screen.queryByRole("tablist", { name: "Recipe assembled outputs" }),
  ).not.toBeInTheDocument();
});
it("shows manual output changes and requires a separate explicit reassembly acknowledgement", async () => {
  const initial = await previewChangeSet(recipeChangeSet(), recipeApproval());
  await applyApprovedChangeSet(initial, initial.approvedDigest);
  const state = await getAllSnapshot(),
    parent = state.scenes[0];
  parent.manualOutputs = {
    full: {
      text: "Frozen manual words.",
      basedOnInputRevision: 1,
      updatedAt: "2026-10-31T00:00:00.000Z",
    },
  };
  parent.outputs.full = "Frozen manual words.";
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("scenes", "readwrite");
    tx.objectStore("scenes").put(parent);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  const input: any = recipeChangeSet();
  input.changeSetId = "synthetic-manual-review";
  input.operations = [
    {
      operationId: "revision",
      type: "scene.revise_recipe",
      clientRef: "revision",
      sceneId: parent.id,
      expectedHeadId: parent.id,
      project: { id: "project", expectedRevision: 2 },
      shot: { id: "shot" },
      sceneInstructions: "Reassemble using these instructions.",
    },
  ];
  const user = userEvent.setup();
  await setup(input);
  const consent = screen.getByRole("checkbox", {
    name: "Discard manual output overrides and reassemble (revision)",
  });
  expect(consent).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Review revision" }));
  expect(
    screen.getByRole("textbox", { name: "Existing prompt revision" }),
  ).toHaveValue("Frozen manual words.");
  expect(
    screen.getByRole("textbox", { name: "Recipe Full output revision" }),
  ).not.toHaveValue("Frozen manual words.");
  await user.click(screen.getByRole("button", { name: "Close operation" }));
  await user.click(consent);
  await waitFor(() => expect(consent).toBeChecked());
  expect((await getAllSnapshot()).scenes[0].outputs.full).toBe(
    "Frozen manual words.",
  );
});
