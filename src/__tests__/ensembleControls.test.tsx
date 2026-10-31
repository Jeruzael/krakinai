import React, { useState } from "react";
import { it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SceneDraft } from "../types/domain";
import { EnsembleControls } from "../components/EnsembleControls";
import { EnsembleTemplateChoice } from "../components/EnsembleTemplateChoice";
import { ensembleDraft, ensembleLegacyDraft } from "./fixtures/ensembleFixture";
import { ensembleState } from "./fixtures/ensemblePlanningFixture";
import { syncEnsemblePrimary } from "../domain/ensemble";

function setup(initial: SceneDraft = ensembleDraft()) {
  const changed = vi.fn();
  let current = initial;
  const state = ensembleState();
  function Harness() {
    const [draft, setDraft] = useState(initial);
    return (
      <EnsembleControls
        draft={draft}
        assets={state.assets}
        variants={state.variants ?? []}
        onChange={(next) => {
          changed(next);
          current = next;
          setDraft(next);
          return true;
        }}
      />
    );
  }
  render(<Harness />);
  return { changed, get: () => current, user: userEvent.setup() };
}
it("requires explicit opt-in and preserves the full legacy identity, Outfit and exact dialogue once", async () => {
  const old = ensembleLegacyDraft(),
    h = setup(old);
  expect(h.changed).not.toHaveBeenCalled();
  await h.user.click(
    screen.getByRole("button", { name: "Enable participants & ordered cues" }),
  );
  expect(h.changed).not.toHaveBeenCalled();
  await h.user.click(
    screen.getByRole("button", { name: "Enable for this draft" }),
  );
  expect(h.get().ensemble?.participants[0].character).toEqual(
    old.slots.character,
  );
  expect(h.get().ensemble?.participants[0].wardrobe).toEqual(
    old.slots.wardrobe,
  );
  expect(h.get().ensemble?.dialogueCues[0].line).toBe(old.dialogue!.line);
  expect(h.get().dialogue).toBeUndefined();
  expect(old.ensemble).toBeUndefined();
  expect(
    screen.queryByRole("button", {
      name: "Enable participants & ordered cues",
    }),
  ).toBeNull();
  expect(h.changed).toHaveBeenCalledTimes(1);
});
it("keeps identities collapsed and locked and restores keyboard focus when a participant dialog closes", async () => {
  const h = setup(),
    trigger = screen.getByRole("button", { name: "Participants (2)" });
  await h.user.click(trigger);
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  const details = screen.getByText("Full locked identity").closest("details")!;
  expect(details).not.toHaveAttribute("open");
  expect(
    within(details).getByRole("textbox", {
      name: "Locked identity",
      hidden: true,
    }),
  ).toHaveAttribute("readonly");
  await h.user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(trigger).toHaveFocus();
  expect(h.changed).not.toHaveBeenCalled();
});
it("binds only actual Characters and parent-compatible Outfits without switching identity implicitly", async () => {
  const h = setup();
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  await h.user.selectOptions(screen.getByLabelText("Character"), "marco");
  const clothing = screen.getByLabelText("Clothing / Outfit");
  expect(
    within(clothing).queryByRole("option", { name: /character Outfit/ }),
  ).toBeNull();
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    /Outfit.*parent|wardrobe.*parent/i,
  );
  expect(h.changed).not.toHaveBeenCalled();
  await h.user.selectOptions(clothing, "");
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(h.get().ensemble!.participants[1].character.sourceId).toBe("marco");
  expect(h.get().ensemble!.participants[1].wardrobe).toBeUndefined();
  expect(h.get().slots.character!.sourceId).toBe("character");
});
it("synchronizes an explicit primary choice without reordering cues or changing master snapshots", async () => {
  const h = setup(),
    before = structuredClone(h.get());
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  await h.user.selectOptions(
    screen.getByLabelText("Primary participant"),
    "lucas",
  );
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(h.get().slots.character).toEqual(
    before.ensemble!.participants[1].character,
  );
  expect(h.get().slots.wardrobe).toEqual(
    before.ensemble!.participants[1].wardrobe,
  );
  expect(h.get().ensemble!.dialogueCues).toEqual(before.ensemble!.dialogueCues);
});
it("refuses removal of a referenced participant and preserves the existing cues and draft", async () => {
  const h = setup(),
    before = structuredClone(h.get());
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Remove Lucas / Base Identity" }),
  );
  await h.user.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/cue|participant/i);
  expect(h.changed).not.toHaveBeenCalled();
  expect(h.get()).toEqual(before);
});
it("keeps cue bytes untouched when editing another field and explicitly reorders stable cue IDs", async () => {
  const h = setup(),
    line = h.get().ensemble!.dialogueCues[1].line;
  await h.user.click(screen.getByRole("button", { name: "Dialogue cues (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit cue lucas-reply" }),
  );
  await h.user.type(screen.getByLabelText("Language"), "Filipino");
  await h.user.click(screen.getByRole("button", { name: "Save cue" }));
  expect(h.get().ensemble!.dialogueCues[1].line).toBe(line);
  await h.user.click(
    screen.getByRole("button", { name: "Move cue lucas-reply up" }),
  );
  expect(h.get().ensemble!.dialogueCues.map((c) => c.id)).toEqual([
    "lucas-reply",
    "officiant",
  ]);
  expect(h.get().ensemble!.dialogueCues[0].line).toBe(line);
});
it("supports unlinked narration without fabricating a Character", async () => {
  const h = setup();
  await h.user.click(screen.getByRole("button", { name: "Dialogue cues (2)" }));
  await h.user.click(screen.getByRole("button", { name: "Add cue" }));
  await h.user.type(screen.getByLabelText("Speaker"), "Narrator");
  await h.user.type(
    screen.getByLabelText("Exact spoken line"),
    "  Before the wedding.  ",
  );
  await h.user.click(screen.getByRole("button", { name: "Save cue" }));
  expect(h.get().ensemble!.participants).toHaveLength(2);
  expect(h.get().ensemble!.dialogueCues[2]).toMatchObject({
    speaker: "Narrator",
    mode: "voiceover",
    line: "  Before the wedding.  ",
  });
  expect(h.get().ensemble!.dialogueCues[2].participantId).toBeUndefined();
});
it("requires an explicit full/shared template choice and shows exactly what shared-only omits", async () => {
  const d = ensembleDraft(),
    picked = vi.fn(),
    confirmed = vi.fn();
  const view = render(
    <EnsembleTemplateChoice
      ensemble={d.ensemble!}
      mode={undefined}
      confirmed={false}
      onMode={picked}
      onConfirm={confirmed}
    />,
  );
  const user = userEvent.setup();
  expect(screen.getByLabelText("Ensemble contents")).toHaveValue("");
  await user.selectOptions(screen.getByLabelText("Ensemble contents"), "full");
  expect(picked).toHaveBeenCalledWith("full");
  view.rerender(
    <EnsembleTemplateChoice
      ensemble={d.ensemble!}
      mode="shared_only"
      confirmed={false}
      onMode={picked}
      onConfirm={confirmed}
    />,
  );
  expect(
    screen.getByText(
      /2 participants, 2 per-person clothing selections and 2 dialogue cues/,
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("list", { name: "Omitted participants and clothing" }),
  ).toHaveTextContent("Lucas / Base Identity");
  expect(
    screen.getByRole("list", { name: "Omitted participants and clothing" }),
  ).toHaveTextContent("Lucas suit");
  await user.click(
    screen.getByLabelText("I acknowledge these ensemble omissions"),
  );
  expect(confirmed).toHaveBeenCalledWith(true);
});
it("requires explicit cue correction before moving a speaking person off camera", async () => {
  const h = setup();
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  await h.user.selectOptions(screen.getByLabelText("Presence"), "off_camera");
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/on-camera speech/i);
  expect(h.changed).not.toHaveBeenCalled();
  await h.user.keyboard("{Escape}");
  await h.user.click(screen.getByRole("button", { name: "Dialogue cues (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit cue lucas-reply" }),
  );
  await h.user.selectOptions(
    screen.getByLabelText("Dialogue mode"),
    "off_screen",
  );
  await h.user.click(screen.getByRole("button", { name: "Save cue" }));
  await h.user.keyboard("{Escape}");
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  await h.user.selectOptions(screen.getByLabelText("Presence"), "off_camera");
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(h.get().ensemble!.participants[1].presence).toBe("off_camera");
  expect(h.get().ensemble!.dialogueCues[1]).toMatchObject({
    id: "lucas-reply",
    participantId: "lucas",
    mode: "off_screen",
  });
  expect(h.get().slots.character!.sourceId).toBe("character");
});
it("falls back to the unchanged master when an approved anchor is unavailable", async () => {
  const h = setup(),
    master = h.get().ensemble!.participants[1].character.promptText;
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  await h.user.selectOptions(
    screen.getByLabelText("Generation identity"),
    "approved_anchor",
  );
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(h.get().ensemble!.participants[1].generation).toMatchObject({
    identitySource: "master",
    fallbackReason: expect.any(String),
  });
  expect(h.get().ensemble!.participants[1].character.promptText).toBe(master);
  await h.user.click(
    screen.getByRole("button", { name: "Edit Lucas / Base Identity" }),
  );
  expect(
    screen.getByText(/selected identity anchor has no valid approval/i),
  ).toBeVisible();
});
it("preserves an unbound template identity without guessing a Character ID", async () => {
  const draft = ensembleDraft(),
    p = draft.ensemble!.participants[0];
  p.character = {
    ...p.character,
    sourceType: "template",
    sourceId: "frozen-template",
  };
  delete p.wardrobe;
  const h = setup(syncEnsemblePrimary(draft)),
    identity = structuredClone(p.character);
  await h.user.click(screen.getByRole("button", { name: "Participants (2)" }));
  await h.user.click(
    screen.getByRole("button", { name: "Edit Aya / Base Identity" }),
  );
  expect(
    screen.getByText(/has no inferred Character ID or Character Bible/),
  ).toBeVisible();
  await h.user.click(screen.getByRole("button", { name: "Save participant" }));
  expect(h.get().ensemble!.participants[0].character).toEqual(identity);
  expect(h.get().slots.character!.sourceType).toBe("template");
});
it("enforces the 8-person and 32-cue UI bounds without changing stored content", async () => {
  const draft = ensembleDraft();
  for (let i = 2; i < 8; i++)
    draft.ensemble!.participants.push({
      id: `extra-${i}`,
      presence: "on_camera",
      character: {
        ...draft.ensemble!.participants[0].character,
        sourceId: `synthetic-${i}`,
        sourceTitle: `Synthetic ${i}`,
      },
    });
  draft.ensemble!.dialogueCues = Array.from({ length: 32 }, (_, i) => ({
    id: `cue-${i}`,
    speaker: "Narrator",
    line: `Exact ${i}`,
    mode: "voiceover",
  }));
  const h = setup(draft);
  await h.user.click(screen.getByRole("button", { name: "Participants (8)" }));
  expect(
    screen.getByRole("button", { name: "Add participant" }),
  ).toBeDisabled();
  await h.user.keyboard("{Escape}");
  await h.user.click(
    screen.getByRole("button", { name: "Dialogue cues (32)" }),
  );
  expect(screen.getByRole("button", { name: "Add cue" })).toBeDisabled();
  expect(h.changed).not.toHaveBeenCalled();
});
