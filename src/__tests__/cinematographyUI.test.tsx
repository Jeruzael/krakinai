import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CinematographyExplorer } from "../components/CinematographyExplorer";
import { CameraComposer } from "../components/CameraComposer";
import { searchCinematography } from "../domain/cinematographyRegistry";
import { applyCameraComposition } from "../domain/cameraComposition";
import type { ComponentSnapshot, PromptAsset } from "../types/domain";
const camera: ComponentSnapshot = {
  slot: "camera",
  sourceType: "asset",
  sourceId: "existing_camera",
  sourceTitle: "Original Camera preset",
  sourceRevision: 1,
  promptText: "Original camera prompt stays available.",
  compactText: "Original compact.",
  mediaLinks: [],
  overrideText: "Keep my authored camera override.",
};
beforeEach(() => localStorage.removeItem("krakinai.cinematography.ui.v1"));
afterEach(cleanup);
describe("cinematography explorer", () => {
  it("starts with families collapsed and searches aliases without modifying records", async () => {
    const user = userEvent.setup(),
      compose = vi.fn();
    render(<CinematographyExplorer onCompose={compose} />);
    expect(
      screen.getByLabelText("Search cinematography techniques"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("Shot Size and Subject Scale", { selector: "summary" })
        .closest("details"),
    ).not.toHaveAttribute("open");
    await user.type(
      screen.getByLabelText("Search cinematography techniques"),
      "MCU",
    );
    expect(
      screen.getByRole("heading", { name: "Medium close-up (MCU)" }),
    ).toBeVisible();
    expect(compose).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", {
        name: "Compose with Medium close-up (MCU)",
      }),
    );
    expect(compose).toHaveBeenCalledWith(searchCinematography("MCU")[0].id);
  });
  it("filters source-based graphics and routes Lighting/Style concepts to their own category", async () => {
    const user = userEvent.setup(),
      browse = vi.fn();
    render(
      <CinematographyExplorer onCompose={vi.fn()} onBrowseOwner={browse} />,
    );
    await user.selectOptions(
      screen.getByLabelText("Filter by Shot Type"),
      "graphic_motion",
    );
    await user.type(
      screen.getByLabelText("Search cinematography techniques"),
      "Dolly in",
    );
    expect(
      screen.queryByRole("button", { name: /Compose with Dolly in/ }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search cinematography techniques"));
    await user.selectOptions(
      screen.getByLabelText("Filter by Shot Type"),
      "all",
    );
    await user.type(
      screen.getByLabelText("Search cinematography techniques"),
      "Three-point lighting",
    );
    await user.click(
      screen.getByRole("link", { name: "Browse Lighting & Mood" }),
    );
    expect(browse).toHaveBeenCalledWith("lighting");
  });
  it("supports deliberate favorite actions and a favorites filter with no automatic library writes", async () => {
    const user = userEvent.setup();
    render(<CinematographyExplorer onCompose={vi.fn()} />);
    await user.type(
      screen.getByLabelText("Search cinematography techniques"),
      "MCU",
    );
    await user.click(
      screen.getByRole("button", { name: "Favorite Medium close-up (MCU)" }),
    );
    expect(
      screen.getByRole("button", { name: "Unfavorite Medium close-up (MCU)" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.clear(screen.getByLabelText("Search cinematography techniques"));
    await user.click(screen.getByLabelText("Favorites only"));
    expect(
      screen.getByRole("heading", { name: "Medium close-up (MCU)" }),
    ).toBeVisible();
  });
});
it("reviews the original baseline rather than obsolete generated motion when a composition is reopened", async () => {
  const user = userEvent.setup(),
    neutral = {
      ...camera,
      promptText: "Observe the subject from the selected viewpoint.",
      overrideText: undefined,
    };
  const composed = applyCameraComposition(neutral, {
    version: 1,
    techniqueIds: [searchCinematography("Locked-off / static camera")[0].id],
  })!;
  render(
    <CameraComposer
      snapshot={composed}
      assets={[]}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("tab", { name: "Motion" }));
  await user.selectOptions(
    screen.getByLabelText("Primary movement"),
    searchCinematography("Dolly in / out")[0].id,
  );
  expect(
    screen.queryByText("Camera travel contradicts authored directions", {
      exact: true,
    }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByText("Original preset and prior scene text", {
      selector: "summary",
    }),
  );
  const original = screen
    .getByText("Original preset and prior scene text", { selector: "summary" })
    .closest("details")!;
  expect(
    within(original).queryByText(
      /Hold the camera body and viewing direction fixed/,
    ),
  ).not.toBeInTheDocument();
});
describe("Camera composer dialog", () => {
  it("previews complete text, applies only a scene Camera snapshot and preserves the original preset", async () => {
    const user = userEvent.setup(),
      apply = vi.fn(),
      before = structuredClone(camera);
    render(
      <CameraComposer
        snapshot={camera}
        assets={[]}
        onApply={apply}
        onClose={vi.fn()}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText("Shot size"),
      searchCinematography("MCU")[0].id,
    );
    expect(
      screen.getByRole("region", { name: "Complete Camera text preview" }),
    ).toHaveTextContent("Keep my authored camera override.");
    expect(
      screen.getByRole("region", { name: "Complete Camera text preview" }),
    ).toHaveTextContent("Medium close-up");
    await user.click(
      screen.getByRole("button", { name: "Apply Camera directions" }),
    );
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0].cameraComposition.version).toBe(1);
    expect(camera).toEqual(before);
  });
  it("cancels without applying and restores keyboard focus to its trigger", async () => {
    const user = userEvent.setup(),
      apply = vi.fn();
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Compose camera</button>
          {open && (
            <CameraComposer
              assets={[]}
              onApply={apply}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Compose camera" }));
    expect(
      screen.getByRole("dialog", { name: "Compose Camera directions" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Compose camera" }),
    ).toHaveFocus();
  });
  it("resets all controls to Unspecified while retaining the precise prior manual override", async () => {
    const user = userEvent.setup(),
      apply = vi.fn(),
      composed = applyCameraComposition(camera, {
        version: 1,
        techniqueIds: [searchCinematography("MCU")[0].id],
      })!;
    render(
      <CameraComposer
        snapshot={composed}
        assets={[]}
        onApply={apply}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Shot size")).not.toHaveValue("");
    await user.click(
      screen.getByRole("button", { name: "Reset to Unspecified" }),
    );
    expect(screen.getByLabelText("Shot size")).toHaveValue("");
    expect(
      screen.getByRole("region", { name: "Complete Camera text preview" }),
    ).toHaveTextContent(camera.overrideText!);
    await user.click(
      screen.getByRole("button", { name: "Apply Camera directions" }),
    );
    expect(apply.mock.calls[0][0]).toEqual(camera);
  });
  it("keeps physical choices unavailable to new graphic selections and preserves explanatory source guidance", () => {
    render(
      <CameraComposer
        shotType="graphic_motion"
        assets={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/flat source is not a modeled 3D environment/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Dolly in / out" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2D zoom" })).toBeInTheDocument();
  });
  it("shows an actionable save failure without dismissing authored controls", async () => {
    const user = userEvent.setup();
    render(
      <CameraComposer
        assets={[]}
        onApply={async () => {
          throw new Error("Synthetic quota failure");
        }}
        onClose={vi.fn()}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText("Shot size"),
      searchCinematography("MCU")[0].id,
    );
    await user.click(
      screen.getByRole("button", { name: "Apply Camera directions" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Synthetic quota failure",
      ),
    );
    expect(screen.getByLabelText("Shot size")).toHaveValue(
      searchCinematography("MCU")[0].id,
    );
  });
  it("supports arrow-key section tabs and connects the active tab to its panel", async () => {
    const user = userEvent.setup();
    render(<CameraComposer assets={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    screen.getByRole("tab", { name: "Framing" }).focus();
    await user.keyboard("{ArrowRight}");
    const motion = screen.getByRole("tab", { name: "Motion" });
    expect(motion).toHaveFocus();
    expect(motion).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Motion" })).toHaveAttribute(
      "id",
      motion.getAttribute("aria-controls"),
    );
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Advanced" })).toHaveFocus();
  });
});
