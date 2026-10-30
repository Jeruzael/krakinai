import { test, expect, chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import {
  seedChangeSet,
  changeSetSample,
  readChangeLibrary,
  fillAndPreview,
  approveContent,
} from "./change-set-fixture.mjs";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const pack = (id, operations) => ({
  schema: "krakinai.change-set.v1",
  changeSetId: id,
  source: { kind: "chatgpt" },
  operations,
});
const ready = async (page) => {
  for (const label of [
    "Approve storyboard changes",
    "Approve new immutable scenes",
  ]) {
    const c = page.getByLabel(label, { exact: true });
    if (await c.count()) await c.check();
  }
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
};
const apply = async (page, input) => {
  await fillAndPreview(page, input);
  await ready(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  return (await readChangeLibrary(page)).preferences.aiImports.receipts.at(-1);
};
const projectTarget = (state, id) => ({
  id,
  expectedRevision: state.collections.find((c) => c.id === id).project.revision,
});

test("a shared scene revision changes only the explicitly chosen project and shot", async ({
  page,
}) => {
  const ids = await seedChangeSet(page);
  await page.evaluate(async (ids) => {
    await (
      await import("/src/storage/projects.ts")
    ).addProjectTake({
      collectionId: ids.dramaId,
      shotId: (
        await (await import("/src/storage/db.ts")).getAllSnapshot()
      ).collections.find((c) => c.id === ids.dramaId).project.shots[0].id,
      sceneId: ids.sceneId,
    });
  }, ids);
  const before = await readChangeLibrary(page),
    drama = before.collections.find((c) => c.id === ids.dramaId),
    input = pack("shared-scene-context", [
      {
        operationId: "version",
        type: "scene.revise",
        clientRef: "v",
        sceneId: ids.sceneId,
        expectedHeadId: ids.sceneId,
        project: projectTarget(before, ids.collectionId),
        shot: { id: ids.shotId },
        prompt: { version: 1, text: "An explicit revision for MIDORI only." },
      },
    ]);
  const receipt = await apply(page, input),
    after = await readChangeLibrary(page);
  expect(after.collections.find((c) => c.id === ids.dramaId)).toEqual(drama);
  expect(
    after.collections.find((c) => c.id === ids.collectionId).project.shots[0]
      .takeSceneIds,
  ).toContain(receipt.idMappings.v.id);
  expect(
    after.collections.find((c) => c.id === ids.dramaId).project.shots[0]
      .takeSceneIds,
  ).not.toContain(receipt.idMappings.v.id);
  expect(after.scenes.find((s) => s.id === ids.sceneId)).toEqual(
    before.scenes.find((s) => s.id === ids.sceneId),
  );
});

test("a pending original is linked later as a new immutable version without replacing its pending snapshot", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    input = await changeSetSample(),
    receipt = await apply(page, input),
    operation = input.operations.find(
      (o) =>
        o.type === "scene.create_direct_prompt" &&
        o.shotType === "graphic_motion",
    ),
    state = await readChangeLibrary(page),
    original = state.scenes.find(
      (s) => s.id === receipt.idMappings[operation.clientRef].id,
    ),
    project = state.collections.find(
      (c) => c.id === receipt.idMappings.midori.id,
    ),
    shot = project.project.shots.find((s) =>
      s.takeSceneIds.includes(original.id),
    );
  expect(original.pendingInputs).toHaveLength(1);
  const next = await apply(
    page,
    pack("link-real-original", [
      {
        operationId: "link",
        type: "scene.revise",
        clientRef: "linked",
        sceneId: original.id,
        expectedHeadId: original.id,
        project: projectTarget(state, project.id),
        shot: { id: shot.id },
        prompt: {
          version: 1,
          text: original.outputs.full,
          origin: original.directPrompt.origin,
        },
        sourceMedia: [{ mediaId: ids.mediaId, mimeType: "image/png" }],
        pendingInputs: [],
      },
    ]),
  );
  const after = await readChangeLibrary(page),
    linked = after.scenes.find((s) => s.id === next.idMappings.linked.id);
  expect(linked.sourceMediaLinks[0].mediaId).toBe(ids.mediaId);
  expect(linked.pendingInputs).toEqual([]);
  expect(linked.outputs.full).toBe(original.outputs.full);
  expect(after.scenes.find((s) => s.id === original.id)).toEqual(original);
  expect(after.media).toEqual(state.media);
});

test("200 percent desktop reflow retains readable controls at 720 CSS pixels and DPR 2", async ({
  browser,
}) => {
  const isolated = await browser.newContext({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await isolated.newPage();
    await page.goto("http://127.0.0.1:4173/#/");
    await seedChangeSet(page);
    await fillAndPreview(page, await changeSetSample());
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        dpr: devicePixelRatio,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      })),
    ).toEqual({ width: 720, dpr: 2, overflow: false });
    await page
      .getByLabel("Approve storyboard changes", { exact: true })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByLabel("Approve storyboard changes", { exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Apply approved changes", exact: true })
      .scrollIntoViewIfNeeded();
    await mkdir("qa-results/change-sets/after", { recursive: true });
    await page.screenshot({
      path: "qa-results/change-sets/after/preview-200-percent.png",
      fullPage: true,
    });
  } finally {
    await isolated.close();
  }
});

test("append to an existing project preserves every prior shot,scene,draft and unrelated project", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    before = await readChangeLibrary(page),
    project = projectTarget(before, ids.collectionId);
  const input = pack("existing-append", [
    {
      operationId: "shot",
      type: "shot.create",
      clientRef: "new-shot",
      project,
      code: "16",
      title: "New planned property shot",
      plannedShotType: "property_environment",
      plannedDurationSeconds: 4,
    },
    {
      operationId: "scene",
      type: "scene.create_direct_prompt",
      clientRef: "new-scene",
      project,
      shot: { ref: "new-shot" },
      title: "Exact imported append",
      shotType: "property_environment",
      prompt: { version: 1, text: "  Exact\r\n“Taglish—tara!” 😊 e\u0301\t  " },
    },
  ]);
  const receipt = await apply(page, input),
    after = await readChangeLibrary(page),
    old = before.collections.find((c) => c.id === ids.collectionId),
    updated = after.collections.find((c) => c.id === ids.collectionId);
  expect(updated.project.shots.slice(0, -1)).toEqual(old.project.shots);
  expect(updated.project.shots.at(-1)).toMatchObject({
    id: receipt.idMappings["new-shot"].id,
    status: "planned",
    takeSceneIds: [receipt.idMappings["new-scene"].id],
  });
  expect(updated.project.shots.at(-1).selectedSceneId).toBeUndefined();
  expect(after.collections.find((c) => c.id === ids.dramaId)).toEqual(
    before.collections.find((c) => c.id === ids.dramaId),
  );
  expect(
    after.scenes.filter((s) => s.id !== receipt.idMappings["new-scene"].id),
  ).toEqual(before.scenes);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.preferences.activeDraftId).toBe(
    before.preferences.activeDraftId,
  );
});

test("revision,restore and alternate take keep old snapshots and require separate preference and status approval", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    before = await readChangeLibrary(page),
    original = before.scenes.find((s) => s.id === ids.sceneId),
    text = "  Approved exact replacement\r\n“Dito—tara!” 😊 e\u0301  ";
  const input = pack("version-two", [
    {
      operationId: "v2",
      type: "scene.revise",
      clientRef: "v2",
      sceneId: ids.sceneId,
      expectedHeadId: ids.sceneId,
      project: projectTarget(before, ids.collectionId),
      shot: { id: ids.shotId },
      prompt: { version: 1, text },
    },
  ]);
  await fillAndPreview(page, input);
  await page
    .locator(".import-operations summary")
    .filter({ hasText: /^Scenes / })
    .click();
  await page.getByRole("button", { name: "Review v2", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Existing prompt v2", exact: true }),
  ).toHaveValue(original.outputs.full.replace(/\r\n/g, "\n"));
  await expect(
    page.getByRole("textbox", { name: "Proposed prompt v2", exact: true }),
  ).toHaveValue(text.replace(/\r\n/g, "\n"));
  await page
    .getByRole("button", { name: "Close operation", exact: true })
    .click();
  await ready(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  let state = await readChangeLibrary(page),
    v2 = state.preferences.aiImports.receipts.at(-1).idMappings.v2.id;
  expect(state.scenes.find((s) => s.id === v2)).toMatchObject({
    outputs: { full: text },
    sceneRevision: { sequence: 2, parentSceneId: ids.sceneId },
  });
  expect(state.scenes.find((s) => s.id === ids.sceneId)).toEqual(original);
  expect(
    state.collections.find((c) => c.id === ids.collectionId).project.shots[0]
      .selectedSceneId,
  ).toBe(ids.sceneId);
  const r3 = await apply(
    page,
    pack("restore-three", [
      {
        operationId: "v3",
        type: "scene.restore",
        clientRef: "v3",
        sceneId: v2,
        expectedHeadId: v2,
        restoreFromSceneId: ids.sceneId,
        project: projectTarget(state, ids.collectionId),
        shot: { id: ids.shotId },
      },
    ]),
  );
  state = await readChangeLibrary(page);
  const v3 = r3.idMappings.v3.id;
  expect(state.scenes.find((s) => s.id === v3)).toMatchObject({
    outputs: { full: original.outputs.full },
    sceneRevision: { sequence: 3, restoredFromSceneId: ids.sceneId },
  });
  const rt = await apply(
    page,
    pack("alternate-take", [
      {
        operationId: "take",
        type: "scene.create_take",
        clientRef: "take",
        sceneId: v3,
        expectedHeadId: v3,
        project: projectTarget(state, ids.collectionId),
        shot: { id: ids.shotId },
        prompt: { version: 1, text: "A separate complete alternate." },
      },
    ]),
  );
  state = await readChangeLibrary(page);
  const take = rt.idMappings.take.id;
  expect(state.scenes.find((s) => s.id === take)).toMatchObject({
    separateTakeOfSceneId: v3,
    sceneRevision: { sequence: 1, rootSceneId: take },
  });
  const shot = state.collections.find((c) => c.id === ids.collectionId).project
      .shots[0],
    target = projectTarget(state, ids.collectionId);
  await fillAndPreview(
    page,
    pack("explicit-preference", [
      {
        operationId: "select",
        type: "shot.select_take",
        project: target,
        shot: { id: ids.shotId },
        scene: { id: take },
        expectedSelectedSceneId: ids.sceneId,
      },
      {
        operationId: "status",
        type: "shot.set_status",
        project: target,
        shot: { id: ids.shotId },
        expectedStatus: shot.status,
        status: "generated",
      },
    ]),
  );
  await expect(
    page.getByLabel("I reviewed this exact preview", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Approve preferred take changes", { exact: true })
    .check();
  await expect(
    page.getByLabel("I reviewed this exact preview", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Approve production status changes", { exact: true })
    .check();
  await ready(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  state = await readChangeLibrary(page);
  expect(
    state.collections.find((c) => c.id === ids.collectionId).project.shots[0],
  ).toMatchObject({ selectedSceneId: take, status: "generated" });
  expect(state.scenes.find((s) => s.id === ids.sceneId)).toEqual(original);
  expect(state.collections.find((c) => c.id === ids.dramaId)).toEqual(
    before.collections.find((c) => c.id === ids.dramaId),
  );
});

test("mismatched project,shot and source scene blocks the complete batch", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    before = await readChangeLibrary(page),
    drama = before.collections.find((c) => c.id === ids.dramaId);
  await fillAndPreview(
    page,
    pack("wrong-context", [
      {
        operationId: "wrong",
        type: "scene.revise",
        clientRef: "wrong",
        sceneId: ids.sceneId,
        expectedHeadId: ids.sceneId,
        project: projectTarget(before, ids.dramaId),
        shot: { id: drama.project.shots[0].id },
        prompt: { version: 1, text: "Must never be stored." },
      },
    ]),
  );
  await expect(
    page.getByRole("region", { name: "Blocking conflicts" }),
  ).toContainText(/does not belong/i);
  await expect(
    page.getByRole("button", { name: "Apply approved changes", exact: true }),
  ).toBeDisabled();
  expect(await readChangeLibrary(page)).toEqual(before);
});

test("a second tab write invalidates an approved preview without losing the foreign write", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    state = await readChangeLibrary(page);
  await fillAndPreview(
    page,
    pack("stale-project", [
      {
        operationId: "shot",
        type: "shot.create",
        clientRef: "shot",
        project: projectTarget(state, ids.collectionId),
        code: "16",
        title: "Stale proposed shot",
      },
    ]),
  );
  await ready(page);
  const other = await page.context().newPage();
  await other.goto("/#/");
  await other.evaluate(async (id) => {
    await (
      await import("/src/storage/projects.ts")
    ).addProjectShot({ collectionId: id, title: "Foreign tab shot" });
  }, ids.collectionId);
  const beforeApply = await readChangeLibrary(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/revision|changed/i);
  await expect(page.getByRole("alert")).toContainText("Nothing was applied");
  expect(await readChangeLibrary(page)).toEqual(beforeApply);
  await other.close();
});

for (const failure of ["quota", "abort"])
  test(`a ${failure} failure after queued writes rolls back the entire import`, async ({
    page,
  }) => {
    await seedChangeSet(page);
    await fillAndPreview(page, await changeSetSample());
    await ready(page);
    const before = await readChangeLibrary(page);
    await page.evaluate((kind) => {
      window.__qaOriginalAdd = IDBObjectStore.prototype.add;
      let scenes = 0;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === "scenes" && ++scenes === 3) {
          if (kind === "quota")
            throw new DOMException(
              "Synthetic quota rejection",
              "QuotaExceededError",
            );
          this.transaction.abort();
          throw new DOMException("Synthetic transaction abort", "AbortError");
        }
        return window.__qaOriginalAdd.apply(this, args);
      };
    }, failure);
    try {
      await page
        .getByRole("button", { name: "Apply approved changes", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Nothing was applied",
      );
      expect(await readChangeLibrary(page)).toEqual(before);
    } finally {
      await page.evaluate(() => {
        IDBObjectStore.prototype.add = window.__qaOriginalAdd;
        delete window.__qaOriginalAdd;
      });
    }
  });

test("current media disappearance or MIME metadata mismatch blocks the batch without fabricated replacements", async ({
  page,
}) => {
  const ids = await seedChangeSet(page),
    input = pack("missing-original", [
      {
        operationId: "scene",
        type: "scene.create_direct_prompt",
        clientRef: "scene",
        title: "Graphic with original",
        shotType: "graphic_motion",
        prompt: { version: 1, text: "Animate only this original." },
        sourceMedia: [{ mediaId: ids.mediaId, mimeType: "image/png" }],
      },
    ]);
  await fillAndPreview(page, input);
  await ready(page);
  const original = await page.evaluate(async (id) => {
    const db = await (await import("/src/storage/db.ts")).openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("media", "readwrite"),
        store = tx.objectStore("media"),
        request = store.get(id);
      request.onsuccess = () => {
        window.__qaOriginalMedia = request.result;
        store.delete(id);
      };
      tx.oncomplete = () => resolve({ id });
    });
  }, ids.mediaId);
  const missing = await readChangeLibrary(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/media|attachment/i);
  expect(await readChangeLibrary(page)).toEqual(missing);
  await page.evaluate(async () => {
    const db = await (await import("/src/storage/db.ts")).openDatabase();
    await new Promise((resolve) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").put({
        ...window.__qaOriginalMedia,
        mimeType: "video/mp4",
      });
      tx.oncomplete = resolve;
    });
  });
  await fillAndPreview(page, { ...input, changeSetId: "mismatched-original" });
  await expect(
    page.getByRole("region", { name: "Blocking conflicts" }),
  ).toContainText(/metadata|type|MIME/i);
  await expect(
    page.getByRole("button", { name: "Apply approved changes", exact: true }),
  ).toBeDisabled();
  await page.evaluate(async () => {
    const db = await (await import("/src/storage/db.ts")).openDatabase();
    await new Promise((resolve) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").put(window.__qaOriginalMedia);
      tx.oncomplete = resolve;
    });
  });
  await apply(page, { ...input, changeSetId: "valid-original" });
  const after = await readChangeLibrary(page),
    id = after.preferences.aiImports.receipts.at(-1).idMappings.scene.id;
  expect(
    after.scenes.find((s) => s.id === id).sourceMediaLinks[0].mediaId,
  ).toBe(original.id);
  expect(after.media).toHaveLength(missing.media.length + 1);
});

test("duplicate character and camera proposals need explicit reuse or separate-create acknowledgement", async ({
  page,
}) => {
  await seedChangeSet(page);
  const before = await readChangeLibrary(page),
    character = before.assets.find((a) => a.category === "characters"),
    camera = before.assets.find((a) => a.id === "asset_synthetic_camera");
  const input = pack("duplicate-candidates", [
    {
      operationId: "character",
      type: "asset.propose",
      clientRef: "character",
      kind: "character",
      title: character.title,
      promptText: character.promptText,
      tags: character.tags,
    },
    {
      operationId: "camera",
      type: "asset.propose",
      clientRef: "camera",
      kind: "camera",
      title: camera.title,
      promptText: camera.promptText,
      tags: camera.tags,
    },
  ]);
  await fillAndPreview(page, input);
  await page.getByText("Reusable asset decisions (2)", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Decision for character", exact: true })
    .selectOption("reuse");
  await expect(
    page.getByRole("combobox", {
      name: "Existing asset for character",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", {
      name: "Existing asset for character",
      exact: true,
    })
    .selectOption(character.id);
  await page
    .getByRole("combobox", { name: "Decision for camera", exact: true })
    .selectOption("create");
  await expect(
    page.getByLabel("I reviewed this exact preview", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Create separate asset despite matches (camera)", {
      exact: true,
    })
    .check();
  await ready(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const after = await readChangeLibrary(page);
  expect(after.assets).toHaveLength(before.assets.length + 1);
  expect(after.assets.find((a) => a.id === character.id)).toEqual(character);
  expect(after.assets.find((a) => a.id === camera.id)).toEqual(camera);
  const created = after.assets.find(
    (a) => !before.assets.some((b) => b.id === a.id),
  );
  expect(created).toMatchObject({
    category: "camera",
    reviewStatus: "unreviewed",
  });
  expect(
    after.preferences.aiImports.candidates.map((c) => c.status).sort(),
  ).toEqual(["created", "reused"]);
});

test("a JSON file imports exact text and preserves it through clipboard,TXT and selected-take project ZIP", async ({
  page,
  context,
}) => {
  await seedChangeSet(page);
  const text =
      '  # MIDORI\r\n“Dito—tara!” 😊 e\u0301\r\n\t{\"keep\":\"all exact bytes\"}  ',
    input = pack("file-and-export", [
      {
        operationId: "project",
        type: "project.create",
        clientRef: "p",
        name: "Synthetic exact export",
      },
      {
        operationId: "shot",
        type: "shot.create",
        clientRef: "s",
        project: { ref: "p" },
        code: "01",
        title: "Exact shot",
        plannedShotType: "property_environment",
      },
      {
        operationId: "scene",
        type: "scene.create_direct_prompt",
        clientRef: "v",
        project: { ref: "p" },
        shot: { ref: "s" },
        title: "Exact Unicode scene",
        shotType: "property_environment",
        prompt: { version: 1, text },
      },
      {
        operationId: "prefer",
        type: "shot.select_take",
        project: { ref: "p" },
        shot: { ref: "s" },
        scene: { ref: "v" },
        expectedSelectedSceneId: null,
      },
    ]);
  await page.goto("/#/imports/ai");
  await page
    .getByLabel("Choose change-set JSON file", { exact: true })
    .setInputFiles({
      name: "synthetic-change-set.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(input)),
    });
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await page
    .getByLabel("Approve preferred take changes", { exact: true })
    .check();
  await ready(page);
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const state = await readChangeLibrary(page),
    receipt = state.preferences.aiImports.receipts.at(-1),
    sceneId = receipt.idMappings.v.id;
  await page.goto(`/#/output/${sceneId}`);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy Original Prompt", exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(sha(copied)).toBe(sha(text));
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Original Prompt", exact: true })
    .click();
  const download = await downloading,
    txt = await readFile(await download.path());
  expect(sha(txt)).toBe(sha(text));
  const projectExport = await page.evaluate(async (id) => {
    const snapshot = await (
        await import("/src/storage/db.ts")
      ).getAllSnapshot(),
      result = await (
        await import("/src/domain/projectExport.ts")
      ).buildProjectExport(
        snapshot.collections.find((c) => c.id === id),
        snapshot,
      );
    return { bytes: Array.from(result.bytes), manifest: result.manifest };
  }, receipt.idMappings.p.id);
  const files = unzipSync(new Uint8Array(projectExport.bytes)),
    prompts = Object.entries(files).filter(
      ([name]) => name.endsWith(".txt") && name.includes("prompt"),
    );
  expect(prompts.some(([, bytes]) => sha(bytes) === sha(text))).toBe(true);
  await mkdir("qa-results/change-sets", { recursive: true });
  await writeFile(
    "qa-results/change-sets/text-integrity.json",
    JSON.stringify(
      {
        sourceSha256: sha(text),
        clipboardSha256: sha(copied),
        txtSha256: sha(txt),
        utf8Bytes: Buffer.byteLength(text),
        projectZipSha256: sha(Buffer.from(projectExport.bytes)),
        projectZipBytes: projectExport.bytes.length,
        zipPaths: Object.keys(files),
        exactPromptFound: true,
      },
      null,
      2,
    ) + "\n",
  );
});

test("context export remains read-only and independently protects full prompts,identity,notes and filenames", async ({
  page,
  context,
}) => {
  const ids = await seedChangeSet(page),
    before = await readChangeLibrary(page);
  await page.goto(`/#/context/ai?project=${ids.collectionId}`);
  const output = page.getByRole("region", {
    name: "AI context JSON",
    exact: true,
  });
  await expect(output).toBeVisible();
  let data = JSON.parse(await output.textContent());
  expect(data.scenes.every((s) => s.fullPrompt === undefined)).toBe(true);
  expect(JSON.stringify(data)).not.toContain("Dito ang ating");
  expect(JSON.stringify(data)).not.toContain(before.media[0].filename);
  expect(await readChangeLibrary(page)).toEqual(before);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy context JSON", exact: true })
    .click();
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText())),
  ).toEqual(data);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download context JSON", exact: true })
    .click();
  const download = await downloading;
  expect(JSON.parse(await readFile(await download.path(), "utf8"))).toEqual(
    data,
  );
  expect(await readChangeLibrary(page)).toEqual(before);
  const original = before.scenes.find((s) => s.id === ids.sceneId),
    character = before.assets.find((a) => a.category === "characters"),
    camera = before.assets.find((a) => a.id === "asset_synthetic_camera");
  await page.getByText("Reusable assets (0 selected)", { exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Select asset " + camera.title,
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Select asset " + character.title,
      exact: true,
    })
    .check();
  await page
    .getByLabel("Include ordinary asset and template prompt text", {
      exact: true,
    })
    .check();
  data = JSON.parse(await output.textContent());
  expect(data.assets.find((a) => a.id === camera.id).promptText).toBe(
    camera.promptText,
  );
  expect(
    data.assets.find((a) => a.id === character.id).promptText,
  ).toBeUndefined();
  await page
    .getByLabel("Include selected character identity details", { exact: true })
    .check();
  data = JSON.parse(await output.textContent());
  expect(data.assets.find((a) => a.id === character.id).promptText).toBe(
    character.promptText,
  );
  await page
    .getByText("Include specific full scene prompts (0)", { exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Include full prompt: " + original.title + " (" + original.id + ")",
      exact: true,
    })
    .check();
  data = JSON.parse(await output.textContent());
  expect(data.scenes.find((s) => s.id === ids.sceneId).fullPrompt).toBe(
    original.outputs.full,
  );
  await page
    .getByLabel("Include associated media filenames", { exact: true })
    .check();
  data = JSON.parse(await output.textContent());
  expect(JSON.stringify(data)).toContain(before.media[0].filename);
  expect(await readChangeLibrary(page)).toEqual(before);
});

test("maximum operation count and long exact prompt previews remain collapsed,scrollable and keyboard accessible", async ({
  page,
}) => {
  await seedChangeSet(page);
  const text =
      "Long exact synthetic paragraph. ".repeat(4000).slice(0, 99992) +
      "\r\nEND 😊",
    ops = [
      {
        operationId: "project",
        type: "project.create",
        clientRef: "p",
        name: "Long_title_".repeat(9),
      },
      {
        operationId: "scene",
        type: "scene.create_direct_prompt",
        clientRef: "scene",
        title: "Long prompt",
        prompt: { version: 1, text },
      },
      ...Array.from({ length: 248 }, (_, i) => ({
        operationId: "shot" + i,
        type: "shot.create",
        clientRef: "shot" + i,
        project: { ref: "p" },
        code: String(i + 1),
        title: "Long shot title " + i,
      })),
    ];
  await fillAndPreview(page, pack("large-preview", ops));
  await expect(
    page.getByRole("heading", { name: "Change-set preview", exact: true }),
  ).toBeFocused();
  expect(await page.locator(".import-group[open]").count()).toBe(0);
  await page
    .locator(".import-operations summary")
    .filter({ hasText: /^Scenes / })
    .click();
  await page.getByRole("button", { name: "Review scene", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Review operation scene" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Proposed prompt scene", exact: true }),
  ).toHaveValue(text.replace(/\r\n/g, "\n"));
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        .contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Review scene", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  await page.setViewportSize({ width: 720, height: 450 });
  await fillAndPreview(page, await changeSetSample());
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByLabel("Approve storyboard changes", { exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByLabel("Approve storyboard changes", { exact: true }),
  ).toBeChecked();
});

test("full backup restores receipts,candidates,scenes and media hashes,and replays after a whole browser restart", async ({
  page,
}) => {
  test.setTimeout(120000);
  await seedChangeSet(page);
  const input = await changeSetSample();
  const variantContext = await page.evaluate(async () => {
    const db = await import("/src/storage/db.ts"),
      state = await db.getAllSnapshot(),
      character = state.assets.find((a) => a.category === "characters");
    const variant = await db.saveVariant({
      parentCharacterId: character.id,
      type: "Outfit",
      title: "Synthetic recovery outfit",
      promptText: "A fictional blue jacket for recovery verification.",
      tags: ["synthetic"],
      mediaLinks: [
        {
          mediaId: state.media[0].id,
          role: "sample",
          altText: "Synthetic outfit guide",
          order: 0,
        },
      ],
    });
    return {
      characterId: character.id,
      characterRevision: character.revision,
      variantId: variant.id,
      variantRevision: variant.revision,
    };
  });
  const firstCharacter = input.operations.find(
    (o) =>
      o.type === "scene.create_direct_prompt" &&
      o.shotType === "character_scene",
  );
  firstCharacter.assetRefs.push({
    asset: { id: variantContext.characterId },
    expectedRevision: variantContext.characterRevision,
    slot: "character",
  });
  firstCharacter.variantRefs = [
    {
      variantId: variantContext.variantId,
      expectedRevision: variantContext.variantRevision,
      slot: "wardrobe",
    },
  ];
  await apply(page, input);
  const before = await readChangeLibrary(page),
    archive = await page.evaluate(async () =>
      Array.from(
        await (await import("/src/storage/backup.ts")).exportFullBackupZip(),
      ),
    ),
    mediaHashes = async (target) =>
      target.evaluate(async () => {
        const state = await (
          await import("/src/storage/db.ts")
        ).getAllSnapshot();
        return Promise.all(
          state.media.map(async (m) => ({
            id: m.id,
            sha256: Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  await m.blob.arrayBuffer(),
                ),
              ),
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
          })),
        );
      }),
    originalHashes = await mediaHashes(page);
  const files = unzipSync(new Uint8Array(archive)),
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(manifest.preferences.aiImports).toEqual(before.preferences.aiImports);
  const profile = `qa-results/change-sets/profiles/restart-${Date.now()}`;
  await mkdir(resolve("qa-results/change-sets/profiles"), { recursive: true });
  const launch = () =>
    chromium.launchPersistentContext(resolve(profile), {
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
  let persistent = await launch();
  try {
    let other = await persistent.newPage();
    await other.goto("http://127.0.0.1:4173/#/");
    await other.evaluate(async (bytes) => {
      await (
        await import("/src/storage/backup.ts")
      ).restoreFullBackupZip(new Uint8Array(bytes));
    }, archive);
    await persistent.close();
    persistent = await launch();
    other = await persistent.newPage();
    await other.goto("http://127.0.0.1:4173/#/imports/ai");
    expect(await readChangeLibrary(other)).toEqual(before);
    expect(await mediaHashes(other)).toEqual(originalHashes);
    await other
      .getByLabel("Change-set JSON", { exact: true })
      .fill(JSON.stringify(input));
    await other
      .getByRole("button", { name: "Preview changes", exact: true })
      .click();
    await expect(other.getByText(/already applied/)).toBeVisible();
    expect(await readChangeLibrary(other)).toEqual(before);
    await mkdir("qa-results/change-sets", { recursive: true });
    await writeFile(
      "qa-results/change-sets/backup-integrity.json",
      JSON.stringify(
        {
          fixture:
            "synthetic mixed recipe/direct library and decodable canvas PNG",
          archiveBytes: archive.length,
          archiveSha256: sha(Buffer.from(archive)),
          manifestBytes: files["manifest.json"].length,
          counts: Object.fromEntries(
            [
              "assets",
              "variants",
              "scenes",
              "drafts",
              "collections",
              "templates",
              "media",
            ].map((k) => [k, before[k].length]),
          ),
          receipts: before.preferences.aiImports.receipts.length,
          candidates: before.preferences.aiImports.candidates.length,
          sceneOutputHashes: before.scenes.map((s) => ({
            id: s.id,
            sha256: sha(s.outputs.full),
          })),
          variantContextRestored: before.scenes.some(
            (s) => s.slots.wardrobe?.sourceId === variantContext.variantId,
          ),
          mediaHashes: originalHashes,
          allRecordsExactlyEqual: true,
          wholeBrowserRestartVerified: true,
          replayAfterRestoreNoWrites: true,
          retainedSyntheticProfile: profile,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await persistent.close();
  }
});
