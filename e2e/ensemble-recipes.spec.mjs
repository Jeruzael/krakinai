import { test as base, expect, chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { isolatedMcpBrowser } from "./local-mcp-fixture.mjs";
import { fillAndPreview, approveContent } from "./change-set-fixture.mjs";
import { openRecipeOperation } from "./recipe-change-set-fixture.mjs";
import {
  seedEnsembleBrowser,
  ensembleBrowserRecipe,
  readEnsembleLibrary,
  ensembleEvidence,
  chooseOutfitCreate,
  exactEnsembleLine,
} from "./ensemble-fixture.mjs";
const out = resolve("qa-results/ensemble-b2");
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
test.setTimeout(60000);
async function record(name, value) {
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, name + ".json"), JSON.stringify(value, null, 2));
}

test("secondary wardrobe guides and historical templates survive production save, export and take comparison", async ({
  page,
}) => {
  const ids = await seedEnsembleBrowser(page);
  const prepared = await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts");
    const authoring = await import("/src/storage/sceneAuthoring.ts");
    const projects = await import("/src/storage/projects.ts");
    const { syncEnsemblePrimary } = await import("/src/domain/ensemble.ts");
    const { buildProjectExport } = await import("/src/domain/projectExport.ts");
    const state = await db.getAllSnapshot();
    const original = state.drafts.find((d) => d.id === ids.draftId);
    const input = structuredClone(original);
    input.shotType = "property_environment";
    delete input.ensemble.participants[0].wardrobe;
    input.ensemble.dialogueCues[1].line = "  A different exact reply.\r\n😊  ";
    const selectedGuide = input.referencePack.entries.find(
      (e) => e.participantId === "lucas" && e.sourceSlot === "wardrobe",
    );
    if (!selectedGuide)
      throw Error("Synthetic secondary wardrobe guide missing");
    const draft = await db.saveSceneDraft(syncEnsemblePrimary(input));
    const saved = await authoring.saveAuthoredScene(draft.id, {
      requestId: "reference-review",
      expectedInputRevision: draft.inputRevision,
    });
    if (
      !saved.referencePack.entries.some(
        (e) => e.associationId === selectedGuide.associationId,
      )
    )
      throw Error("Saved secondary guide was omitted");
    await projects.addProjectTake({
      collectionId: ids.projectId,
      shotId: ids.shotId,
      sceneId: saved.id,
    });
    // Explicit test setup chooses this take; import never implicitly selects it.
    await projects.selectProjectTake({
      collectionId: ids.projectId,
      shotId: ids.shotId,
      sceneId: saved.id,
    });
    const selectedState = await db.getAllSnapshot();
    const exported = await buildProjectExport(
      selectedState.collections.find((c) => c.id === ids.projectId),
      selectedState,
    );
    if (
      !exported.manifest.associations.some(
        (e) => e.associationId === selectedGuide.associationId,
      )
    )
      throw Error("Project ZIP omitted secondary guide");
    const removed = structuredClone(draft);
    removed.ensemble.participants = removed.ensemble.participants.filter(
      (p) => p.id !== "lucas",
    );
    removed.ensemble.dialogueCues = removed.ensemble.dialogueCues.filter(
      (c) => c.participantId !== "lucas",
    );
    const historical = await db.saveSceneDraft(syncEnsemblePrimary(removed));
    const template = await db.saveDraftAsTemplate({
      draft: historical,
      name: "Retained historical participant guide",
      description: "",
      includeCharacterIdentity: true,
      ensembleMode: "full",
    });
    const reopened = await db.createDraftFromTemplate(template.id);
    if (
      !reopened.referencePack.entries.some(
        (e) => e.associationId === selectedGuide.associationId,
      )
    )
      throw Error("Template lost historical participant guide");
    if (reopened.ensemble.participants.some((p) => p.id === "lucas"))
      throw Error("Template invented removed participant");
    return {
      sceneId: saved.id,
      cueId: saved.ensemble.dialogueCues[1].id,
      line: saved.ensemble.dialogueCues[1].line,
      title: saved.ensemble.participants[1].wardrobe.sourceTitle,
      guide: selectedGuide.associationId,
      participantGuideRetained: true,
      templateGuideRetained: true,
    };
  }, ids);
  await page.goto(`/#/collections/${ids.projectId}?tab=storyboard`);
  await page.reload();
  await page.locator(".cw-continuity-review > summary").click();
  const row = page
    .locator(".pc-row")
    .filter({ hasText: "Lucas / Base Identity" })
    .first();
  await expect(row).toContainText(`Wardrobe source: ${prepared.title}`);
  await page
    .getByRole("button", { name: /Manage takes/i })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Compare takes", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Take A", exact: true })
    .selectOption(ids.parentId);
  await page
    .getByRole("combobox", { name: "Take B", exact: true })
    .selectOption(prepared.sceneId);
  const pane = page.getByRole("region", { name: "Take B", exact: true });
  await pane
    .getByText("Lucas / Base Identity locked identity", { exact: true })
    .click();
  await expect(
    pane.getByText(`Clothing: ${prepared.title}`, { exact: false }),
  ).toBeVisible();
  await pane
    .locator("summary")
    .filter({ hasText: `cue ${prepared.cueId}` })
    .click();
  await expect(
    pane.getByRole("textbox", {
      name: `Exact line ${prepared.cueId}`,
      exact: true,
    }),
  ).toHaveValue(prepared.line.replace(/\r\n/g, "\n"));
  await record("review-reference-production", prepared);
});
test("deferred Outfit candidates can be reviewed later and reused without duplicating records", async ({
  page,
}) => {
  const ids = await seedEnsembleBrowser(page),
    before = await readEnsembleLibrary(page),
    proposal = ensembleBrowserRecipe(ids, { outfit: true }).operations[0],
    input = {
      schema: "krakinai.change-set.v3",
      changeSetId: "synthetic-outfit-defer",
      source: { kind: "manual" },
      operations: [proposal],
    };
  await fillAndPreview(page, input);
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const deferred = await readEnsembleLibrary(page),
    candidate = deferred.preferences.aiImports.variantCandidates[0];
  expect(candidate.status).toBe("pending");
  expect(deferred.variants).toEqual(before.variants);
  expect(deferred.scenes).toEqual(before.scenes);
  await page.goto("/#/imports/ai");
  await page
    .getByText("Pending library candidates (1)", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Review candidate ${proposal.title}`,
      exact: true,
    })
    .click();
  await page.getByText("Outfit variant decisions (1)", { exact: true }).click();
  await page
    .getByRole("combobox", {
      name: "Outfit decision review-candidate",
      exact: true,
    })
    .selectOption("reuse");
  const reuse = page.getByRole("combobox", {
    name: "Reuse Outfit review-candidate",
    exact: true,
  });
  await expect(
    reuse.getByRole("option", { name: /character Outfit/ }),
  ).toHaveCount(0);
  await reuse.selectOption("lucas-suit");
  await expect(reuse).toHaveValue("lucas-suit");
  await page
    .getByLabel("I reviewed this exact preview", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Apply approved changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const after = await readEnsembleLibrary(page);
  expect(after.variants).toEqual(before.variants);
  expect(after.scenes).toEqual(before.scenes);
  expect(
    after.preferences.aiImports.variantCandidates.find(
      (c) => c.id === candidate.id,
    ),
  ).toMatchObject({ status: "reused", variantId: "lucas-suit" });
  await record("defer-and-reuse", {
    candidateId: candidate.id,
    beforeVariants: before.variants.length,
    afterVariants: after.variants.length,
    ...(await ensembleEvidence(page)),
  });
});
test("a removed original blocks an ensemble narration draft and an explicit valid replacement permits assembly", async ({
  page,
}) => {
  const ids = await seedEnsembleBrowser(page),
    draft = await page.evaluate(async (ids) => {
      const db = await import("/src/storage/db.ts"),
        pa = await import("/src/domain/promptAssembler.ts"),
        s = await db.getAllSnapshot(),
        source = s.media.find((m) => m.id === ids.ayaImageId),
        original = await db.saveMediaAsset({
          filename: "synthetic-original-graphic.png",
          mimeType: source.mimeType,
          blob: source.blob,
        });
      return db.saveSceneDraft({
        title: "Synthetic narrated graphic",
        shotType: "graphic_motion",
        slots: {
          camera: pa.createSnapshotFromAsset(
            s.assets.find((a) => a.id === "camera"),
          ),
        },
        ensemble: {
          version: 1,
          primaryParticipantId: null,
          participants: [],
          dialogueCues: [
            {
              id: "narrator",
              speaker: "Narrator",
              mode: "voiceover",
              line: "An exact synthetic narration.",
            },
          ],
        },
        extraRequiredSlots: [],
        sceneInstructions:
          "Animate the original flat graphic without changing its geometry.",
        sourceMediaLinks: [
          {
            mediaId: original.id,
            role: "reference",
            order: 0,
            filename: original.filename,
            mimeType: original.mimeType,
            altText: "Synthetic original graphic",
          },
        ],
        settings: { durationSeconds: 8 },
        manualOutputs: {},
        resultMediaLinks: [],
        reviewNotes: "",
        reviewStatus: "unreviewed",
      });
    }, ids);
  await page.goto(`/#/builder/${draft.id}`);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Dialogue cues (1)", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (id) => {
    const db = await (await import("/src/storage/db.ts")).openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").delete(id);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  }, draft.sourceMediaLinks[0].mediaId);
  await page
    .getByRole("button", { name: "Assemble Prompt", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/builder/${draft.id}$`));
  await expect(
    page.getByText(/Review Source Media and the required instructions/),
  ).toBeVisible();
  const blocked = (await readEnsembleLibrary(page)).drafts.find(
    (d) => d.id === draft.id,
  );
  expect(blocked.ensemble).toEqual(draft.ensemble);
  expect(blocked.slots).toEqual(draft.slots);
  expect(blocked.sourceMediaLinks).toEqual(draft.sourceMediaLinks);
  expect(blocked.inputRevision).toBe(draft.inputRevision);
  await page.getByRole("button", { name: /^Preflight/ }).click();
  await expect(page.getByRole("dialog")).toContainText(/blocking/i);
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Existing source media", exact: true })
    .selectOption(ids.lucasImageId);
  await expect(
    page.getByRole("combobox", { name: "Existing source media", exact: true }),
  ).toHaveValue(ids.lucasImageId);
  await page
    .getByRole("button", { name: "Assemble Prompt", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/output/${draft.id}$`));
  expect(
    (await readEnsembleLibrary(page)).drafts.find((d) => d.id === draft.id)
      .ensemble,
  ).toEqual(draft.ensemble);
  await record("missing-original", {
    blockedDraftPreserved: true,
    replacementId: ids.lucasImageId,
    ...(await ensembleEvidence(page)),
  });
});
test("shared-file participant reference associations have distinct accessible controls", async ({
  page,
}) => {
  const ids = await seedEnsembleBrowser(page);
  await page.evaluate(async (ids) => {
    const db = await import("/src/storage/db.ts"),
      pa = await import("/src/domain/promptAssembler.ts"),
      m = await import("/src/domain/ensemble.ts"),
      refs = await import("/src/domain/referencePack.ts"),
      s = await db.getAllSnapshot();
    let d = s.drafts.find((d) => d.id === ids.draftId);
    const shared = pa.createSnapshotFromAsset(
      s.assets.find((a) => a.id === "generic-wardrobe"),
    );
    for (const p of d.ensemble.participants)
      p.wardrobe = structuredClone(shared);
    d = m.syncEnsemblePrimary(d);
    d.referencePack = {
      version: 1,
      entries: refs.collectReferenceCandidates(
        d,
        new Map(s.media.map((m) => [m.id, m])),
      ),
    };
    await db.saveSceneDraft(d);
  }, ids);
  await page.goto(`/#/builder/${ids.draftId}`);
  await page.reload();
  await page.getByRole("button", { name: /^Manage Reference Pack/ }).click();
  const checks = page.getByRole("dialog").getByRole("checkbox"),
    labels = await checks.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    );
  expect(labels.length).toBe(5);
  expect(new Set(labels).size).toBe(labels.length);
  await expect(page.getByRole("dialog")).toContainText("primary");
  await expect(page.getByRole("dialog")).toContainText("lucas");
  const before = await readEnsembleLibrary(page),
    downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Reference ZIP", exact: true })
    .click();
  const download = await downloadPromise;
  await mkdir(out, { recursive: true });
  const path = resolve(out, `synthetic-reference-pack-${Date.now()}.zip`);
  await download.saveAs(path);
  const bytes = await readFile(path),
    files = unzipSync(bytes),
    manifest = JSON.parse(strFromU8(files["manifest.json"])),
    wardrobe = manifest.entries.filter((e) => e.sourceSlot === "wardrobe");
  expect(manifest.entries).toHaveLength(5);
  expect(wardrobe.map((e) => e.participantId).sort()).toEqual([
    "lucas",
    "primary",
  ]);
  expect(wardrobe.every((e) => typeof e.binaryPath === "string")).toBe(true);
  expect(new Set(wardrobe.map((e) => e.binaryPath)).size).toBe(1);
  expect(
    Object.keys(files).filter((name) => name.startsWith("media/")),
  ).toHaveLength(3);
  expect(await readEnsembleLibrary(page)).toEqual(before);
  await record("reference-associations", {
    path,
    archiveSha256: createHash("sha256").update(bytes).digest("hex"),
    associations: manifest.entries,
    binaryCount: 3,
    storedDataUnchanged: true,
  });
});
test("mixed legacy, v2 and ensemble backups survive UI restore, browser restart, exact replay and Project Export", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ids = await seedEnsembleBrowser(page);
  await page.goto(`/#/builder/${ids.draftId}`);
  await page
    .getByRole("button", { name: "Save as Template", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Template Name *", exact: true })
    .fill("Synthetic full ensemble backup template");
  await page
    .getByRole("combobox", { name: "Ensemble contents", exact: true })
    .selectOption("full");
  await page
    .getByRole("button", { name: "Save Template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const input = ensembleBrowserRecipe(ids, {
    id: "synthetic-mixed-backup-v3",
    outfit: true,
  });
  const prepared = await page.evaluate(
    async ({ ids, input }) => {
      const db = await import("/src/storage/db.ts"),
        ef = await import("/src/__tests__/fixtures/ensembleFixture.ts"),
        f = await import("/src/__tests__/fixtures/recipeChangeSetFixture.ts"),
        api = await import("/src/storage/changeSets.ts"),
        projects = await import("/src/storage/projects.ts");
      const legacyInput = ef.ensembleLegacyDraft();
      delete legacyInput.id;
      legacyInput.title = "Synthetic legacy scene without ensemble";
      const legacyDraft = await db.saveSceneDraft(legacyInput);
      await db.saveSceneFromDraft(legacyDraft.id);
      const v2 = f.recipeChangeSet();
      v2.changeSetId = "synthetic-mixed-backup-v2";
      v2.operations[0].project.expectedRevision = (
        await db.getAllSnapshot()
      ).collections[0].project.revision;
      const oldPreview = await api.previewChangeSet(v2, f.recipeApproval());
      await api.applyApprovedChangeSet(oldPreview, oldPreview.approvedDigest);
      input.operations.find(
        (o) => o.operationId === "ensemble",
      ).project.expectedRevision = (
        await db.getAllSnapshot()
      ).collections[0].project.revision;
      const approval = {
          ...f.recipeApproval(),
          variantDecisions: {
            outfit: { action: "create", acknowledgeDuplicate: true },
          },
        },
        preview = await api.previewChangeSet(input, approval),
        receipt = await api.applyApprovedChangeSet(
          preview,
          preview.approvedDigest,
        ),
        sceneId = receipt.idMappings["new-scene"].id;
      // Explicit synthetic setup selection; the import itself preserved the old preferred take.
      if (
        (await db.getAllSnapshot()).collections[0].project.shots[0]
          .selectedSceneId !== ids.oldSceneId
      )
        throw Error("Import changed preferred take without approval.");
      await projects.selectProjectTake({
        collectionId: ids.projectId,
        shotId: ids.shotId,
        sceneId,
      });
      const snapshot = await db.getAllSnapshot(),
        template = snapshot.templates.find(
          (t) => t.name === "Synthetic full ensemble backup template",
        ),
        copy = await db.createDraftFromTemplate(template.id);
      if (
        copy.ensemble.participants[1].character.promptText !==
        template.ensembleDefault.ensemble.participants[1].character.promptText
      )
        throw Error("Template identity changed.");
      return {
        input,
        approval,
        receipt,
        sceneId,
        templateId: template.id,
        templateDraftId: copy.id,
      };
    },
    { ids, input },
  );
  await page.goto(`/#/collections/${ids.projectId}?tab=characters`);
  await page.reload();
  const cast = page.getByRole("region", { name: "Project Cast", exact: true });
  await expect(cast).toContainText("Aya / Base Identity");
  await expect(cast).toContainText("Lucas / Base Identity");
  const script = page.getByRole("region", {
    name: "Project Script",
    exact: true,
  });
  await expect(script).toContainText("Officiant");
  await expect(script).toContainText("Lucas");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => {
    window.__scriptLine = "";
    navigator.clipboard.writeText = async (text) => {
      window.__scriptLine = text;
    };
  });
  await script
    .getByRole("button", { name: "Copy line 01 cue 2", exact: true })
    .click();
  expect(await page.evaluate(() => window.__scriptLine)).toBe(
    exactEnsembleLine,
  );
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: resolve(out, "cast-script-1440.png"),
    fullPage: true,
  });
  const before = await readEnsembleLibrary(page),
    beforeEvidence = await ensembleEvidence(page);
  await page
    .getByRole("button", { name: "Open Settings and ZIP Backup", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Full Backup (.zip)", exact: true })
    .click();
  const download = await downloadPromise,
    archivePath = resolve(out, `synthetic-full-library-${Date.now()}.zip`);
  await download.saveAs(archivePath);
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click();
  const archive = await readFile(archivePath),
    entries = unzipSync(archive);
  expect(Object.keys(entries).length).toBeGreaterThan(before.media.length);
  const exportDownload = page.waitForEvent("download");
  const projectManifest = await page.evaluate(async () => {
    const db = await import("/src/storage/db.ts"),
      ex = await import("/src/domain/projectExport.ts"),
      dl = await import("/src/hooks/useObjectUrl.ts"),
      s = await db.getAllSnapshot();
    if (ex.PROJECT_EXPORT_MEDIA_LIMIT !== 128 * 1024 * 1024)
      throw Error("Project Export limit changed.");
    const result = await ex.buildProjectExport(s.collections[0], s, {
      includeGenerationJson: true,
    });
    dl.downloadBlobAsFile(
      new Blob([result.bytes], { type: "application/zip" }),
      result.filename,
    );
    return result.manifest;
  });
  const pd = await exportDownload,
    projectPath = resolve(out, `synthetic-project-${Date.now()}.zip`);
  await pd.saveAs(projectPath);
  const projectZip = unzipSync(await readFile(projectPath));
  expect(
    projectManifest.associations.some((a) => a.participantId === "primary"),
  ).toBe(true);
  expect(
    projectManifest.associations.some((a) => a.participantId === "lucas"),
  ).toBe(true);
  const guidePaths = projectManifest.associations
    .filter((a) => a.mediaId === ids.guideId)
    .map((a) => a.archivePath);
  expect(guidePaths.length).toBeGreaterThan(1);
  expect(
    guidePaths.every((path) => typeof path === "string" && path.length > 0),
  ).toBe(true);
  expect(new Set(guidePaths).size).toBe(1);
  for (const association of projectManifest.associations) {
    expect(typeof association.archivePath).toBe("string");
    const binary = projectZip[association.archivePath];
    expect(binary).toBeDefined();
    expect(createHash("sha256").update(binary).digest("hex")).toBe(
      beforeEvidence.mediaHashes.find((m) => m.id === association.mediaId)
        .sha256,
    );
  }
  expect(
    projectManifest.shots[0].selectedTake.ensemble.participants,
  ).toHaveLength(2);
  const selected = before.scenes.find((scene) => scene.id === prepared.sceneId),
    promptFiles = projectManifest.shots[0].files;
  for (const [key, mode] of [
    ["prompt", "full"],
    ["structured", "structured"],
    ["compact", "compact"],
  ]) {
    expect(typeof promptFiles[key]).toBe("string");
    expect(Buffer.from(projectZip[promptFiles[key]])).toEqual(
      Buffer.from(selected.outputs[mode], "utf8"),
    );
  }
  const generation = JSON.parse(strFromU8(projectZip[promptFiles.generation]));
  expect(
    generation.participants.find((p) => p.id === "lucas").identity,
  ).toEqual({
    source: "approved_anchor",
    description: "Approved synthetic Lucas anchor.",
  });
  expect(await readEnsembleLibrary(page)).toEqual(before);
  const isolated = await isolatedMcpBrowser();
  let restoredContext = isolated.context;
  try {
    const target = isolated.page;
    await target.goto("/#/");
    await target
      .getByRole("button", {
        name: "Open Settings and ZIP Backup",
        exact: true,
      })
      .click();
    await target.locator("#restore-zip-input").setInputFiles(archivePath);
    await expect(
      target.getByRole("button", {
        name: "Confirm & Replace Current Library",
        exact: true,
      }),
    ).toBeEnabled();
    await target
      .getByRole("button", {
        name: "Confirm & Replace Current Library",
        exact: true,
      })
      .click();
    await expect(
      target.getByRole("button", { name: "Close Settings", exact: true }),
    ).toHaveCount(0);
    expect(await readEnsembleLibrary(target)).toEqual(before);
    expect((await ensembleEvidence(target)).mediaHashes).toEqual(
      beforeEvidence.mediaHashes,
    );
    await restoredContext.close();
    restoredContext = await chromium.launchPersistentContext(isolated.profile, {
      headless: true,
      viewport: { width: 1440, height: 900 },
      baseURL: "http://127.0.0.1:4173",
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    const restarted =
      restoredContext.pages()[0] ?? (await restoredContext.newPage());
    await restarted.goto("/#/");
    await restarted.getByRole("heading", { level: 1 }).first().waitFor();
    expect(await readEnsembleLibrary(restarted)).toEqual(before);
    expect((await ensembleEvidence(restarted)).mediaHashes).toEqual(
      beforeEvidence.mediaHashes,
    );
    const receipt = await restarted.evaluate(async ({ input, approval }) => {
      const api = await import("/src/storage/changeSets.ts"),
        p = await api.previewChangeSet(input, approval);
      return api.applyApprovedChangeSet(p, p.approvedDigest);
    }, prepared);
    expect(receipt).toEqual(prepared.receipt);
    expect(await readEnsembleLibrary(restarted)).toEqual(before);
    const binary = Object.entries(projectZip).filter(([path]) =>
      /\.(png|jpg|jpeg|webp)$/i.test(path),
    );
    expect(binary).toHaveLength(
      new Set(projectManifest.associations.map((a) => a.mediaId)).size,
    );
    await record("backup-restart-project-export", {
      archivePath,
      projectPath,
      compressedBytes: archive.length,
      uncompressedBytes: Object.values(entries).reduce(
        (sum, b) => sum + b.length,
        0,
      ),
      entryCount: Object.keys(entries).length,
      archiveSha256: createHash("sha256").update(archive).digest("hex"),
      projectSha256: createHash("sha256")
        .update(await readFile(projectPath))
        .digest("hex"),
      projectAssociations: projectManifest.associations,
      projectBinaryHashes: binary.map(([path, bytes]) => ({
        path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      })),
      counts: beforeEvidence.counts,
      variants: before.variants.length,
      templates: before.templates.length,
      mediaHashes: beforeEvidence.mediaHashes,
      restoredAllRecordsExact: true,
      restartedActualChromiumProcess: true,
      idempotentReceipt: receipt,
    });
  } finally {
    await restoredContext.close();
  }
});
test("ensemble recipe copies complete outputs and commits a new immutable revision with a parent-bound Outfit", async ({
  page,
}) => {
  const ids = await seedEnsembleBrowser(page),
    before = await readEnsembleLibrary(page),
    hashes = (await ensembleEvidence(page)).mediaHashes,
    input = ensembleBrowserRecipe(ids, { outfit: true });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await fillAndPreview(page, input);
  await chooseOutfitCreate(page);
  const expected = await page.evaluate(async (input) => {
    const api = await import("/src/storage/changeSets.ts"),
      fixture =
        await import("/src/__tests__/fixtures/recipeChangeSetFixture.ts");
    const approval = {
      ...fixture.recipeApproval(),
      variantDecisions: {
        outfit: { action: "create", acknowledgeDuplicate: true },
      },
    };
    const preview = await api.previewChangeSet(input, approval);
    return preview.plan.operations.find((o) => o.operationId === "ensemble")
      .resolved.recipe.outputs;
  }, input);
  await openRecipeOperation(page, "ensemble");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("region", {
      name: "Ensemble participants and cues",
      exact: true,
    }),
  ).toContainText("Lucas / Base Identity");
  await expect(
    dialog.getByRole("textbox", {
      name: "Lucas / Base Identity master identity",
      exact: true,
    }),
  ).not.toBeVisible();
  await page.evaluate(() => {
    window.__ensembleCopies = [];
    const native = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (text) => {
      window.__ensembleCopies.push(text);
      return native(text);
    };
  });
  for (const mode of ["full", "structured", "compact"]) {
    const title = mode[0].toUpperCase() + mode.slice(1);
    await dialog.getByRole("tab", { name: title, exact: true }).click();
    await dialog
      .getByRole("button", { name: `Copy ${title} recipe`, exact: true })
      .click();
    expect(await page.evaluate(() => window.__ensembleCopies.at(-1))).toBe(
      expected[mode],
    );
    expect(expected[mode]).toContain(exactEnsembleLine);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.replaceAll("\r\n", "\n")).toBe(
      expected[mode].replaceAll("\r\n", "\n"),
    );
  }
  await dialog.getByRole("tab", { name: "Full", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("tab", { name: "Structured", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review ensemble", exact: true }),
  ).toBeFocused();
  expect(await readEnsembleLibrary(page)).toEqual(before);
  await approveContent(page);
  await expect(
    page.getByRole("heading", { name: "Import receipt", exact: true }),
  ).toBeVisible();
  const after = await readEnsembleLibrary(page),
    receipt = after.preferences.aiImports.receipts.find(
      (r) => r.changeSetId === input.changeSetId,
    ),
    scene = after.scenes.find(
      (s) => s.id === receipt.idMappings["new-scene"].id,
    ),
    variantId = receipt.idMappings["new-outfit"].variantId;
  expect(scene.ensemble.participants[1].wardrobe.sourceId).toBe(variantId);
  expect(after.variants.find((v) => v.id === variantId)).toMatchObject({
    type: "Outfit",
    parentCharacterId: "lucas",
    reviewStatus: "unreviewed",
  });
  expect(scene.outputs).toEqual(expected);
  expect(scene.sceneRevision).toMatchObject({
    rootSceneId: ids.parentId,
    parentSceneId: ids.parentId,
    sequence: 2,
  });
  for (const old of before.scenes)
    expect(after.scenes.find((s) => s.id === old.id)).toEqual(old);
  expect(after.assets).toEqual(before.assets);
  expect(after.drafts).toEqual(before.drafts);
  expect(after.collections[0].project.shots[0].selectedSceneId).toBe(
    ids.oldSceneId,
  );
  expect((await ensembleEvidence(page)).mediaHashes).toEqual(hashes);
  await page.goto(`/#/output/${scene.id}`);
  await page.getByRole("button", { name: "Show Prompt", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Complete prompt text", exact: true }),
  ).toContainText("SYNTHETIC_PRIVATE_LUCAS_MASTER");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit a Copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Participants (2)", exact: true }),
  ).toBeVisible();
  const revision = (await readEnsembleLibrary(page)).drafts.find(
    (d) => d.sourceSceneId === scene.id,
  );
  expect(revision.ensemble).toEqual(scene.ensemble);
  await record("immutable-outfit-lifecycle", {
    receipt,
    outputHashes: (await ensembleEvidence(page)).scenes.find(
      (s) => s.id === scene.id,
    ).outputHashes,
    mediaHashes: hashes,
    zeroWritesOnPreview: true,
    oldScenesUnchanged: true,
    preferredPreserved: true,
  });
});
test("all recipe rows and ensemble controls fit with alternate native button font metrics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await seedEnsembleBrowser(page);
  await page.goto(`/#/builder/${ids.draftId}`);
  await expect(page.getByTestId("recipe-row")).toHaveCount(7);
  await page.addStyleTag({
    // Reserve 15px as a non-overlay scrollbar would, even on Windows overlay scrollbars.
    content:
      ".recipe-row-main { font-family: Verdana, sans-serif; } .recipe-scroll { padding-right: 33px; }",
  });
  await assertRecipeControlsFit(page);
});
async function assertRecipeControlsFit(page) {
  await recordRecipeLayout(page);
  const pane = await page.locator(".recipe-scroll").boundingBox();
  for (const row of await page.getByTestId("recipe-row").all()) {
    const bounds = await row.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(pane.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(pane.y + pane.height);
  }
  for (const name of ["Participants (2)", "Dialogue cues (2)"]) {
    const bounds = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(pane.y + pane.height);
  }
}
async function recordRecipeLayout(page) {
  const geometry = await page.evaluate(() => {
    const pane = document.querySelector(".recipe-scroll");
    const hint = pane.querySelector(".builder-shot-type .muted-text");
    const row = pane.querySelector(".recipe-row-main");
    const buttons = [...pane.querySelectorAll(".ensemble-toolbar button")];
    return {
      paneBottom: pane.getBoundingClientRect().bottom,
      paneClientWidth: pane.clientWidth,
      scrollbarWidth: pane.offsetWidth - pane.clientWidth,
      hintHeight: hint?.getBoundingClientRect().height,
      rowHeights: [...pane.querySelectorAll('[data-testid="recipe-row"]')].map(
        (e) => e.getBoundingClientRect().height,
      ),
      rowGap: getComputedStyle(pane.querySelector(".recipe-rows")).rowGap,
      nativeButtonFont: getComputedStyle(row).font,
      toolbarBottoms: buttons.map((e) => e.getBoundingClientRect().bottom),
    };
  });
  console.info("KRAKINAI_RECIPE_LAYOUT " + JSON.stringify(geometry));
}
for (const width of [1440, 768, 390, 720])
  test(`ensemble workspace reflows, locks identities and keeps focus at ${width}px`, async ({
    page,
  }) => {
    const height = width === 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    const ids = await seedEnsembleBrowser(page);
    await page.goto(`/#/builder/${ids.draftId}`);
    await expect(page.getByTestId("recipe-row")).toHaveCount(7);
    await expect(
      page.getByRole("button", { name: "Assemble Prompt", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (width === 1440) {
      await recordRecipeLayout(page);
      const rows = await page.getByTestId("recipe-row").evaluateAll((rows) =>
        rows.map((row) => ({
          top: row.getBoundingClientRect().top,
          bottom: row.getBoundingClientRect().bottom,
        })),
      );
      const pane = await page.locator(".recipe-scroll").evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      expect(
        rows.every((row) => row.top >= pane.top && row.bottom <= pane.bottom),
      ).toBe(true);
      for (const name of ["Participants (2)", "Dialogue cues (2)"]) {
        const bounds = await page
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(pane.bottom);
      }
    }
    await mkdir(out, { recursive: true });
    await page.screenshot({
      path: resolve(out, `builder-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Participants (2)", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Close Participants", exact: true })
      .focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Add participant", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close Participants", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: resolve(out, `participants-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit Lucas / Base Identity", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Locked identity", exact: true }),
    ).not.toBeVisible();
    await page.getByText("Full locked identity", { exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Locked identity", exact: true }),
    ).toHaveAttribute("readonly", "");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Participants (2)", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Dialogue cues (2)", exact: true })
      .click();
    await page.screenshot({
      path: resolve(out, `cues-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit cue lucas-reply", exact: true })
      .click();
    await page.getByLabel("Language", { exact: true }).fill("Filipino");
    await page.getByRole("button", { name: "Save cue", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Move cue lucas-reply up",
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Move cue lucas-reply up", exact: true })
      .click();
    await page.keyboard.press("Escape");
    const snapshot = await readEnsembleLibrary(page),
      draft = snapshot.drafts.find((d) => d.id === ids.draftId);
    expect(draft.ensemble.dialogueCues[0]).toMatchObject({
      id: "lucas-reply",
      line: exactEnsembleLine,
      language: "Filipino",
    });
    await record(`layout-${width}`, {
      width,
      height,
      equivalent200PercentReflow: width === 720,
      noHorizontalDocumentOverflow: await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      ...(await ensembleEvidence(page)),
    });
  });
