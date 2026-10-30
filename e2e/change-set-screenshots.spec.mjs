import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { seedDirectPrompt } from "./direct-prompt-fixture.mjs";
import { seedChangeSet } from "./change-set-fixture.mjs";
const phase = process.env.CHANGE_SET_PHASE ?? "after";
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
]) {
  test(`change-set ${phase} workspace screenshots ${width}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const ids =
      phase === "before"
        ? await seedDirectPrompt(page, { saved: true, project: true })
        : await seedChangeSet(page);
    const root =
      phase === "before"
        ? "docs/screenshots/change-sets/before"
        : "qa-results/change-sets/after";
    await mkdir(root, { recursive: true });
    const capture = async (name) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${root}/${name}-${width}.png` });
    };
    if (phase === "before") {
      execFileSync("git", [
        "diff",
        "--quiet",
        "bc57bd56495e004d13dc034e0fdc4d0fc46a494c",
        "--",
        "src",
      ]);
      await page.goto("/#/collections");
      await expect(
        page.getByRole("heading", {
          name: "Collections",
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      await capture("collections");
      await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
      await expect(
        page.getByRole("heading", { name: "MIDORI", exact: true, level: 1 }),
      ).toBeVisible();
      await capture("project");
      return;
    }
    const content = await readFile(
      new URL("../docs/examples/midori-change-set-v1.json", import.meta.url),
      "utf8",
    );
    await page.goto("/#/imports/ai");
    await page.getByLabel("Change-set JSON", { exact: true }).fill(content);
    await page
      .getByRole("button", { name: "Preview changes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Change-set preview", exact: true }),
    ).toBeVisible();
    if (width >= 1366)
      await expect(
        page.getByRole("button", {
          name: "Apply approved changes",
          exact: true,
        }),
      ).toBeInViewport({ ratio: 1 });
    await capture("preview");
    const firstScene=JSON.parse(content).operations.find(op=>op.type==='scene.create_direct_prompt');
    await page.locator('.import-operations summary').filter({hasText:/^Scenes /}).click();
    await page.getByRole('button',{name:`Review ${firstScene.operationId}`,exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture('detail');
    await page.getByRole('button',{name:'Close operation',exact:true}).click();
    await page
      .getByLabel("Approve storyboard changes", { exact: true })
      .check();
    await page
      .getByLabel("Approve new immutable scenes", { exact: true })
      .check();
    await page
      .getByLabel("I reviewed this exact preview", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Apply approved changes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Import receipt", exact: true }),
    ).toBeVisible();
    await capture("receipt");
    await page.goto(`/#/context/ai?project=${ids.collectionId}`);
    await expect(
      page.getByRole("heading", {
        name: "Export Context for AI",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await capture("context");
    await page.goto("/#/collections");
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true, level: 1 }),
    ).toBeVisible();
    await capture("collections");
    await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
    await expect(
      page.getByRole("heading", { name: "MIDORI", exact: true, level: 1 }),
    ).toBeVisible();
    await capture("project");
  });
}
