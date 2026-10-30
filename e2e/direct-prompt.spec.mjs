import { test, expect, chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  ORIGINAL_DIRECT_PROMPT,
  seedDirectPrompt,
  readDirectLibrary,
  projectQuery,
  pasteOriginal,
} from "./direct-prompt-fixture.mjs";
import {
  seedOutputWorkspace,
  outputBaseline,
} from "./output-workspace-fixture.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const baseline = JSON.parse(
  await readFile(
    new URL("./fixtures/direct-prompt-baseline.json", import.meta.url),
    "utf8",
  ),
);
test("a shared saved scene revises the explicit project being viewed, preserving its original project", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { project: true });
  const sceneId = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts"),
      p = await import("/src/storage/projects.ts");
    const snap = await db.getAllSnapshot(),
      draft = snap.drafts.find((d) => d.id === ids.draftId),
      midori = snap.collections.find((c) => c.id === ids.collectionId),
      drama = snap.collections.find((c) => c.id === ids.dramaId);
    const scene = await a.saveAuthoredScene(draft.id, {
      requestId: "shared-original",
      expectedInputRevision: draft.inputRevision,
      target: {
        collectionId: midori.id,
        shotId: ids.shotId,
        expectedProjectRevision: midori.project.revision,
      },
    });
    await p.addProjectTake({
      collectionId: drama.id,
      shotId: drama.project.shots[0].id,
      sceneId: scene.id,
    });
    return scene.id;
  }, ids);
  await page.reload();
  const before = await readDirectLibrary(page),
    drama = before.collections.find((c) => c.id === ids.dramaId);
  await page.goto(
    `/#/output/${sceneId}?collection=${drama.id}&shot=${drama.project.shots[0].id}`,
  );
  await page
    .getByRole("button", { name: "Edit as New Version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct Prompt", exact: true }),
  ).toBeVisible();
  await pasteOriginal(page, "A revised shared scene in the explicit project.");
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save New Version", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const after = await readDirectLibrary(page);
  expect(after.collections.find((c) => c.id === ids.collectionId)).toEqual(
    before.collections.find((c) => c.id === ids.collectionId),
  );
  expect(
    after.collections.find((c) => c.id === drama.id).project.shots[0]
      .takeSceneIds,
  ).toHaveLength(2);
  expect(
    after.collections.find((c) => c.id === drama.id).project.shots[0]
      .selectedSceneId,
  ).toBe(sceneId);
});
test("managed recipe editor and reviewed output reject another tab changes without replacing its draft", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page);
  const draftId = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts");
    const scene = await db.saveSceneFromDraft(ids.legacyDraftId);
    return (await a.createSceneRevisionDraft(scene.id)).id;
  }, ids);
  await page.reload();
  await page.goto(`/#/output/${draftId}`);
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Scene — Café",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  const change = async (value) =>
    page.evaluate(
      async ({ draftId, value }) => {
        const db = await import("/src/storage/db.ts"),
          d = (await db.getAllSnapshot()).drafts.find((d) => d.id === draftId);
        await db.saveSceneDraft({ ...d, sceneInstructions: value });
      },
      { draftId, value },
    );
  await change("Saved in another tab after prompt review.");
  await page.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(
    page.getByText(/This draft changed in another tab/).first(),
  ).toBeVisible();
  expect(
    (await readDirectLibrary(page)).drafts.find((d) => d.id === draftId)
      .sceneInstructions,
  ).toBe("Saved in another tab after prompt review.");
  await page.reload();
  await page.goto(`/#/builder/${draftId}`);
  await expect(
    page.getByRole("heading", { name: "Scene Builder", exact: true }),
  ).toBeVisible();
  await change("Newer editor content from another tab.");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText(/This draft changed in another tab/).first(),
  ).toBeVisible();
  expect(
    (await readDirectLibrary(page)).drafts.find((d) => d.id === draftId)
      .sceneInstructions,
  ).toBe("Newer editor content from another tab.");
});

test("direct prompt import saves without components and copies/downloads the exact complete original", async ({
  page,
  context,
}) => {
  const ids = await seedDirectPrompt(page);
  await page.goto("/#/scenes");
  await page
    .getByRole("button", { name: "Import Full Prompt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct Prompt", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Imported MIDORI");
  await pasteOriginal(page, ORIGINAL_DIRECT_PROMPT);
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Original prompt text" }),
  ).toHaveText(ORIGINAL_DIRECT_PROMPT, { useInnerText: false });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copy Original Prompt", exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(hash(copied)).toBe(hash(ORIGINAL_DIRECT_PROMPT));
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Original Prompt", exact: true })
    .click();
  const downloaded = await pending;
  const downloadedBytes = await readFile(await downloaded.path());
  expect(hash(downloadedBytes)).toBe(hash(ORIGINAL_DIRECT_PROMPT));
  await mkdir("qa-results/direct-prompts", { recursive: true });
  await writeFile(
    "qa-results/direct-prompts/copy-download-integrity.json",
    JSON.stringify(
      {
        sourceSha256: hash(ORIGINAL_DIRECT_PROMPT),
        clipboardReadbackSha256: hash(copied),
        downloadSha256: hash(downloadedBytes),
        utf8Bytes: Buffer.byteLength(ORIGINAL_DIRECT_PROMPT),
        sourceLineEndings: "CRLF",
        platform: await page.evaluate(() => navigator.platform),
        userAgent: await page.evaluate(() => navigator.userAgent),
        downloadFilename: downloaded.suggestedFilename(),
      },
      null,
      2,
    ) + "\n",
  );
  await expect(
    page.getByRole("button", { name: "Structured", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Compact", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Save Immutable Scene", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const snapshot = await readDirectLibrary(page),
    scene = snapshot.scenes.find((s) => s.title === "Imported MIDORI");
  expect(scene.outputs).toEqual({ full: ORIGINAL_DIRECT_PROMPT });
  expect(scene.slots).toEqual({});
  expect(snapshot.assets).toHaveLength(ids.assetCount);
  await page.goto("/#/scenes");
  await expect(
    page.getByText("Imported MIDORI", { exact: true }),
  ).toBeVisible();
});

test("storyboard revision comparison preserves original text, fifteen planned shots, and preferred take", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, {
    saved: true,
    project: true,
    reference: true,
  });
  const before = await readDirectLibrary(page);
  await page.goto(`/#/output/${ids.sceneId}${projectQuery(ids)}`);
  await page
    .getByRole("button", { name: "Edit as New Version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct Prompt", exact: true }),
  ).toBeVisible();
  await pasteOriginal(
    page,
    "  Stationary camera with subtle optical zoom.\n\nKeep exact architecture.  ",
  );
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByText("Compare Versions before saving", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Previous prompt" }),
  ).toHaveText(ORIGINAL_DIRECT_PROMPT, { useInnerText: false });
  await page
    .getByRole("button", { name: "Save New Version", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const after = await readDirectLibrary(page),
    versions = after.scenes.filter(
      (s) => s.sceneRevision?.rootSceneId === ids.sceneId,
    );
  expect(versions).toHaveLength(2);
  expect(after.scenes.find((s) => s.id === ids.sceneId)).toEqual(
    before.scenes.find((s) => s.id === ids.sceneId),
  );
  const shot = after.collections.find((c) => c.id === ids.collectionId).project
    .shots[0];
  expect(shot.selectedSceneId).toBe(ids.sceneId);
  expect(shot.takeSceneIds).toHaveLength(2);
  expect(
    after.collections.find((c) => c.id === ids.collectionId).project.shots,
  ).toHaveLength(15);
  expect(after.collections.find((c) => c.id === ids.dramaId)).toEqual(
    before.collections.find((c) => c.id === ids.dramaId),
  );
  expect(after.drafts.find((d) => d.id === ids.dramaDraftId)).toEqual(
    before.drafts.find((d) => d.id === ids.dramaDraftId),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Compare Versions", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Revision History", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current prompt" }),
  ).toContainText("Stationary camera");
});

test("restoring an earlier prompt creates version three and never silently selects it", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { saved: true, project: true });
  const secondId = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts");
    const snapshot = await db.getAllSnapshot(),
      collection = snapshot.collections.find((c) => c.id === ids.collectionId);
    const target = {
      collectionId: ids.collectionId,
      shotId: ids.shotId,
      expectedProjectRevision: collection.project.revision,
    };
    let d = await a.createSceneRevisionDraft(ids.sceneId, { target });
    d = await db.saveSceneDraft({
      ...d,
      directPrompt: { version: 1, text: "A revised camera." },
    });
    return (
      await a.saveAuthoredScene(d.id, {
        requestId: "second",
        expectedInputRevision: d.inputRevision,
        target,
      })
    ).id;
  }, ids);
  await page.reload();
  await page.goto(`/#/output/${secondId}${projectQuery(ids)}`);
  await page
    .getByRole("button", { name: "View Revision History", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore as New Version", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Revision History", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Direct Prompt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save New Version", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const snapshot = await readDirectLibrary(page),
    third = snapshot.scenes.find(
      (s) =>
        s.sceneRevision?.rootSceneId === ids.sceneId &&
        s.sceneRevision.sequence === 3,
    );
  expect(third.outputs.full).toBe(ORIGINAL_DIRECT_PROMPT);
  expect(third.sceneRevision).toMatchObject({
    parentSceneId: secondId,
    restoredFromSceneId: ids.sceneId,
  });
  expect(
    snapshot.collections.find((c) => c.id === ids.collectionId).project.shots[0]
      .selectedSceneId,
  ).toBe(ids.sceneId);
  await page
    .getByRole("button", { name: "View Revision History", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Set as Preferred · MIDORI / 01",
      exact: true,
    })
    .last()
    .click();
  await expect
    .poll(
      async () =>
        (await readDirectLibrary(page)).collections.find(
          (c) => c.id === ids.collectionId,
        ).project.shots[0].selectedSceneId,
    )
    .toBe(third.id);
});

test("saved direct scenes expose a distinct alternate take workflow", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { saved: true });
  await page.goto(`/#/output/${ids.sceneId}`);
  await page
    .getByRole("button", { name: "Create Alternate Take", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Alternate Take", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const after = await readDirectLibrary(page),
    take = after.scenes.find((s) => s.separateTakeOfSceneId === ids.sceneId);
  expect(take).toBeTruthy();
  expect(take.versionOfSceneId).toBeUndefined();
  expect(take.sceneRevision.rootSceneId).toBe(take.id);
  expect(after.scenes.find((s) => s.id === ids.sceneId).outputs.full).toBe(
    ORIGINAL_DIRECT_PROMPT,
  );
});

test("source media removed after selection blocks a claimed attachment, preserves draft, and accepts replacement", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { source: true });
  await page.goto(`/#/output/${ids.draftId}`);
  const replacementId = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts");
    const old = (await db.getAllSnapshot()).media.find(
      (m) => m.id === ids.mediaId,
    );
    const replacement = await db.saveMediaAsset({
      filename: "replacement-source.png",
      mimeType: old.mimeType,
      blob: old.blob,
    });
    const database = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = database.transaction("media", "readwrite");
      tx.objectStore("media").delete(ids.mediaId);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    return replacement.id;
  }, ids);
  await page
    .getByRole("button", { name: "Save Immutable Scene", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("missing");
  await expect(page).toHaveURL(new RegExp(ids.draftId));
  expect(
    (await readDirectLibrary(page)).drafts.find((d) => d.id === ids.draftId)
      .directPrompt.text,
  ).toBe(ORIGINAL_DIRECT_PROMPT);
  await page.reload();
  await page.getByRole("button", { name: "Edit Draft", exact: true }).click();
  await page.getByRole("tab", { name: /References/ }).click();
  await page
    .getByLabel("Existing source media", { exact: true })
    .selectOption(replacementId);
  await page.getByRole("tab", { name: "Prompt", exact: true }).click();
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Immutable Scene", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  expect(
    (await readDirectLibrary(page)).scenes.find(
      (s) => s.authoringMode === "direct_prompt",
    ).sourceMediaLinks[0].mediaId,
  ).toBe(replacementId);
});

test("stale browser tab cannot overwrite a changed direct draft", async ({
  page,
  context,
}) => {
  const ids = await seedDirectPrompt(page);
  await page.goto(`/#/builder/${ids.draftId}`);
  const other = await context.newPage();
  await other.goto(`/#/builder/${ids.draftId}`);
  await expect(
    other.getByRole("heading", { name: "Direct Prompt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("First tab saved");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await other
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Stale tab buffer");
  await other.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  await expect(
    other.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Stale tab buffer");
  expect(
    (await readDirectLibrary(page)).drafts.find((d) => d.id === ids.draftId)
      .title,
  ).toBe("First tab saved");
});

test("quota and interrupted transactions roll back new scene and storyboard shot together", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { project: true });
  const result = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts");
    const before = await db.getAllSnapshot(),
      draft = before.drafts.find((d) => d.id === ids.draftId),
      collection = before.collections.find((c) => c.id === ids.collectionId),
      target = {
        collectionId: collection.id,
        expectedProjectRevision: collection.project.revision,
        newShot: { title: "Must roll back" },
      };
    const errors = [];
    for (const kind of ["quota", "interrupt"]) {
      const old = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === "scenes") {
          if (kind === "interrupt") this.transaction.abort();
          throw new DOMException(
            `Synthetic ${kind}`,
            kind === "quota" ? "QuotaExceededError" : "AbortError",
          );
        }
        return old.apply(this, args);
      };
      try {
        await a.saveAuthoredScene(draft.id, {
          requestId: kind,
          expectedInputRevision: draft.inputRevision,
          target,
        });
      } catch (error) {
        errors.push(error.name);
      } finally {
        IDBObjectStore.prototype.add = old;
      }
    }
    const after = await db.getAllSnapshot();
    return {
      errors,
      unchanged:
        JSON.stringify([
          before.scenes,
          before.collections,
          before.drafts,
          before.preferences,
        ]) ===
        JSON.stringify([
          after.scenes,
          after.collections,
          after.drafts,
          after.preferences,
        ]),
    };
  }, ids);
  expect(result).toEqual({
    errors: ["QuotaExceededError", "AbortError"],
    unchanged: true,
  });
});

test("same-request saves are idempotent and cross-project revisions are rejected", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { saved: true, project: true });
  const result = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts");
    const before = await db.getAllSnapshot(),
      drama = before.collections.find((c) => c.id === ids.dramaId);
    let rejected = false;
    try {
      await a.createSceneRevisionDraft(ids.sceneId, {
        target: {
          collectionId: drama.id,
          shotId: drama.project.shots[0].id,
          expectedProjectRevision: drama.project.revision,
        },
      });
    } catch {
      rejected = true;
    }
    let draft = await a.createDirectPromptDraft();
    draft = await db.saveSceneDraft({
      ...draft,
      title: "Idempotent save",
      directPrompt: { version: 1, text: "Complete different prompt." },
    });
    const options = {
      requestId: "same-request",
      expectedInputRevision: draft.inputRevision,
    };
    const results = await Promise.all([
      a.saveAuthoredScene(draft.id, options),
      a.saveAuthoredScene(draft.id, options),
    ]);
    const after = await db.getAllSnapshot();
    return {
      rejected,
      sameId: results[0].id === results[1].id,
      delta: after.scenes.length - before.scenes.length,
      dramaUnchanged:
        JSON.stringify(after.collections.find((c) => c.id === drama.id)) ===
        JSON.stringify(drama),
      dramaDraftUnchanged:
        JSON.stringify(after.drafts.find((d) => d.id === ids.dramaDraftId)) ===
        JSON.stringify(before.drafts.find((d) => d.id === ids.dramaDraftId)),
    };
  }, ids);
  expect(result).toEqual({
    rejected: true,
    sameId: true,
    delta: 1,
    dramaUnchanged: true,
    dramaDraftUnchanged: true,
  });
});

test("mixed library backup restores exact versions and original media into another isolated browser context", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(60000);
  const ids = await seedDirectPrompt(page, {
    saved: true,
    project: true,
    reference: true,
  });
  const original = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      a = await import("/src/storage/sceneAuthoring.ts");
    const before = await db.getAllSnapshot(),
      legacy = before.drafts.find((d) => d.id === ids.legacyDraftId);
    const camera = await import("/src/domain/cameraComposition.ts"),
      registry = await import("/src/domain/cinematographyRegistry.ts");
    await db.saveSceneDraft({
      ...legacy,
      slots: {
        ...legacy.slots,
        camera: camera.applyCameraComposition(legacy.slots.camera, {
          version: 1,
          techniqueIds: [
            registry.CINEMATOGRAPHY_TECHNIQUES.find(
              (t) => t.dimension === "shotSize",
            ).id,
          ],
        }),
      },
    });
    await db.saveVariant({
      parentCharacterId: before.assets.find((a) => a.category === "characters")
        .id,
      type: "Outfit",
      title: "Synthetic backup variant",
      promptText: "Synthetic jacket.",
      tags: [],
      mediaLinks: [],
    });
    let draft = await a.createSceneRevisionDraft(ids.sceneId);
    draft = await db.saveSceneDraft({
      ...draft,
      directPrompt: { version: 1, text: "Second exact version.\r\n 😊" },
      pendingInputs: [
        {
          version: 1,
          id: "pending",
          kind: "source_image",
          label: "Source to upload later",
        },
      ],
    });
    await a.saveAuthoredScene(draft.id, {
      requestId: "version",
      expectedInputRevision: draft.inputRevision,
    });
    const snapshot = await db.getAllSnapshot();
    const bytes = await (
      await import("/src/storage/backup.ts")
    ).exportFullBackupZip();
    const hash = async (blob) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return {
      bytes: Array.from(bytes),
      assets: snapshot.assets,
      variants: snapshot.variants,
      templates: snapshot.templates,
      preferences: snapshot.preferences,
      scenes: snapshot.scenes,
      drafts: snapshot.drafts,
      collections: snapshot.collections,
      media: await Promise.all(
        snapshot.media.map(async (m) => ({
          id: m.id,
          filename: m.filename,
          sha256: await hash(m.blob),
        })),
      ),
    };
  }, ids);
  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    await other.goto("http://127.0.0.1:4173/#/");
    const restored = await other.evaluate(async (original) => {
      const db = await import("/src/storage/db.ts");
      await (
        await import("/src/storage/backup.ts")
      ).restoreFullBackupZip(new Uint8Array(original.bytes));
      const snapshot = await db.getAllSnapshot();
      const hash = async (blob) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
          ),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      return {
        assets: snapshot.assets,
        variants: snapshot.variants,
        templates: snapshot.templates,
        preferences: snapshot.preferences,
        scenes: snapshot.scenes,
        drafts: snapshot.drafts,
        collections: snapshot.collections,
        media: await Promise.all(
          snapshot.media.map(async (m) => ({
            id: m.id,
            filename: m.filename,
            sha256: await hash(m.blob),
          })),
        ),
      };
    }, original);
    expect(restored).toEqual({
      assets: original.assets,
      variants: original.variants,
      templates: original.templates,
      preferences: original.preferences,
      scenes: original.scenes,
      drafts: original.drafts,
      collections: original.collections,
      media: original.media,
    });
    await other.reload();
    await other.goto(`http://127.0.0.1:4173/#/output/${ids.sceneId}`);
    await expect(
      other.getByRole("region", { name: "Original prompt text" }),
    ).toHaveText(ORIGINAL_DIRECT_PROMPT, { useInnerText: false });
  } finally {
    await isolated.close();
  }
  // Fresh persistent synthetic profile; retain it rather than deleting user-unapproved paths.
  const relativeProfile = `qa-results/direct-prompts/profiles/restart-${Date.now()}`;
  await mkdir(resolve("qa-results/direct-prompts/profiles"), {
    recursive: true,
  });
  const launch = () =>
    chromium.launchPersistentContext(resolve(relativeProfile), {
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
  let persistent = await launch();
  try {
    let reopened = await persistent.newPage();
    await reopened.goto("http://127.0.0.1:4173/#/");
    await reopened.evaluate(async (bytes) => {
      await (
        await import("/src/storage/backup.ts")
      ).restoreFullBackupZip(new Uint8Array(bytes));
    }, original.bytes);
    await persistent.close();
    persistent = await launch();
    reopened = await persistent.newPage();
    await reopened.goto(`http://127.0.0.1:4173/#/output/${ids.sceneId}`);
    await expect(
      reopened.getByRole("region", { name: "Original prompt text" }),
    ).toHaveText(ORIGINAL_DIRECT_PROMPT, { useInnerText: false });
    const records = await readDirectLibrary(reopened);
    expect(records.scenes).toEqual(original.scenes);
    expect(records.drafts).toEqual(original.drafts);
    expect(records.collections).toEqual(original.collections);
    expect(records.assets).toEqual(original.assets);
    expect(records.variants).toEqual(original.variants);
  } finally {
    await persistent.close();
  }
  await mkdir("qa-results/direct-prompts", { recursive: true });
  await writeFile(
    "qa-results/direct-prompts/backup-integrity.json",
    JSON.stringify(
      {
        fixture:
          "isolated synthetic mixed recipe/direct library; decodable canvas PNG",
        compressedBytes: original.bytes.length,
        archiveSha256: hash(Buffer.from(original.bytes)),
        counts: {
          assets: original.assets.length,
          variants: original.variants.length,
          scenes: original.scenes.length,
          drafts: original.drafts.length,
          collections: original.collections.length,
          media: original.media.length,
          templates: original.templates.length,
        },
        media: original.media,
        sceneOutputHashes: original.scenes.map((scene) => ({
          id: scene.id,
          authoringMode: scene.authoringMode ?? "recipe",
          sha256: hash(scene.outputs.full),
        })),
        cameraCompositionPreserved: original.drafts.some(
          (d) => !!d.slots.camera?.cameraComposition,
        ),
        allComparedRecordsEqual: true,
        wholeBrowserRestartVerified: true,
        retainedSyntheticProfile: relativeProfile,
      },
      null,
      2,
    ) + "\n",
  );
});

test("project destination creates a new planned shot atomically without selecting it", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { project: true });
  await page.goto(`/#/builder/${ids.draftId}`);
  await page.getByText("Save destination", { exact: true }).click();
  await page
    .getByLabel("Project", { exact: true })
    .selectOption(ids.collectionId);
  await page
    .getByLabel("New shot title", { exact: true })
    .fill("16 Additional planned shot");
  await page
    .getByRole("button", { name: "Review Prompt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Immutable Scene", exact: true })
    .click();
  await expect(page).toHaveURL(/\/output\/scene_/);
  const after = await readDirectLibrary(page),
    shots = after.collections.find((c) => c.id === ids.collectionId).project
      .shots;
  expect(shots).toHaveLength(16);
  expect(shots[15]).toMatchObject({
    title: "16 Additional planned shot",
    status: "planned",
  });
  expect(shots[15].selectedSceneId).toBeUndefined();
  expect(shots[15].takeSceneIds).toHaveLength(1);
});

test("mode changes and saved-draft reload preserve earlier recipe and direct data", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page);
  const before = await readDirectLibrary(page);
  await page.goto(`/#/builder/${ids.draftId}`);
  await page
    .getByRole("button", { name: "Build from Assets", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Scene Builder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import Full Prompt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Direct Prompt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Another complete prompt");
  await pasteOriginal(page, ORIGINAL_DIRECT_PROMPT);
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Complete Prompt", exact: true }),
  ).toHaveValue(ORIGINAL_DIRECT_PROMPT.replace(/\r\n/g, "\n"));
  const after = await readDirectLibrary(page);
  expect(after.drafts.find((d) => d.id === ids.draftId)).toEqual(
    before.drafts.find((d) => d.id === ids.draftId),
  );
  expect(after.drafts.find((d) => d.id === ids.legacyDraftId)).toEqual(
    before.drafts.find((d) => d.id === ids.legacyDraftId),
  );
});

test("legacy recipe output hashes remain identical to the captured master baseline", async ({
  page,
}) => {
  const ids = await seedOutputWorkspace(page);
  for (const [kind, id] of [
    ["draft", ids.draftId],
    ["saved", ids.sceneId],
  ]) {
    const current = await outputBaseline(page, id);
    const hashes = Object.fromEntries(
      Object.entries(current).flatMap(([group, values]) =>
        Object.entries(values).map(([key, value]) => [
          `${group}.${key}`,
          hash(value),
        ]),
      ),
    );
    expect(hashes).toEqual(baseline[kind]);
  }
  await page.goto(`/#/output/${ids.sceneId}`);
  const versions = page.getByText("Versions & Takes", { exact: true });
  await versions.focus();
  await page.keyboard.press("Enter");
  const history = page.getByRole("button", { name: "View Revision History", exact: true });
  await expect(history).toBeVisible();
  await history.click();
  await expect(page.getByRole("dialog", { name: "Revision History", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(history).toBeFocused();
  await versions.click();
  await expect(history).toBeHidden();
});

test("direct tabs, history focus and 200 percent equivalent reflow remain keyboard accessible", async ({
  page,
}) => {
  const ids = await seedDirectPrompt(page, { saved: true });
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto(`/#/output/${ids.sceneId}`);
  const prompt = page.getByRole("tab", { name: "Prompt", exact: true });
  await prompt.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /References/ })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Review", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(prompt).toBeFocused();
  const history = page.getByRole("button", {
    name: "View Revision History",
    exact: true,
  });
  await history.click();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(history).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("region", { name: "Original prompt text" }),
  ).toHaveText(ORIGINAL_DIRECT_PROMPT, { useInnerText: false });
});
