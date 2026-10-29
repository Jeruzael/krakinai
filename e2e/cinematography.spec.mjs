import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  seedCinematography,
  readLibrary,
  cameraDialog,
  openCamera,
  selectTechnique,
} from "./cinematography-fixture.mjs";
import { seedShotTypes } from "./shot-types-fixture.mjs";
import { outputBaseline } from "./output-workspace-fixture.mjs";

const root = "qa-results/cinematography";
mkdirSync(root, { recursive: true });
const report = (name, data) =>
  writeFileSync(`${root}/${name}.json`, JSON.stringify(data, null, 2) + "\n");
const sha = (text) => createHash("sha256").update(text).digest("hex");
test.use({ viewport: { width: 1440, height: 900 } });

test("explorer is read-only, searchable by aliases, collapsible, filtered and linked to independent owners", async ({
  page,
}) => {
  await seedCinematography(page);
  const before = await readLibrary(page);
  await page.goto("/#/library/camera");
  await expect(
    page.getByRole("tab", { name: "My Camera presets", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const tab = page.getByRole("tab", {
    name: "Technique explorer",
    exact: true,
  });
  await tab.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cinema-family")).toHaveCount(15);
  expect(await page.locator(".cinema-family[open]").count()).toBe(0);
  const family = page.locator(".cinema-family").first();
  await family.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(family).toHaveAttribute("open", "");
  await page
    .getByLabel("Search cinematography techniques", { exact: true })
    .fill("MCU");
  const article = page.locator(".cinema-technique").filter({
    has: page.getByRole("heading", {
      name: "Medium close-up (MCU)",
      exact: true,
    }),
  });
  await expect(article).toBeVisible();
  await article
    .getByRole("button", {
      name: "Favorite Medium close-up (MCU)",
      exact: true,
    })
    .click();
  await page.getByLabel("Favorites only", { exact: true }).check();
  await expect(page.locator(".cinema-technique")).toHaveCount(1);
  await article
    .getByRole("button", {
      name: "Compose with Medium close-up (MCU)",
      exact: true,
    })
    .click();
  await expect(cameraDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    article.getByRole("button", {
      name: "Compose with Medium close-up (MCU)",
      exact: true,
    }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Recent techniques", exact: true }),
  ).toContainText("Medium close-up");
  await page
    .getByLabel("Search cinematography techniques", { exact: true })
    .fill("");
  await page.getByLabel("Property recommendations", { exact: true }).check();
  await page
    .getByRole("combobox", { name: "Technique family", exact: true })
    .selectOption("N");
  await expect(page.locator(".cinema-technique")).toHaveCount(21);
  await page.getByLabel("Property recommendations", { exact: true }).uncheck();
  await page
    .getByRole("combobox", { name: "Technique family", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Filter by Shot Type", exact: true })
    .selectOption("graphic_motion");
  await page
    .getByLabel("Search cinematography techniques", { exact: true })
    .fill("2D zoom");
  await expect(
    page.getByRole("heading", { name: "2D zoom", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter by Shot Type", exact: true })
    .selectOption("all");
  await page
    .getByLabel("Search cinematography techniques", { exact: true })
    .fill("Three-point lighting");
  await page
    .getByRole("link", { name: "Browse Lighting & Mood", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/library\/lighting$/);
  expect(await readLibrary(page)).toEqual(before);
  report("explorer", {
    families: 15,
    registryItems: 338,
    aliases: true,
    keyboardDisclosure: true,
    focusRestored: true,
    propertyRecipes: 21,
    libraryRecordsUnchanged: true,
  });
});

test("composer applies only Camera, preserves exact reset and manual baseline, restores focus and rebases presets", async ({
  page,
}) => {
  const ids = await seedCinematography(page),
    before = await readLibrary(page),
    original = before.drafts.find((d) => d.id === ids.draftId);
  let dialog = await openCamera(page);
  await selectTechnique(dialog, "Shot size", "Medium close-up (MCU)");
  await selectTechnique(dialog, "Physical camera height", "Chest-level");
  await selectTechnique(dialog, "Viewing angle", "Low angle");
  await selectTechnique(dialog, "Add composition technique", "Rule of thirds");
  const preview = await dialog
    .getByRole("region", { name: "Complete Camera text preview", exact: true })
    .textContent();
  expect(preview).toContain(original.slots.camera.overrideText);
  expect(preview).toContain("Chest-level");
  expect(preview).toContain("Low angle");
  await page.keyboard.press("Escape");
  expect(await readLibrary(page)).toEqual(before);
  await expect(
    page.getByRole("button", {
      name: "Compose Camera directions",
      exact: true,
    }),
  ).toBeFocused();
  dialog = await openCamera(page);
  await selectTechnique(dialog, "Shot size", "Medium close-up (MCU)");
  await selectTechnique(dialog, "Add composition technique", "Rule of thirds");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  let after = await readLibrary(page),
    draft = after.drafts.find((d) => d.id === ids.draftId);
  expect(draft.slots.camera.cameraComposition.version).toBe(1);
  expect({
    ...draft,
    slots: { ...draft.slots, camera: original.slots.camera },
    inputRevision: original.inputRevision,
    updatedAt: original.updatedAt,
  }).toEqual(original);
  expect(after.assets).toEqual(before.assets);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.media).toEqual(before.media);
  await page.reload();
  dialog = await openCamera(page);
  await expect(
    dialog.getByRole("combobox", { name: "Shot size", exact: true }),
  ).toHaveValue(draft.slots.camera.cameraComposition.techniqueIds[0]);
  await dialog.getByRole("tab", { name: "Framing", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("tab", { name: "Motion", exact: true }),
  ).toBeFocused();
  await expect(dialog.getByRole("tabpanel")).toBeVisible();
  await page.keyboard.press("End");
  await expect(
    dialog.getByRole("tab", { name: "Advanced", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await dialog
    .getByRole("button", { name: "Reset to Unspecified", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  expect(
    (await readLibrary(page)).drafts.find((d) => d.id === ids.draftId).slots
      .camera,
  ).toEqual(original.slots.camera);
  dialog = await openCamera(page);
  await selectTechnique(dialog, "Add composition technique", "Rule of thirds");
  await selectTechnique(
    dialog,
    "Reusable Camera preset",
    "Synthetic alternate Camera",
  );
  await expect(
    dialog.getByRole("region", {
      name: "Complete Camera text preview",
      exact: true,
    }),
  ).toContainText("A smooth lateral tracking view.");
  await expect(
    dialog.getByRole("region", {
      name: "Complete Camera text preview",
      exact: true,
    }),
  ).not.toContainText("Authored Camera baseline");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  after = await readLibrary(page);
  draft = after.drafts.find((d) => d.id === ids.draftId);
  expect(draft.slots.lighting).toEqual(original.slots.lighting);
  expect(draft.slots.style).toEqual(original.slots.style);
  expect(draft.slots.character).toEqual(original.slots.character);
  report("composer", {
    cancelNoWrite: true,
    resetRestoresExactBaseline: true,
    focusAndArrowTabs: true,
    restartRetainsMetadata: true,
    presetRebased: true,
    otherLayersAndMediaUnchanged: true,
  });
});

test("explainable motion advice allows rack focus, optical zoom, compound moves and staged holds", async ({
  page,
}) => {
  await seedCinematography(page);
  const dialog = await openCamera(page);
  await dialog
    .getByLabel("Include preset / prior Camera text", { exact: true })
    .uncheck();
  await selectTechnique(dialog, "Focus", "Rack focus / focus pull");
  await dialog.getByRole("tab", { name: "Motion", exact: true }).click();
  await selectTechnique(
    dialog,
    "Primary movement",
    "Locked-off / static camera",
  );
  await expect(
    dialog.getByRole("complementary", {
      name: "Camera compatibility advice",
      exact: true,
    }),
  ).toHaveCount(0);
  await selectTechnique(dialog, "Secondary movement", "Dolly in / out");
  await expect(
    dialog.getByText("Static camera and physical travel overlap", {
      exact: true,
    }),
  ).toBeVisible();
  await selectTechnique(dialog, "Movement arrangement", "Sequential phases");
  const ordered = await dialog
    .getByRole("region", { name: "Complete Camera text preview", exact: true })
    .textContent();
  expect(
    ordered.indexOf("Primary movement — Locked-off / static camera"),
  ).toBeLessThan(ordered.indexOf("Secondary movement — Dolly in / out"));
  await expect(
    dialog.getByRole("complementary", {
      name: "Camera compatibility advice",
      exact: true,
    }),
  ).toHaveCount(0);
  await selectTechnique(
    dialog,
    "Movement arrangement",
    "Same phase — review conflicts",
  );
  await selectTechnique(dialog, "Secondary movement", "Optical zoom in / out");
  await expect(
    dialog.getByRole("complementary", {
      name: "Camera compatibility advice",
      exact: true,
    }),
  ).toHaveCount(0);
  await selectTechnique(dialog, "Primary movement", "Dolly in / out");
  await selectTechnique(
    dialog,
    "Movement arrangement",
    "Intentional compound move",
  );
  await expect(
    dialog.getByRole("complementary", {
      name: "Camera compatibility advice",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .locator("summary")
    .filter({ hasText: "Optional motion parameters" })
    .click();
  await dialog.getByLabel("Movement duration (s)", { exact: true }).fill("0");
  await expect(
    dialog.getByText("Travel has zero movement time", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Apply Camera directions",
      exact: true,
    }),
  ).toBeEnabled();
  report("advisories", {
    staticTravelWarns: true,
    staticRackFocusAllowed: true,
    staticOpticalZoomAllowed: true,
    compoundDollyZoomAllowed: true,
    stagedHoldsAllowed: true,
    zeroTravelTimeWarns: true,
    adviceDoesNotBlock: true,
  });
});

test("source graphics and footage use editing choices and retain original-media assembly safeguards", async ({
  page,
}) => {
  const ids = await seedShotTypes(page);
  await page
    .getByLabel("Shot Type", { exact: true })
    .selectOption("graphic_motion");
  let dialog = await openCamera(page);
  await expect(
    dialog.getByRole("combobox", {
      name: "Physical camera height",
      exact: true,
    }),
  ).toHaveCount(0);
  await selectTechnique(dialog, "Source-based graphics", "2D zoom");
  await expect(dialog).toContainText(
    "A flat source is not a modeled 3D environment",
  );
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByLabel("Animation Instructions (Required)", { exact: true })
    .fill("Preserve the supplied geometry; use only a subtle digital zoom.");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readLibrary(page)).drafts.find((d) => d.id === ids.draftId)
          .sceneInstructions,
    )
    .toBe("Preserve the supplied geometry; use only a subtle digital zoom.");
  await page
    .getByRole("button", { name: "Assemble Prompt", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/builder\//);
  await expect(page.locator(".banner-error")).toContainText(/source image/i);
  await page
    .getByLabel("Existing source media", { exact: true })
    .selectOption(ids.sourceId);
  await page
    .getByRole("button", { name: "Assemble Prompt", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/output\//);
  await page.goto(ids.draftRoute);
  await page
    .getByLabel("Shot Type", { exact: true })
    .selectOption("existing_footage");
  dialog = await openCamera(page);
  await expect(
    dialog.getByRole("combobox", {
      name: "Physical camera height",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", {
      name: "Source-based graphics",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  report("source-workflows", {
    graphicWithoutOriginalBlocked: true,
    validOriginalAssembles: true,
    physicalFieldsNotRequired: true,
    footageEditingChoices: true,
  });
});

test("complete copy/download, immutable saved scenes and full-backup restoration preserve Camera metadata and media", async ({
  page,
}) => {
  test.setTimeout(90000);
  const ids = await seedCinematography(page),
    before = await readLibrary(page);
  const originalMediaHashes = await page.evaluate(async () => {
    const { media } = await (
      await import("/src/storage/db.ts")
    ).getAllSnapshot();
    return Promise.all(
      media.map(async (m) => ({
        id: m.id,
        sha256: Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await m.blob.arrayBuffer()),
          ),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
      })),
    );
  });
  const dialog = await openCamera(page);
  await selectTechnique(dialog, "Add composition technique", "Rule of thirds");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Assemble Prompt", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/output\//);
  const baseline = await outputBaseline(page, ids.draftId);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__cinemaCopy = text;
        },
      },
    }),
  );
  const hashes = {};
  for (const [label, key] of [
    ["Narrative", "full"],
    ["Structured", "structured"],
    ["Compact", "compact"],
    ["Project JSON", "json"],
    ["Generation JSON", "generation_json"],
  ]) {
    await page
      .getByRole("tab", { name: new RegExp(`^${label}(?: Recommended)?$`) })
      .click();
    await page
      .getByRole("button", { name: "Show Prompt", exact: true })
      .click();
    const viewer = page.getByRole("dialog", {
      name: "Scene Prompt — Synthetic Scene — Café",
      exact: true,
    });
    const raw = viewer.getByRole("button", { name: "Raw", exact: true });
    if (await raw.isVisible()) await raw.click();
    expect(
      await viewer
        .getByRole("region", { name: "Complete prompt text", exact: true })
        .textContent(),
    ).toBe(baseline.text[key]);
    await viewer
      .getByRole("button", { name: "Copy Prompt", exact: true })
      .click();
    expect(await page.evaluate(() => window.__cinemaCopy)).toBe(
      baseline.text[key],
    );
    const pending = page.waitForEvent("download");
    await viewer
      .getByRole("button", { name: "Download Selected", exact: true })
      .click();
    const download = await pending;
    await download.saveAs(`${root}/camera-${key}.txt`);
    expect(readFileSync(`${root}/camera-${key}.txt`, "utf8")).toBe(
      baseline.text[key],
    );
    hashes[key] = sha(baseline.text[key]);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Save Scene", exact: true }).click();
  await expect(page).toHaveURL(/#\/output\/scene_/);
  const savedId = page.url().split("#/output/")[1].split("?")[0];
  const saved = (await readLibrary(page)).scenes.find((s) => s.id === savedId);
  expect(saved.slots.camera.cameraComposition.version).toBe(1);
  const proof = await page.evaluate(async (savedId) => {
    const db = await import("/src/storage/db.ts"),
      backup = await import("/src/storage/backup.ts");
    const bytes = await backup.exportFullBackupZip();
    await db.clearAllStoresForTesting();
    await backup.restoreFullBackupZip(bytes);
    const snapshot = await db.getAllSnapshot();
    const hashes = await Promise.all(
      snapshot.media.map(async (m) => ({
        id: m.id,
        sha256: Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await m.blob.arrayBuffer()),
          ),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
      })),
    );
    return {
      bytes: bytes.length,
      scenes: snapshot.scenes,
      metadata: snapshot.scenes.find((s) => s.id === savedId).slots.camera
        .cameraComposition,
      hashes,
    };
  }, savedId);
  expect(proof.scenes.find((s) => s.id === ids.sceneId)).toEqual(
    before.scenes.find((s) => s.id === ids.sceneId),
  );
  expect(proof.scenes.find((s) => s.id === savedId)).toEqual(saved);
  expect(proof.hashes).toEqual(originalMediaHashes);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Edit a Copy", exact: true }),
  ).toBeVisible();
  report("output-integrity", {
    hashes,
    backupBytes: proof.bytes,
    restoredMetadata: proof.metadata,
    restoredMediaHashes: proof.hashes,
    legacySceneUnchanged: true,
  });
});

test("core pack preview skips positive and ambiguous matches, installs only after confirmation and is idempotent", async ({
  page,
}) => {
  await seedCinematography(page);
  await page.evaluate(async () => {
    const db = await import("/src/storage/db.ts"),
      registry = await import("/src/domain/cinematographyRegistry.ts");
    await db.savePromptAsset({
      title: "Synthetic all-depth custom Camera",
      category: "camera",
      promptText: registry
        .searchCinematography("Deep focus")
        .find((t) => t.name === "Deep focus").direction,
      tags: [],
      mediaLinks: [],
    });
  });
  await page.reload();
  const before = await readLibrary(page);
  await page.goto("/#/library/camera");
  await page
    .getByRole("button", { name: "Review core preset pack", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Review cinematography core pack",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByLabel("Install Rule of thirds", { exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByLabel("Install Leading lines", { exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByLabel("Install Negative space", { exact: true }),
  ).toBeDisabled();
  expect(await readLibrary(page)).toEqual(before);
  await expect(
    dialog.getByRole("button", {
      name: "Install selected missing presets",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog
    .getByLabel(
      "I reviewed the missing entries and want to add them without replacing existing records.",
      { exact: true },
    )
    .check();
  await dialog
    .getByRole("button", {
      name: "Install selected missing presets",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Complete. Added 4 preset(s)",
  );
  const after = await readLibrary(page);
  expect(
    after.assets.filter((a) => before.assets.some((b) => b.id === a.id)),
  ).toEqual(before.assets);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.media).toEqual(before.media);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Review core preset pack", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Review cinematography core pack",
    exact: true,
  });
  await expect(dialog.locator("input[type=checkbox]:enabled")).toHaveCount(1);
  await expect(
    dialog.getByRole("button", {
      name: "Install selected missing presets",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await readLibrary(page)).toEqual(after);
  report("core-pack", {
    positivePromptAndTagMatchesSkipped: 3,
    ambiguousSkipped: 1,
    added: 4,
    existingRecordsIdentical: true,
    reopenNoWrites: true,
  });
});

test("library-first composition previews the existing fallback source draft before updating it", async ({
  page,
}) => {
  const ids = await seedCinematography(page);
  await page.evaluate(async (id) => {
    const db = await import("/src/storage/db.ts");
    let snapshot = await db.getAllSnapshot();
    await db.saveSceneDraft({
      ...snapshot.drafts.find((d) => d.id === id),
      shotType: "graphic_motion",
    });
    snapshot = await db.getAllSnapshot();
    await db.replaceAllStoresTransactionally({
      ...snapshot,
      preferences: { ...snapshot.preferences, activeDraftId: undefined },
    });
  }, ids.draftId);
  await page.goto("/#/library/camera?view=techniques");
  await page.reload();
  const before = await readLibrary(page),
    original = before.drafts.find((d) => d.id === ids.draftId);
  const dialog = await openCamera(page);
  await expect(
    dialog.getByRole("region", {
      name: "Complete Camera text preview",
      exact: true,
    }),
  ).toContainText("Authored Camera baseline.");
  await expect(
    dialog.getByRole("combobox", {
      name: "Physical camera height",
      exact: true,
    }),
  ).toHaveCount(0);
  await selectTechnique(dialog, "Source-based graphics", "2D zoom");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/builder/${ids.draftId}`));
  const after = await readLibrary(page),
    draft = after.drafts.find((d) => d.id === ids.draftId);
  expect(draft.slots.camera.sourceId).toBe(original.slots.camera.sourceId);
  expect(draft.slots.camera.overrideText).toContain(
    original.slots.camera.overrideText,
  );
  expect(draft.slots.lighting).toEqual(original.slots.lighting);
  expect(draft.slots.style).toEqual(original.slots.style);
  expect(after.assets).toEqual(before.assets);
  report("fallback-draft", {
    previewedDraftId: ids.draftId,
    appliedDraftId: draft.id,
    sourceTypePreserved: true,
    originalCameraBaselineRetained: true,
  });
});

test("manual scene-only Camera survives composing again and Reset without losing its authored text", async ({
  page,
}) => {
  const ids = await seedShotTypes(page);
  let dialog = await openCamera(page);
  await selectTechnique(dialog, "Shot size", "Medium close-up (MCU)");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Open Camera details: Scene-only Camera composition",
      exact: true,
    })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Camera details",
    exact: true,
  });
  await detail
    .getByLabel("Scene-Only Text Override (Does not modify library record)", {
      exact: true,
    })
    .fill("My manually authored Camera remains intact.");
  await detail
    .getByRole("button", { name: "Apply Scene Override", exact: true })
    .click();
  const baseline = (await readLibrary(page)).drafts.find(
    (d) => d.id === ids.draftId,
  ).slots.camera;
  expect(baseline.cameraComposition).toBeUndefined();
  dialog = await openCamera(page);
  await selectTechnique(dialog, "Add composition technique", "Rule of thirds");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  dialog = await openCamera(page);
  await dialog
    .getByRole("button", { name: "Reset to Unspecified", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", {
      name: "Complete Camera text preview",
      exact: true,
    }),
  ).toHaveText("My manually authored Camera remains intact.");
  await dialog
    .getByRole("button", { name: "Apply Camera directions", exact: true })
    .click();
  expect(
    (await readLibrary(page)).drafts.find((d) => d.id === ids.draftId).slots
      .camera,
  ).toEqual(baseline);
  report("manual-blueprint-reset", {
    draftId: ids.draftId,
    authoredSnapshotRestoredExactly: true,
  });
});
