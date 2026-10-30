import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryProvider } from "../context/LibraryContext";
import { ChangeSetImportScreen } from "../screens/ChangeSetImportScreen";
import {
  initializeDatabase,
  clearAllStoresForTesting,
  getAllSnapshot,
  openDatabase,
} from "../storage/db";
import { midoriChangeSet, syntheticCamera } from "./fixtures/changeSetFixture";
import {
  previewChangeSet,
  applyApprovedChangeSet,
} from "../storage/changeSets";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(syntheticCamera());
    tx.oncomplete = () => resolve();
  });
  window.location.hash = "/imports/ai";
});
const setup = async () => {
  render(
    <LibraryProvider>
      <ChangeSetImportScreen />
    </LibraryProvider>,
  );
  await screen.findByRole("heading", { name: "Import AI Change Set" });
};
it("shows the complete deferred candidate prompt and metadata before a later create approval", async () => {
  const input = {
      schema: "krakinai.change-set.v1" as const,
      changeSetId: "defer-detail",
      source: { kind: "manual" as const },
      operations: [
        {
          operationId: "proposal",
          type: "asset.propose" as const,
          clientRef: "proposal",
          kind: "lighting" as const,
          title: "Deferred synthetic lighting",
          promptText: "Exact deferred lighting body.",
          description: "A private local candidate description.",
          tags: ["synthetic"],
          notes: "Review this exact note before creation.",
        },
      ],
    },
    p = await previewChangeSet(input);
  await applyApprovedChangeSet(p, p.approvedDigest);
  const before = await getAllSnapshot(),
    user = userEvent.setup();
  await setup();
  await user.click(
    screen.getByText("Pending library candidates (1)", { exact: true }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "Review candidate Deferred synthetic lighting",
    }),
  );
  await screen.findByRole("heading", { name: "Change-set preview" });
  await user.click(screen.getByText("Reusable candidates", { exact: false }));
  await user.click(
    screen.getByRole("button", {
      name: "Review review-candidate",
    }),
  );
  expect(
    screen.getByRole("textbox", {
      name: "Proposed prompt review-candidate",
    }),
  ).toHaveValue(input.operations[0].promptText);
  await user.click(
    screen.getByText("Resolved record and media metadata", { exact: true }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    input.operations[0].description,
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    input.operations[0].notes,
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("previews and cancels without writes; imported text remains literal", async () => {
  const before = await getAllSnapshot(),
    user = userEvent.setup();
  await setup();
  const input = midoriChangeSet();
  input.title = "<script>literal title</script>";
  fireEvent.change(screen.getByLabelText("Change-set JSON", { exact: true }), {
    target: { value: JSON.stringify(input) },
  });
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await screen.findByRole("heading", { name: "Change-set preview" });
  expect(
    screen.getByText("<script>literal title</script>", { exact: true }),
  ).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
  expect(await getAllSnapshot()).toEqual(before);
  expect(
    screen.getByRole("button", { name: "Apply approved changes" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel preview" }));
  expect(await getAllSnapshot()).toEqual(before);
});
it("requires separate grants and review before atomic apply; replay shows the stored receipt", async () => {
  const user = userEvent.setup();
  await setup();
  const text = JSON.stringify(midoriChangeSet());
  fireEvent.change(screen.getByLabelText("Change-set JSON"), {
    target: { value: text },
  });
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await screen.findByRole("heading", { name: "Change-set preview" });
  await user.click(
    screen.getByLabelText("Approve storyboard changes", { exact: true }),
  );
  await user.click(
    screen.getByLabelText("Approve new immutable scenes", { exact: true }),
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("I reviewed this exact preview"),
    ).toBeEnabled(),
  );
  await user.click(screen.getByLabelText("I reviewed this exact preview"));
  await user.click(
    screen.getByRole("button", { name: "Apply approved changes" }),
  );
  await screen.findByRole("heading", { name: "Import receipt" });
  await waitFor(()=>expect(screen.queryByText(/Saving approved batch/)).not.toBeInTheDocument());
  const after = await getAllSnapshot();
  expect(after.scenes).toHaveLength(15);
  expect(after.assets).toHaveLength(1);
  expect(after.preferences.aiImports!.candidates).toHaveLength(2);
  await user.click(
    screen.getByRole("button", { name: "Import another package" }),
  );
  fireEvent.change(screen.getByLabelText("Change-set JSON"), {
    target: { value: text },
  });
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await screen.findByText(/already applied/i);
  await waitFor(()=>expect(screen.queryByText(/Validating current targets/)).not.toBeInTheDocument());
  expect(await getAllSnapshot()).toEqual(after);
});
it("rejects an oversized file before reading its contents", async () => {
  await setup();
  const text = vi.fn();
  fireEvent.change(screen.getByLabelText("Choose change-set JSON file"), {
    target: {
      files: [{ size: 20 * 1024 * 1024 + 1, name: "large.json", text }],
    },
  });
  await screen.findByRole("alert");
  expect(text).not.toHaveBeenCalled();
  expect((await getAllSnapshot()).preferences.aiImports).toBeUndefined();
});
it("reports a committed batch accurately even if refreshing the library view then fails", async () => {
  const dbModule = await import("../storage/db"),
    actual = dbModule.getAllSnapshot,
    user = userEvent.setup();
  const spy = vi
    .spyOn(dbModule, "getAllSnapshot")
    .mockImplementation(async () => {
      const value = await actual();
      if (value.preferences.aiImports?.receipts.length)
        throw new Error("Synthetic refresh failed");
      return value;
    });
  await setup();
  fireEvent.change(screen.getByLabelText("Change-set JSON"), {
    target: { value: JSON.stringify(midoriChangeSet()) },
  });
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await screen.findByRole("heading", { name: "Change-set preview" });
  await user.click(screen.getByLabelText("Approve storyboard changes"));
  await user.click(screen.getByLabelText("Approve new immutable scenes"));
  await waitFor(() =>
    expect(
      screen.getByLabelText("I reviewed this exact preview"),
    ).toBeEnabled(),
  );
  await user.click(screen.getByLabelText("I reviewed this exact preview"));
  await user.click(
    screen.getByRole("button", { name: "Apply approved changes" }),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent(
    /committed|saved.*refresh/i,
  );
  expect(screen.getByRole("heading", { name: "Import receipt" })).toBeVisible();
  expect((await actual()).scenes).toHaveLength(15);
  spy.mockRestore();
});
