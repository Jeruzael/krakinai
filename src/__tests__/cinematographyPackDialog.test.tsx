import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CinematographyPackDialog } from "../components/CinematographyPackDialog";
import { CINEMATOGRAPHY_CORE_PRESETS as pack } from "../domain/cinematographyPresets";
import type { PromptAsset } from "../types/domain";
afterEach(cleanup);
const camera = (
  id: string,
  title: string,
  promptText: string,
): PromptAsset => ({
  id,
  title,
  promptText,
  category: "camera",
  tags: [],
  notes: "",
  description: "",
  mediaLinks: [],
  favorite: false,
  reviewStatus: "unreviewed",
  provenance: {},
  revision: 1,
  createdAt: "",
  updatedAt: "",
});
it("is a no-write preview with confirmation required before selected entries are installed", async () => {
  const user = userEvent.setup(),
    install = vi.fn(async () => ({
      added: [],
      skipped: [],
      beforeCount: 0,
      afterCount: 0,
    }));
  render(
    <CinematographyPackDialog
      assets={[]}
      onInstall={install}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("dialog", { name: "Review cinematography core pack" }),
  ).toBeInTheDocument();
  expect(install).not.toHaveBeenCalled();
  const button = screen.getByRole("button", {
    name: "Install selected missing presets",
  });
  expect(button).toBeDisabled();
  await user.click(
    screen.getByLabelText(
      "I reviewed the missing entries and want to add them without replacing existing records.",
    ),
  );
  await user.click(button);
  expect(install).toHaveBeenCalledWith(pack.map((p) => p.techniqueId));
});
it("disables existing equivalents and uncertain entries instead of offering to replace them", () => {
  const assets = [
    camera("custom", "My composition", "Use a rule of thirds composition."),
    camera("avoid", "No deep focus", "Never use deep focus."),
  ];
  render(
    <CinematographyPackDialog
      assets={assets}
      onInstall={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Install Rule of thirds")).toBeDisabled();
  expect(screen.getByLabelText("Install Deep focus")).toBeDisabled();
  expect(screen.getByText("ambiguous")).toBeInTheDocument();
});
it("retains the preview and an actionable error after an installation failure", async () => {
  const user = userEvent.setup();
  render(
    <CinematographyPackDialog
      assets={[]}
      onInstall={async () => {
        throw new Error("Synthetic transaction aborted");
      }}
      onClose={vi.fn()}
    />,
  );
  await user.click(
    screen.getByLabelText(
      "I reviewed the missing entries and want to add them without replacing existing records.",
    ),
  );
  await user.click(
    screen.getByRole("button", { name: "Install selected missing presets" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Synthetic transaction aborted",
    ),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
