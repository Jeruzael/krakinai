import {
  seedRecipeBrowser,
  readRecipeLibrary,
  readRecipeEvidence,
  oldRecipeDirectText,
} from "./recipe-change-set-fixture.mjs";
import { expect } from "@playwright/test";
export { readRecipeLibrary as readEnsembleLibrary, oldRecipeDirectText };
export const exactEnsembleLine = "  I do.\r\n😊  ";
export async function seedEnsembleBrowser(page) {
  const ids = await seedRecipeBrowser(page);
  const extra = await page.evaluate(async (ids) => {
    if (
      !["http://127.0.0.1:4173", "http://localhost:4173"].includes(
        location.origin,
      )
    )
      throw Error("Synthetic ensemble seeding requires isolated QA origin.");
    const db = await import("/src/storage/db.ts"),
      fx = await import("/src/__tests__/fixtures/ensemblePlanningFixture.ts"),
      ef = await import("/src/__tests__/fixtures/ensembleFixture.ts"),
      pa = await import("/src/domain/promptAssembler.ts"),
      model = await import("/src/domain/ensemble.ts"),
      author = await import("/src/storage/sceneAuthoring.ts"),
      references = await import("/src/domain/referencePack.ts");
    const before = await db.getAllSnapshot();
    if (
      before.collections.length !== 1 ||
      !before.scenes.some((s) => s.id === ids.oldSceneId) ||
      before.assets.some(
        (a) => !["environment", "action", "camera", "character"].includes(a.id),
      )
    )
      throw Error("Unexpected initial synthetic library; refusing enrichment.");
    const state = fx.ensembleState();
    const portrait = async (name, color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 560;
      const c = canvas.getContext("2d");
      c.fillStyle = "#eff6ff";
      c.fillRect(0, 0, 400, 560);
      c.fillStyle = color;
      c.beginPath();
      c.arc(200, 175, 65, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(200, 382, 125, 155, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      c.font = "bold 23px sans-serif";
      c.textAlign = "center";
      c.fillText(name, 200, 472);
      c.fillStyle = "#0f172a";
      c.font = "18px sans-serif";
      c.fillText("SYNTHETIC QA • FICTIONAL", 200, 530);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("PNG encoding failed.");
      const decoded = await createImageBitmap(blob);
      if (decoded.width !== 400 || decoded.height !== 560)
        throw Error("Invalid PNG fixture.");
      decoded.close();
      return db.saveMediaAsset({
        filename: `synthetic-${name.toLowerCase()}.png`,
        mimeType: "image/png",
        blob,
      });
    };
    const ayaImage = await portrait("AYA", "#4f46e5"),
      lucasImage = await portrait("LUCAS", "#0e7490");
    const guide = await portrait("GUIDE", "#64748b"),
      sourceLinks = (m, alt) => [
        {
          mediaId: m.id,
          role: "reference",
          altText: alt,
          filename: m.filename,
          mimeType: m.mimeType,
          order: 0,
        },
      ];
    for (const asset of state.assets) {
      if (asset.id === "generic-wardrobe")
        asset.mediaLinks = sourceLinks(
          guide,
          "Shared synthetic clothing guide",
        );
      if (asset.category === "characters") {
        asset.promptText +=
          " " +
          `SYNTHETIC_PRIVATE_${asset.id.toUpperCase()}_MASTER: independent fictional adult identity. `.repeat(
            24,
          );
        asset.notes = "SYNTHETIC_PRIVATE_B2_NOTES";
        if (asset.id !== "marco")
          asset.mediaLinks = sourceLinks(
            asset.id === "character" ? ayaImage : lucasImage,
            `Synthetic ${asset.title} portrait`,
          );
      }
      if (asset.id === "environment")
        asset.mediaLinks = sourceLinks(
          guide,
          "Synthetic shared environment guide",
        );
    }
    const lucas = state.assets.find((a) => a.id === "lucas");
    lucas.identityAnchor = {
      text: "Approved synthetic Lucas anchor.",
      approvedText: "Approved synthetic Lucas anchor.",
      approvedAt: "2026-10-01T01:00:00.000Z",
      approvedMasterIdentityRevision: 1,
    };
    for (const v of state.variants)
      v.mediaLinks = sourceLinks(guide, "Shared synthetic clothing guide");
    const base = state.assets.find((a) => a.id === "camera");
    state.assets.push(
      {
        ...base,
        id: "lighting",
        category: "lighting",
        title: "Synthetic soft daylight",
        promptText: "Soft neutral daylight with gentle contrast.",
      },
      {
        ...base,
        id: "style",
        category: "styles",
        title: "Synthetic cinematic realism",
        promptText: "Natural cinematic live-action styling.",
      },
    );
    const connection = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = connection.transaction(["assets", "variants"], "readwrite");
      for (const a of state.assets) tx.objectStore("assets").put(a);
      for (const v of state.variants) tx.objectStore("variants").put(v);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    let draft = ef.ensembleDraft();
    delete draft.id;
    draft.title = "Synthetic ensemble workspace";
    for (const p of draft.ensemble.participants) {
      const asset = state.assets.find((a) => a.id === p.character.sourceId);
      p.character = pa.createSnapshotFromAsset(asset);
      p.wardrobe = pa.createSnapshotFromVariant(
        state.variants.find((v) => v.parentCharacterId === asset.id),
      );
    }
    draft.ensemble.participants[1].generation = {
      identitySource: "approved_anchor",
      anchor: {
        text: lucas.identityAnchor.text,
        approvedAt: lucas.identityAnchor.approvedAt,
        approvedMasterIdentityRevision: 1,
      },
    };
    for (const slot of ["environment", "action", "camera", "lighting", "style"])
      draft.slots[slot] = pa.createSnapshotFromAsset(
        state.assets.find(
          (a) =>
            a.id ===
            {
              environment: "environment",
              action: "action",
              camera: "camera",
              lighting: "lighting",
              style: "style",
            }[slot],
        ),
      );
    draft = model.syncEnsemblePrimary(draft);
    const mediaMap = new Map(
      (await db.getAllSnapshot()).media.map((m) => [m.id, m]),
    );
    draft.referencePack = {
      version: 1,
      entries: references.collectReferenceCandidates(draft, mediaMap),
    };
    draft = await db.saveSceneDraft(draft);
    const projectRevision = (await db.getAllSnapshot()).collections[0].project
      .revision;
    const parent = await author.saveAuthoredScene(draft.id, {
      requestId: "synthetic-b2-parent",
      expectedInputRevision: draft.inputRevision,
      target: {
        collectionId: ids.projectId,
        shotId: ids.shotId,
        expectedProjectRevision: projectRevision,
      },
      selectAsPreferred: false,
    });
    const snapshot = await db.getAllSnapshot();
    const { ENSEMBLE_TEST_PNG_BASE64 } =
        await import("/src/__tests__/fixtures/ensembleStorageFixture.ts"),
      pixelBytes = Uint8Array.from(atob(ENSEMBLE_TEST_PNG_BASE64), (c) =>
        c.charCodeAt(0),
      ),
      pixel = await createImageBitmap(
        new Blob([pixelBytes], { type: "image/png" }),
      );
    if (pixel.width !== 1 || pixel.height !== 1)
      throw Error(
        "New unit PNG fixture did not decode at its declared dimensions.",
      );
    pixel.close();
    return {
      draftId: draft.id,
      parentId: parent.id,
      parentRevision: parent.revision,
      projectRevision: snapshot.collections[0].project.revision,
      ayaImageId: ayaImage.id,
      lucasImageId: lucasImage.id,
      guideId: guide.id,
      inheritedOpaqueGuideId: ids.guideId,
      unitPng: {
        decodable: true,
        bytes: pixelBytes.length,
        sha256: Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", pixelBytes)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      },
      projectName: snapshot.collections[0].name,
    };
  }, ids);
  await page.reload();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  return { ...ids, ...extra };
}
export function ensembleBrowserRecipe(
  ids,
  { id = "synthetic-b2-revision", outfit = false, third = false } = {},
) {
  const recipe = {
    operationId: "ensemble",
    clientRef: "new-scene",
    type: "scene.revise_recipe",
    project: { id: ids.projectId, expectedRevision: ids.projectRevision },
    shot: { id: ids.shotId },
    sceneId: ids.parentId,
    expectedHeadId: ids.parentId,
    title: "Synthetic ensemble revised scene",
    reason: "Synthetic B2 acceptance only",
    ensemble: {
      version: 1,
      participantUpserts: [
        {
          id: "lucas",
          performanceNotes: "Speak with quiet, deliberate confidence.",
          ...(outfit ? { wardrobe: { variant: { ref: "new-outfit" } } } : {}),
        },
      ],
      dialogueCues: [
        {
          id: "officiant",
          speaker: "Officiant",
          mode: "off_screen",
          line: "Lucas, do you take Aya as your wife?",
        },
        {
          id: "lucas-reply",
          speaker: "Lucas",
          mode: "on_camera",
          participantId: "lucas",
          line: exactEnsembleLine,
          language: "Filipino",
          captionPreference: "none",
        },
      ],
    },
  };
  if (third)
    recipe.ensemble.participantUpserts.push({
      id: "marco",
      character: { asset: { id: "marco" }, expectedRevision: 1 },
      presence: "on_camera",
      role: "Witness",
    });
  return {
    schema: "krakinai.change-set.v3",
    changeSetId: id,
    title: "Synthetic B2 ensemble revision",
    source: { kind: "codex", label: "Synthetic ensemble acceptance" },
    operations: [
      ...(outfit
        ? [
            {
              operationId: "outfit",
              clientRef: "new-outfit",
              type: "variant.propose",
              variantType: "Outfit",
              parentCharacterId: "lucas",
              expectedParentRevision: 1,
              title: "Synthetic Lucas ceremonial suit",
              promptText:
                "A charcoal ceremonial suit with a plain ivory pocket square.",
              description: "Synthetic QA only.",
              tags: ["synthetic"],
              notes: "",
            },
          ]
        : []),
      recipe,
    ],
  };
}
export async function chooseOutfitCreate(page, id = "outfit") {
  const summary = page.getByText("Outfit variant decisions (1)", {
    exact: true,
  });
  if (
    !(await page
      .getByRole("combobox", { name: `Outfit decision ${id}`, exact: true })
      .isVisible())
  )
    await summary.click();
  await page
    .getByRole("combobox", { name: `Outfit decision ${id}`, exact: true })
    .selectOption("create");
  await expect(
    page.getByRole("combobox", { name: `Outfit decision ${id}`, exact: true }),
  ).toHaveValue("create");
  const duplicate = page.getByLabel(
    `Create separate Outfit despite matches (${id})`,
    { exact: true },
  );
  if (await duplicate.isVisible()) await duplicate.check();
}
export async function ensembleEvidence(page) {
  const common = await readRecipeEvidence(page),
    extra = await page.evaluate(async () => {
      const s = await (await import("/src/storage/db.ts")).getAllSnapshot(),
        hash = async (text) =>
          Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(text),
              ),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
      return {
        variants: s.variants.length,
        scenes: await Promise.all(
          s.scenes.map(async (scene) => ({
            id: scene.id,
            participants: scene.ensemble?.participants.map((p) => ({
              id: p.id,
              sourceId: p.character.sourceId,
              wardrobeId: p.wardrobe?.sourceId,
            })),
            cues: scene.ensemble?.dialogueCues.map((c) => ({
              id: c.id,
              participantId: c.participantId,
              mode: c.mode,
            })),
            outputHashes: Object.fromEntries(
              await Promise.all(
                Object.entries(scene.outputs).map(async ([mode, text]) => [
                  mode,
                  await hash(text),
                ]),
              ),
            ),
          })),
        ),
        imageDecoding: await Promise.all(
          s.media
            .filter((m) => m.mimeType.startsWith("image/"))
            .map(async (m) => {
              const inherited = [
                "synthetic-b1-guide.png",
                "synthetic-b1-original.png",
              ].includes(m.filename);
              try {
                const image = await createImageBitmap(m.blob),
                  result = {
                    id: m.id,
                    decodable: true,
                    fixtureClass: inherited
                      ? "inherited_legacy_byte_fixture"
                      : "generated_png",
                    width: image.width,
                    height: image.height,
                  };
                image.close();
                return result;
              } catch {
                if (!inherited)
                  throw Error("A new synthetic PNG failed browser decoding.");
                return {
                  id: m.id,
                  decodable: false,
                  fixtureClass: "inherited_opaque_png_labelled_bytes",
                };
              }
            }),
        ),
        quota: await navigator.storage.estimate(),
      };
    });
  return { ...common, ...extra };
}
