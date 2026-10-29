import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryProvider, useLibrary } from "../context/LibraryContext";
import { DirectPromptWorkspace } from "../components/DirectPromptWorkspace";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  getAllSnapshot,
} from "../storage/db";
import {
  createDirectPromptDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import {
  reconcilePromptEdit,
  replacePromptSelection,
} from "../domain/exactPromptText";
const exact =
  '  MIDORI\r\n\r\n“Dito tayo.” 😊 e\u0301\r\n{"negative":"No invented labels"}  ';
function Harness({ id, preview = false }: { id: string; preview?: boolean }) {
  const { loading, refreshSnapshot } = useLibrary();
  return loading ? (
    <p>Loading</p>
  ) : (
    <>
      <DirectPromptWorkspace id={id} preview={preview} />
      <button onClick={() => void refreshSnapshot()}>
        Refresh synthetic snapshot
      </button>
    </>
  );
}
const setup = async (preview = false, saved = false) => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "MIDORI",
    shotType: "property_environment",
    directPrompt: { version: 1, text: exact, origin: "chatgpt" },
  });
  const record = saved
    ? await saveAuthoredScene(draft.id, {
        requestId: "ui",
        expectedInputRevision: draft.inputRevision,
      })
    : draft;
  window.location.hash = `#/builder/${record.id}`;
  render(
    <LibraryProvider>
      <Harness id={record.id} preview={preview} />
    </LibraryProvider>,
  );
  await screen.findByRole("heading", {
    name: saved ? "MIDORI" : preview ? "Review Direct Prompt" : "Direct Prompt",
  });
  return { draft, record };
};
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("keeps CRLF around an ordinary textarea edit and pastes exact original text", () => {
  expect(reconcilePromptEdit("A\r\nB\r\nC", "A\nBee\nC")).toBe("A\r\nBee\r\nC");
  expect(replacePromptSelection("A\r\nB", 2, 3, "😊\r\nExact  ")).toBe(
    "A\r\n😊\r\nExact  ",
  );
});
it("edits and saves direct text without any component rows", async () => {
  const user = userEvent.setup();
  const { draft } = await setup();
  expect(screen.queryByText("Environment is required")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Complete Prompt" })).toHaveValue(
    exact.replace(/\r\n/g, "\n"),
  );
  await user.clear(screen.getByRole("textbox", { name: "Title" }));
  await user.type(
    screen.getByRole("textbox", { name: "Title" }),
    "Updated MIDORI",
  );
  await user.click(screen.getByRole("button", { name: "Save Draft" }));
  await waitFor(async () =>
    expect(
      (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)?.title,
    ).toBe("Updated MIDORI"),
  );
  expect(
    (await getAllSnapshot()).drafts.find((d) => d.id === draft.id)?.directPrompt
      ?.text,
  ).toBe(exact);
});
it("copies the full original rather than the visual preview and disables unavailable formats", async () => {
  const user = userEvent.setup();
  await setup(true, true);
  const copy = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  await user.click(
    screen.getByRole("button", { name: "Copy Original Prompt" }),
  );
  expect(copy).toHaveBeenCalledWith(exact);
  expect(screen.getByRole("button", { name: "Structured" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Compact" })).toBeDisabled();
  expect(
    screen.getByRole("region", { name: "Original prompt text" }).textContent,
  ).toBe(exact);
});
it("keeps the draft and input buffer when assembly/save fails", async () => {
  const user = userEvent.setup();
  const { draft } = await setup(true);
  await act(async () => {
    const fresh = (await getAllSnapshot()).drafts.find(
      (d) => d.id === draft.id,
    )!;
    await saveSceneDraft({ ...fresh, title: "Other tab" });
  });
  await user.click(
    screen.getByRole("button", { name: "Save Immutable Scene" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("region", { name: "Original prompt text" }).textContent,
  ).toBe(exact);
  expect((await getAllSnapshot()).scenes).toHaveLength(0);
});
it("refreshes a clean externally updated draft without overwriting dirty editor text", async () => {
  const user = userEvent.setup(),
    { draft } = await setup();
  await act(async () => {
    const fresh = (await getAllSnapshot()).drafts.find(
      (d) => d.id === draft.id,
    )!;
    await saveSceneDraft({
      ...fresh,
      directPrompt: { version: 1, text: "Externally prepared exact text." },
    });
  });
  await user.click(
    screen.getByRole("button", { name: "Refresh synthetic snapshot" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Complete Prompt" }),
    ).toHaveValue("Externally prepared exact text."),
  );
  await user.clear(screen.getByRole("textbox", { name: "Complete Prompt" }));
  await user.type(
    screen.getByRole("textbox", { name: "Complete Prompt" }),
    "Local unsaved buffer",
  );
  await act(async () => {
    const fresh = (await getAllSnapshot()).drafts.find(
      (d) => d.id === draft.id,
    )!;
    await saveSceneDraft({
      ...fresh,
      directPrompt: { version: 1, text: "Newer other-tab text." },
    });
  });
  await user.click(
    screen.getByRole("button", { name: "Refresh synthetic snapshot" }),
  );
  expect(screen.getByRole("textbox", { name: "Complete Prompt" })).toHaveValue(
    "Local unsaved buffer",
  );
});
