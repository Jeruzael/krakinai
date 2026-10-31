import React, { useState } from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeSetPreview } from "../components/ChangeSetPreview";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
import { LibraryProvider } from "../context/LibraryContext";
import { ChangeSetImportScreen } from "../screens/ChangeSetImportScreen";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  getAllSnapshot,
} from "../storage/db";
import { ensembleState } from "./fixtures/ensemblePlanningFixture";
import {
  ensembleChangeSet,
  outfitProposal,
} from "./fixtures/ensembleChangeSetFixture";
import { recipeApproval } from "./fixtures/recipeChangeSetFixture";
import { writeRecord } from "./fixtures/ensembleStorageFixture";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const s = ensembleState();
  for (const a of s.assets) await writeRecord("assets", a);
  for (const v of s.variants!) await writeRecord("variants", v);
  for (const c of s.collections) await writeRecord("collections", c);
});
afterEach(() => vi.restoreAllMocks());
async function setup(withOutfit = false) {
  const input = ensembleChangeSet();
  if (withOutfit) input.operations.unshift(outfitProposal());
  const p = await previewChangeSet(input, recipeApproval()),
    snapshot = await getAllSnapshot();
  function Harness() {
    const [preview, setPreview] = useState(p);
    return (
      <ChangeSetPreview
        preview={preview}
        snapshot={snapshot}
        disabled={false}
        onApproval={async (approval) =>
          setPreview(await previewChangeSet(input, approval))
        }
      />
    );
  }
  render(<Harness />);
  return { p, snapshot, user: userEvent.setup() };
}
it("shows individual frozen participants, clothing, presence and ordered cues with locked identities collapsed", async () => {
  const h = await setup();
  await h.user.click(screen.getByRole("button", { name: "Review ensemble" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("region", {
      name: "Ensemble participants and cues",
    }),
  ).toHaveTextContent("Aya / Base Identity");
  expect(dialog).toHaveTextContent("Lucas / Base Identity");
  expect(dialog).toHaveTextContent("officiant");
  expect(dialog).toHaveTextContent("lucas-reply");
  expect(
    within(dialog)
      .getByText("Lucas / Base Identity locked identity")
      .closest("details"),
  ).not.toHaveAttribute("open");
  expect(await getAllSnapshot()).toEqual(h.snapshot);
});
it("copies all three complete ensemble outputs with exact cue line endings and no preview writes", async () => {
  const h = await setup(),
    writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  await h.user.click(screen.getByRole("button", { name: "Review ensemble" }));
  const outputs = (h.p.plan.operations[0].resolved as any).recipe.outputs;
  for (const mode of ["full", "structured", "compact"]) {
    await h.user.click(
      screen.getByRole("tab", { name: mode[0].toUpperCase() + mode.slice(1) }),
    );
    await h.user.click(
      screen.getByRole("button", {
        name: /^Copy (Full|Structured|Compact) recipe$/,
      }),
    );
    expect(writeText).toHaveBeenLastCalledWith(outputs[mode]);
    expect(outputs[mode]).toContain("  I do.\r\n😊  ");
  }
  expect(await getAllSnapshot()).toEqual(h.snapshot);
});
it("offers separate explicit Outfit create/reuse/defer decisions limited to the actual parent", async () => {
  const h = await setup(true);
  await h.user.click(screen.getByText("Outfit variant decisions (1)"));
  const decision = screen.getByLabelText("Outfit decision outfit");
  expect(decision).toHaveValue("defer");
  await h.user.selectOptions(decision, "reuse");
  const select = await screen.findByLabelText("Reuse Outfit outfit");
  expect(
    within(select).getByRole("option", { name: /character Outfit/ }),
  ).toBeInTheDocument();
  expect(
    within(select).queryByRole("option", { name: /lucas Outfit/ }),
  ).toBeNull();
  await h.user.selectOptions(select, "aya-outfit");
  await waitFor(() =>
    expect(
      screen.getByText("New Outfit variants").nextSibling,
    ).toHaveTextContent("0"),
  );
  expect(await getAllSnapshot()).toEqual(h.snapshot);
});
it("keeps a deferred Outfit accessible for a later typed review without writes on preview", async () => {
  const input = { ...ensembleChangeSet(), operations: [outfitProposal()] },
    p = await previewChangeSet(input, recipeApproval());
  await applyApprovedChangeSet(p, p.approvedDigest);
  const before = await getAllSnapshot();
  window.location.hash = "#/imports/ai";
  render(
    <LibraryProvider>
      <ChangeSetImportScreen />
    </LibraryProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByText("Pending library candidates (1)"));
  await user.click(
    screen.getByRole("button", {
      name: "Review candidate Synthetic formal outfit",
    }),
  );
  expect(
    await screen.findByText("Outfit variant decisions (1)"),
  ).toBeInTheDocument();
  expect(await getAllSnapshot()).toEqual(before);
});
