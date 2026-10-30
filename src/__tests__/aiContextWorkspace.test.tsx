import { beforeEach, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryProvider } from "../context/LibraryContext";
import { AiContextScreen } from "../screens/AiContextScreen";
import {
  initializeDatabase,
  clearAllStoresForTesting,
  createCollection,
  getAllSnapshot,
  openDatabase,
} from "../storage/db";
import { syntheticCamera } from "./fixtures/changeSetFixture";
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("defaults to selected project metadata, omits private notes and performs no writes", async () => {
  const c = await createCollection({
      name: "Selected project",
      description: "PRIVATE_DESCRIPTION",
    }),
    other = await createCollection({ name: "UNRELATED_PROJECT" });
  window.location.hash = `/context/ai?project=${c.id}`;
  const before = await getAllSnapshot();
  render(
    <LibraryProvider>
      <AiContextScreen />
    </LibraryProvider>,
  );
  const preview = await screen.findByRole("region", {
    name: "AI context JSON",
  });
  expect(preview.textContent).toContain(c.id);
  expect(preview.textContent).not.toContain("PRIVATE_DESCRIPTION");
  expect(preview.textContent).not.toContain(other.id);
  expect(await getAllSnapshot()).toEqual(before);
  await userEvent.click(
    screen.getByLabelText("Include notes and pending descriptions"),
  );
  await waitFor(() =>
    expect(preview.textContent).toContain("PRIVATE_DESCRIPTION"),
  );
  expect(await getAllSnapshot()).toEqual(before);
});
it("keeps character identity opt-in separate from ordinary asset prompt text", async () => {
  const a = {
    ...syntheticCamera(),
    id: "asset_character",
    category: "characters" as const,
    title: "Private Character",
    promptText: "PRIVATE_IDENTITY",
  };
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").add(a);
    tx.oncomplete = () => resolve();
  });
  window.location.hash = "/context/ai";
  render(
    <LibraryProvider>
      <AiContextScreen />
    </LibraryProvider>,
  );
  await screen.findByRole("heading", { name: "Export Context for AI" });
  await userEvent.click(screen.getByText(/Reusable assets/));
  await userEvent.click(
    screen.getByLabelText("Select asset Private Character"),
  );
  await userEvent.click(
    screen.getByLabelText("Include ordinary asset and template prompt text"),
  );
  expect(
    screen.getByRole("region", { name: "AI context JSON" }).textContent,
  ).not.toContain("PRIVATE_IDENTITY");
  await userEvent.click(
    screen.getByLabelText("Include selected character identity details"),
  );
  expect(
    screen.getByRole("region", { name: "AI context JSON" }).textContent,
  ).toContain("PRIVATE_IDENTITY");
});
