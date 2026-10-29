import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  seedCinematography,
  openCamera,
  selectTechnique,
  noOverflow,
} from "./cinematography-fixture.mjs";
const phase = process.env.CINEMATOGRAPHY_SCREENSHOT_PHASE ?? "after";
if (phase === "before") test.use({ baseURL: "http://127.0.0.1:4174" });
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`cinematography ${phase} responsive screenshots ${width}`, async ({
    page,
  }) => {
    const root = `qa-results/cinematography/${phase}`;
    mkdirSync(root, { recursive: true });
    await page.setViewportSize({ width, height });
    if (phase === "before")
      execFileSync("git", [
        "-C",
        "C:/Users/HomePC/dev/krakinai",
        "diff",
        "--quiet",
        "a03bd5d",
        "--",
        "src/App.tsx",
        "src/screens/SceneBuilderScreen.tsx",
        "src/screens/LibraryScreen.tsx",
        "src/components/SharedModals.tsx",
      ]);
    const ids = await seedCinematography(page),
      measurements = {};
    const capture = async (name) => {
      const bounds = await noOverflow(page);
      expect(bounds.document).toBeLessThanOrEqual(width + 1);
      expect(bounds.body).toBeLessThanOrEqual(width + 1);
      measurements[name] = bounds;
      await page.screenshot({ path: `${root}/${name}-${width}.png` });
    };
    await page.goto("/#/library/camera");
    await page
      .getByRole("heading", { name: "Close-up Slow Push-in", exact: true })
      .waitFor();
    await capture("presets");
    if (phase === "after") {
      await page
        .getByRole("tab", { name: "Technique explorer", exact: true })
        .click();
      await page
        .getByLabel("Search cinematography techniques", { exact: true })
        .fill("dolly zoom");
      await capture("explorer");
    }
    await page.goto(`/#/builder/${ids.draftId}`);
    await page
      .getByRole("heading", { name: "Scene Builder", exact: true })
      .waitFor();
    if (width === 1440)
      await expect(
        page.getByRole("button", { name: "Assemble Prompt", exact: true }),
      ).toBeInViewport();
    await capture("builder");
    if (phase === "after") {
      const dialog = await openCamera(page);
      await selectTechnique(dialog, "Shot size", "Medium close-up (MCU)");
      await selectTechnique(dialog, "Physical camera height", "Chest-level");
      await selectTechnique(dialog, "Viewing angle", "Low angle");
      await selectTechnique(
        dialog,
        "Add composition technique",
        "Rule of thirds",
      );
      await expect(
        dialog.getByRole("button", {
          name: "Apply Camera directions",
          exact: true,
        }),
      ).toBeInViewport();
      const first = dialog.getByRole("button", {
          name: "Close Compose Camera directions",
          exact: true,
        }),
        last = dialog.getByRole("button", {
          name: "Apply Camera directions",
          exact: true,
        });
      await last.focus();
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(last).toBeFocused();
      await capture("composer");
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", {
          name: "Compose Camera directions",
          exact: true,
        }),
      ).toBeFocused();
    }
    writeFileSync(
      `${root}/layout-${width}.json`,
      JSON.stringify(
        {
          phase,
          width,
          height,
          baselineCommit: "a03bd5d",
          measurements,
          syntheticOnly: true,
        },
        null,
        2,
      ) + "\n",
    );
  });
