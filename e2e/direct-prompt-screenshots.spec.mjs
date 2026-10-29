import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  seedOutputWorkspace,
  outputBaseline,
} from "./output-workspace-fixture.mjs";
const phase = process.env.DIRECT_PROMPT_PHASE ?? "after";
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
]) {
  test(`direct prompt ${phase} responsive screenshots ${width}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const ids = await seedOutputWorkspace(page);
    // CI captures stay ignored; reviewed PNGs are copied into docs deliberately.
    const root = phase === "before"
      ? "docs/screenshots/direct-prompts/before"
      : "qa-results/direct-prompts/after";
    await mkdir(root, { recursive: true });
    if (phase === "before") {
      execFileSync("git", [
        "diff",
        "--quiet",
        "eb15dc1583f59cbee195eba9d356b0d35ef290fb",
        "--",
        "src",
      ]);
      await page.goto(`/#/builder/${ids.draftId}`);
      await expect(
        page.getByRole("heading", { name: "Scene Builder", exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: `${root}/builder-${width}.png` });
      await page.goto(`/#/output/${ids.sceneId}`);
      await expect(
        page.getByRole("heading", {
          name: "Synthetic Scene — Café",
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      await page.screenshot({ path: `${root}/output-${width}.png` });
      if (width === 1440) {
        await mkdir("qa-results/direct-prompts", { recursive: true });
        await writeFile(
          "qa-results/direct-prompts/baseline-outputs.json",
          JSON.stringify(
            {
              base: "eb15dc1583f59cbee195eba9d356b0d35ef290fb",
              draft: await outputBaseline(page, ids.draftId),
              saved: await outputBaseline(page, ids.sceneId),
            },
            null,
            2,
          ),
        );
      }
      return;
    }
    const directId = await page.evaluate(async () => {
      const authoring = await import("/src/storage/sceneAuthoring.ts");
      const db = await import("/src/storage/db.ts");
      const draft = await authoring.createDirectPromptDraft();
      await db.saveSceneDraft({
        ...draft,
        title: "MIDORI — Living Room Reveal",
        shotType: "property_environment",
        directPrompt: {
          version: 1,
          origin: "chatgpt",
          text: "  A cinematic vertical property showcase.\n\nBegin with a wide interior composition, then a slow stabilized push-in. Preserve the exact architectural layout and supplied details.\n\n“Dito ang ating tahanan.” 😊\n\nNegative: Do not invent dimensions, amenities, labels or prices.  ",
        },
        settings: { aspectRatio: "9:16", durationSeconds: 8 },
      });
      return draft.id;
    });
    const capture = async (name) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${root}/${name}-${width}.png` });
    };
    await page.reload();
    await page.goto(`/#/builder/${directId}`);
    await expect(
      page.getByRole("heading", {
        name: "Direct Prompt",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    if (width >= 1366)
      await expect(
        page.getByRole("button", { name: "Review Prompt", exact: true }),
      ).toBeInViewport();
    await capture("editor");
    await page
      .getByRole("button", { name: "Review Prompt", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Original prompt text", exact: true }),
    ).toBeVisible();
    await capture("output");
    await page
      .getByRole("button", { name: "Save Immutable Scene", exact: true })
      .click();
    await expect(page).toHaveURL(/\/output\/scene_/);
    await page
      .getByRole("button", { name: "View Revision History", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Revision History", exact: true }),
    ).toBeVisible();
    await capture("history");
    await page.keyboard.press("Escape");
    expect(
      await page
        .getByRole("button", { name: "View Revision History", exact: true })
        .evaluate((el) => el === document.activeElement),
    ).toBe(true);
  });
}
