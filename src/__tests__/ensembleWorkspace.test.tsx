import React from "react";
import { beforeEach, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  getAllSnapshot,
  saveSceneDraft,
} from "../storage/db";
import { writeRecord } from "./fixtures/ensembleStorageFixture";
import { ensembleDraft } from "./fixtures/ensembleFixture";
import { ensembleState } from "./fixtures/ensemblePlanningFixture";
import { createSnapshotFromAsset } from "../domain/promptAssembler";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
async function seed(route = "builder", anchor = false) {
  const s = ensembleState(),
    d = ensembleDraft();
  if (anchor) {
    const live = s.assets.find((a) => a.id === "lucas")!;
    live.identityAnchor = {
      text: "Approved synthetic Lucas anchor.",
      approvedText: "Approved synthetic Lucas anchor.",
      approvedAt: "2026-10-01T01:00:00.000Z",
      approvedMasterIdentityRevision: 1,
    };
    d.ensemble!.participants[1].character = createSnapshotFromAsset(live);
    d.ensemble!.participants[1].generation = {
      identitySource: "approved_anchor",
      anchor: {
        text: live.identityAnchor.text,
        approvedAt: live.identityAnchor.approvedAt!,
        approvedMasterIdentityRevision: 1,
      },
    };
  }
  for (const a of s.assets) await writeRecord("assets", a);
  for (const v of s.variants!) await writeRecord("variants", v);
  await writeRecord("drafts", d);
  window.location.hash = `#/${route}/${d.id}`;
  render(<App />);
  return { d, user: userEvent.setup() };
}
it("routes primary Character and Clothing actions to participant controls and never exposes legacy dialogue editing", async () => {
  const h = await seed();
  await screen.findByRole("button", { name: "Participants (2)" });
  expect(screen.getAllByTestId("recipe-row")).toHaveLength(7);
  expect(screen.queryByLabelText("Exact Dialogue Line")).toBeNull();
  await h.user.click(screen.getByRole("button", { name: "Change Character" }));
  expect(screen.getByRole("dialog", { name: "Participants" })).toBeVisible();
  expect(screen.getByLabelText("Character")).toBeInTheDocument();
  await h.user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Change Character" }),
  ).toHaveFocus();
  expect((await getAllSnapshot()).drafts[0]).toEqual(h.d);
});
it("saves a full ensemble template only after explicitly selecting its contents", async () => {
  const h = await seed();
  await screen.findByRole("button", { name: "Participants (2)" });
  await h.user.click(screen.getByRole("button", { name: "Save as Template" }));
  const modal = screen.getByRole("dialog");
  await h.user.clear(within(modal).getByLabelText("Template Name *"));
  await h.user.type(
    within(modal).getByLabelText("Template Name *"),
    "Synthetic complete ensemble",
  );
  expect(
    within(modal).getByRole("button", { name: "Save Template" }),
  ).toBeDisabled();
  await h.user.selectOptions(
    within(modal).getByLabelText("Ensemble contents"),
    "full",
  );
  await h.user.click(
    within(modal).getByRole("button", { name: "Save Template" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const saved = (await getAllSnapshot()).templates.find(
    (t) => t.name === "Synthetic complete ensemble",
  )!;
  expect(saved.ensembleDefault!.ensemble).toEqual(h.d.ensemble);
  expect(saved.defaults.character).toBeUndefined();
});
it("uses a secondary approved anchor in actual Generation JSON while retaining full master identity in canonical output", async () => {
  const h = await seed("output", true);
  await screen.findByLabelText("Target Workflow");
  await h.user.selectOptions(
    screen.getByLabelText("Target Workflow"),
    "generation_json",
  );
  await h.user.click(screen.getByRole("button", { name: "Show Prompt" }));
  const json = JSON.parse(
    screen.getByRole("region", { name: "Complete prompt text" }).textContent!,
  );
  expect(json.participants.find((p: any) => p.id === "lucas").identity).toEqual(
    {
      source: "approved_anchor",
      description: "Approved synthetic Lucas anchor.",
    },
  );
  expect(json.dialogueCues[1].exactLine).toBe(
    h.d.ensemble!.dialogueCues[1].line,
  );
  await h.user.keyboard("{Escape}");
  await h.user.selectOptions(
    screen.getByLabelText("Target Workflow"),
    "canonical",
  );
  await h.user.click(screen.getByRole("button", { name: "Show Prompt" }));
  expect(
    screen.getByRole("region", { name: "Complete prompt text" }),
  ).toHaveTextContent(
    h.d.ensemble!.participants[1].character.promptText.trim(),
  );
  expect(
    screen.getByRole("region", { name: "Complete prompt text" }),
  ).not.toHaveTextContent("Approved synthetic Lucas anchor.");
});
it("requires acknowledgement before omitting the whole ensemble from a shared template", async () => {
  const h = await seed();
  await screen.findByRole("button", { name: "Participants (2)" });
  await h.user.click(screen.getByRole("button", { name: "Save as Template" }));
  const modal = screen.getByRole("dialog");
  await h.user.clear(within(modal).getByLabelText("Template Name *"));
  await h.user.type(
    within(modal).getByLabelText("Template Name *"),
    "Synthetic shared only",
  );
  await h.user.selectOptions(
    within(modal).getByLabelText("Ensemble contents"),
    "shared_only",
  );
  expect(
    within(modal).getByRole("button", { name: "Save Template" }),
  ).toBeDisabled();
  expect(modal).toHaveTextContent(
    "2 participants, 2 per-person clothing selections and 2 dialogue cues",
  );
  await h.user.click(
    within(modal).getByLabelText("I acknowledge these ensemble omissions"),
  );
  await h.user.click(
    within(modal).getByRole("button", { name: "Save Template" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const s = await getAllSnapshot(),
    template = s.templates.find((t) => t.name === "Synthetic shared only")!;
  expect(template.ensembleDefault).toBeUndefined();
  expect(template.defaults.wardrobe).toBeUndefined();
  expect(template.includedCharacterSnapshot).toBeUndefined();
  expect(s.drafts[0]).toEqual(h.d);
});
it("clears participants and cues only through the existing explicit Reset Draft confirmation", async () => {
  const h = await seed();
  await screen.findByRole("button", { name: "Participants (2)" });
  const reset = screen.getByRole("button", {
    name: "Reset Draft",
    hidden: true,
  });
  await h.user.click(reset.closest("details")!.querySelector("summary")!);
  await h.user.click(reset);
  const modal = screen.getByRole("dialog");
  expect(modal).toHaveTextContent("all participants, clothing, ordered cues");
  expect((await getAllSnapshot()).drafts[0]).toEqual(h.d);
  await h.user.click(
    within(modal).getByRole("button", { name: "Reset Draft" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Participants (0)" }),
    ).toBeVisible(),
  );
  const s = await getAllSnapshot();
  expect(s.drafts[0].ensemble).toEqual({
    version: 1,
    participants: [],
    dialogueCues: [],
    primaryParticipantId: null,
  });
  expect(s.assets).toHaveLength(ensembleState().assets.length);
});
it("rejects a stale participant form while preserving its local edits and the newer stored draft", async () => {
  const h = await seed();
  await screen.findByRole("button", { name: "Participants (2)" });
  await h.user.click(screen.getByRole("button", { name: "Change Character" }));
  await h.user.type(screen.getByLabelText("Role"), "Unsaved local role");
  const newer = await saveSceneDraft({
    ...h.d,
    title: "Newer draft from another tab",
  });
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      /changed in another tab|compare before saving/i,
    ),
  );
  expect(screen.getByLabelText("Role")).toHaveValue("Unsaved local role");
  expect((await getAllSnapshot()).drafts[0]).toEqual(newer);
});
it("reports a rejected stale manual-output save while retaining the editor contents", async () => {
  const h = await seed("output");
  await screen.findByLabelText("Workspace Layout");
  await h.user.selectOptions(screen.getByLabelText("Workspace Layout"), "tabs");
  await h.user.click(screen.getByRole("tab", { name: "Tools" }));
  await h.user.click(screen.getByRole("button", { name: "Edit This Output" }));
  const editor = screen.getByLabelText("Manual prompt output");
  await h.user.clear(editor);
  await h.user.type(editor, "Unsaved local manual output");
  const newer = await saveSceneDraft({
    ...h.d,
    title: "Newer ensemble inputs",
  });
  await h.user.click(
    screen.getByRole("button", { name: "Save Manual Output Override" }),
  );
  await waitFor(() =>
    expect(screen.getByText(/draft changed in another tab/i)).toBeVisible(),
  );
  expect(editor).toHaveValue("Unsaved local manual output");
  expect((await getAllSnapshot()).drafts[0]).toEqual(newer);
});
