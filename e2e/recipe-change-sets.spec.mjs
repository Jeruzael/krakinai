import { test as base, expect } from "@playwright/test";
import { isolatedMcpBrowser } from "./local-mcp-fixture.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import {
  seedRecipeBrowser,
  browserRecipe,
  readRecipeLibrary,
  readRecipeEvidence,
  oldRecipeDirectText,
  openRecipeOperation,
} from "./recipe-change-set-fixture.mjs";
import { fillAndPreview, approveContent } from "./change-set-fixture.mjs";

const test = base.extend({
  page: async ({}, use) => {
    const isolated = await isolatedMcpBrowser();
    try {
      await use(isolated.page);
    } finally {
      await isolated.context.close();
    }
  },
});
test("recipe preview copies complete outputs, saves an immutable take and reopens as an editable recipe", async ({
  page,
}) => {
  const ids = await seedRecipeBrowser(page),
    before = await readRecipeLibrary(page),
    input = browserRecipe(ids);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await fillAndPreview(page, input);
  await openRecipeOperation(page);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("table", { name: "Resolved recipe components" }),
  ).toContainText("environment · rev 2");
  await expect(
    dialog.getByRole("textbox", { name: "Environment base prompt" }),
  ).not.toBeVisible();
  const full = await dialog
    .getByRole("textbox", { name: "Recipe Full output recipe" })
    .inputValue();
  await page.evaluate(() => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (text) => {
      window.__recipeCopyArgument = text;
      return write(text);
    };
  });
  await dialog.getByRole("button", { name: "Copy Full recipe" }).click();
  expect(await page.evaluate(() => window.__recipeCopyArgument)).toBe(full);
  const nativeClipboard = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(nativeClipboard.replace(/\r\n/g, "\n")).toBe(
    full.replace(/\r\n/g, "\n"),
  );
  await dialog.getByRole("tab", { name: "Full", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("tab", { name: "Structured", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    dialog.getByRole("tab", { name: "Compact", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review recipe", exact: true }),
  ).toBeFocused();
  expect(await readRecipeLibrary(page)).toEqual(before);
  await approveContent(page);
  const after = await readRecipeLibrary(page),
    scene = after.scenes.find((s) => s.id !== ids.oldSceneId);
  expect(scene.authoringMode).toBe("recipe");
  expect(scene.outputs.full).toBe(full);
  expect(Object.keys(scene.outputs).sort()).toEqual([
    "compact",
    "full",
    "structured",
  ]);
  expect(after.scenes.find((s) => s.id === ids.oldSceneId).outputs.full).toBe(
    oldRecipeDirectText,
  );
  expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
    ids.oldSceneId,
  );
  expect(after.assets).toEqual(before.assets);
  expect(after.drafts).toEqual(before.drafts);
  await page.goto("/#/output/" + scene.id);
  await page.getByRole("button", { name: "Edit a Copy", exact: true }).click();
  await expect(page).toHaveURL(/#\/builder\/draft_/);
  await expect(
    page.getByRole("heading", { name: "Scene Builder", exact: true }),
  ).toBeVisible();
  const reopened = await readRecipeLibrary(page),
    draft = reopened.drafts.find((d) => d.sourceSceneId === scene.id);
  expect(draft.directPrompt).toBeUndefined();
  expect(draft.slots.environment).toEqual(scene.slots.environment);
  expect(reopened.scenes).toEqual(after.scenes);
});
test("blocked recipe downloads preserve the full planning package with zero partial writes", async ({
  page,
}) => {
  const ids = await seedRecipeBrowser(page),
    before = await readRecipeLibrary(page),
    input = browserRecipe(ids);
  input.operations[0].assetRefs = [];
  input.operations[0].pendingInputs = [
    {
      version: 1,
      id: "pending-facade",
      kind: "reference_image",
      label: "Approved guide not ready yet",
    },
  ];
  await fillAndPreview(page, input);
  await expect(
    page.getByRole("button", { name: "Apply approved changes", exact: true }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recipe package (JSON)" })
    .click();
  const download = await downloadPromise,
    path = await download.path();
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(input);
  expect(await readRecipeLibrary(page)).toEqual(before);
});
test("recipe revisions preserve frozen components and create alternate takes through actual review controls", async ({
  page,
}) => {
  const ids = await seedRecipeBrowser(page);
  await fillAndPreview(page, browserRecipe(ids));
  await approveContent(page);
  const initial = await readRecipeLibrary(page),
    parent = initial.scenes.find((s) => s.id !== ids.oldSceneId),
    hashes = (await readRecipeEvidence(page)).mediaHashes;
  await page.evaluate(async () => {
    const db = await import("/src/storage/db.ts"),
      s = await db.getAllSnapshot(),
      environment = s.assets.find((a) => a.id === "environment"),
      connection = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = connection.transaction("assets", "readwrite");
      tx.objectStore("assets").put({
        ...environment,
        revision: 3,
        promptText:
          "A newer global environment must not replace frozen content.",
      });
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  });
  const input = {
    schema: "krakinai.change-set.v2",
    changeSetId: "synthetic-browser-revision",
    source: { kind: "codex" },
    operations: [
      {
        operationId: "revision",
        type: "scene.revise_recipe",
        clientRef: "revision",
        project: {
          id: ids.projectId,
          expectedRevision: initial.collections[0].project.revision,
        },
        shot: { id: ids.shotId },
        sceneId: parent.id,
        expectedHeadId: parent.id,
        overrides: {
          camera: { overrideText: "A slow scene-only camera push in." },
        },
      },
    ],
  };
  await fillAndPreview(page, input);
  await openRecipeOperation(page, "revision");
  await expect(
    page.getByRole("textbox", { name: "Existing prompt revision" }),
  ).toHaveValue(parent.outputs.full);
  expect(
    await page
      .getByRole("textbox", { name: "Recipe Full output revision" })
      .inputValue(),
  ).toContain("A slow scene-only camera push in.");
  await page
    .getByRole("button", { name: "Close operation", exact: true })
    .click();
  await approveContent(page);
  const revised = await readRecipeLibrary(page),
    version = revised.scenes.find(
      (s) => !initial.scenes.some((old) => old.id === s.id),
    );
  expect(version.slots.environment).toEqual(parent.slots.environment);
  expect(version.slots.camera.promptText).toBe(parent.slots.camera.promptText);
  expect(version.slots.camera.overrideText).toBe(
    "A slow scene-only camera push in.",
  );
  expect(version.outputs.full).not.toContain("A newer global environment");
  expect(revised.scenes.find((s) => s.id === parent.id)).toEqual(parent);
  input.changeSetId = "synthetic-browser-recipe-take";
  input.operations = [
    {
      operationId: "take",
      type: "scene.create_recipe_take",
      clientRef: "take",
      project: {
        id: ids.projectId,
        expectedRevision: revised.collections[0].project.revision,
      },
      shot: { id: ids.shotId },
      sceneId: version.id,
      expectedHeadId: version.id,
      sceneInstructions: "Alternate timing with the same established scene.",
    },
  ];
  await fillAndPreview(page, input);
  await approveContent(page);
  const after = await readRecipeLibrary(page),
    take = after.scenes.find(
      (s) => !revised.scenes.some((old) => old.id === s.id),
    );
  expect(take.authoringMode).toBe("recipe");
  expect(take.sceneRevision.rootSceneId).toBe(take.id);
  expect(take.separateTakeOfSceneId).toBe(version.id);
  expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
    ids.oldSceneId,
  );
  expect(after.scenes.find((s) => s.id === version.id)).toEqual(version);
  expect((await readRecipeEvidence(page)).mediaHashes).toEqual(hashes);
  await writeFile(
    "qa-results/local-mcp/recipe-b1-revisions.json",
    JSON.stringify(await readRecipeEvidence(page), null, 2),
  );
});
test("deleting a selected original blocks atomic save, preserves drafts and permits a valid explicit replacement", async ({
  page,
}) => {
  const ids = await seedRecipeBrowser(page),
    input = browserRecipe(ids);
  Object.assign(input.operations[0], {
    shotType: "graphic_motion",
    assetRefs: [],
    sourceMedia: [
      { mediaId: ids.originalId, role: "reference", mimeType: "image/png" },
    ],
    sceneInstructions:
      "Animate only the original graphic without changing geometry.",
  });
  await fillAndPreview(page, input);
  await page.getByLabel("Approve storyboard changes", { exact: true }).check();
  await page
    .getByLabel("Approve new immutable scenes", { exact: true })
    .check();
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
  await page.evaluate(async (id) => {
    const db = await (await import("/src/storage/db.ts")).openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").delete(id);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  }, ids.originalId);
  const beforeFailure = await readRecipeLibrary(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/missing from storage/i);
  expect(await readRecipeLibrary(page)).toEqual(beforeFailure);
  const replacement = await page.evaluate(async (guideId) => {
    const db = await import("/src/storage/db.ts"),
      s = await db.getAllSnapshot(),
      guide = s.media.find((m) => m.id === guideId);
    return (
      await db.saveMediaAsset({
        filename: "synthetic-replacement.png",
        mimeType: "image/png",
        blob: guide.blob,
      })
    ).id;
  }, ids.guideId);
  input.operations[0].sourceMedia[0].mediaId = replacement;
  await fillAndPreview(page, input);
  await approveContent(page);
  const after = await readRecipeLibrary(page);
  expect(after.scenes).toHaveLength(2);
  expect(after.drafts).toEqual(beforeFailure.drafts);
  expect(after.scenes.find((s) => s.id === ids.oldSceneId)).toEqual(
    beforeFailure.scenes[0],
  );
});
for (const width of [1440, 768, 390])
  test(`recipe review reflows and preserves keyboard access at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const ids = await seedRecipeBrowser(page),
      input = browserRecipe(ids);
    await fillAndPreview(page, input);
    await openRecipeOperation(page);
    await expect(
      page.getByRole("tablist", { name: "Recipe assembled outputs" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await mkdir("qa-results/local-mcp/screenshots", { recursive: true });
    await page.screenshot({
      path: `qa-results/local-mcp/screenshots/recipe-b1-preview-${width}.png`,
    });
    await page
      .getByRole("tablist", { name: "Recipe assembled outputs" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `qa-results/local-mcp/screenshots/recipe-b1-output-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Review recipe", exact: true }),
    ).toBeFocused();
    await writeFile(
      `qa-results/local-mcp/recipe-b1-layout-${width}.json`,
      JSON.stringify({ width, ...(await readRecipeEvidence(page)) }, null, 2),
    );
  });
test("original MIME claims are checked against stored media before assembly", async ({
  page,
}) => {
  const ids = await seedRecipeBrowser(page),
    input = browserRecipe(ids),
    before = await readRecipeLibrary(page);
  Object.assign(input.operations[0], {
    shotType: "graphic_motion",
    assetRefs: [],
    sourceMedia: [
      { mediaId: ids.originalId, role: "reference", mimeType: "image/jpeg" },
    ],
    sceneInstructions:
      "Animate only the original image without inventing geometry.",
  });
  await fillAndPreview(page, input);
  await expect(
    page.getByRole("region", { name: "Blocking conflicts" }),
  ).toContainText("MIME metadata does not match stored file");
  await expect(
    page.getByRole("button", { name: "Apply approved changes", exact: true }),
  ).toBeDisabled();
  expect(await readRecipeLibrary(page)).toEqual(before);
  input.operations[0].sourceMedia[0].mimeType = "image/png";
  await fillAndPreview(page, input);
  await approveContent(page);
  const after = await readRecipeLibrary(page);
  expect(
    after.scenes.find((s) => s.id !== ids.oldSceneId).sourceMediaLinks[0]
      .mimeType,
  ).toBe("image/png");
  expect(after.media).toEqual(before.media);
});
