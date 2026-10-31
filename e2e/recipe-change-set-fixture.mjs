import { readDirectLibrary } from "./direct-prompt-fixture.mjs";
export const readRecipeLibrary = readDirectLibrary;
export const oldRecipeDirectText =
  "  FROZEN SYNTHETIC DIRECT PROMPT\r\nPreserve the previous take. 😊  ";
export async function seedRecipeBrowser(page) {
  await page.goto("/#/");
  const ids = await page.evaluate(async (oldText) => {
    const db = await import("/src/storage/db.ts"),
      fixture =
        await import("/src/__tests__/fixtures/recipeChangeSetFixture.ts"),
      authoring = await import("/src/storage/sceneAuthoring.ts");
    await db.initializeDatabase();
    const initial = await db.getAllSnapshot();
    if (
      initial.assets.length ||
      initial.scenes.length ||
      initial.collections.length ||
      initial.media.length ||
      initial.drafts.length
    )
      throw Error(
        "Refusing to seed a nonempty browser library. Use a fresh isolated QA profile.",
      );
    const state = fixture.recipeState();
    state.assets.find((a) => a.id === "character").promptText +=
      " PRIVATE_B1_IDENTITY_SENTINEL";
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGFEAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const guide = await db.saveMediaAsset({
        filename: "synthetic-b1-guide.png",
        mimeType: "image/png",
        blob: new Blob([png], { type: "image/png" }),
      }),
      original = await db.saveMediaAsset({
        filename: "synthetic-b1-original.png",
        mimeType: "image/png",
        blob: new Blob([png], { type: "image/png" }),
      });
    for (const id of ["environment", "character"])
      state.assets.find((a) => a.id === id).mediaLinks = [
        {
          mediaId: guide.id,
          role: "reference",
          altText: `Synthetic ${id} guide`,
          filename: guide.filename,
          mimeType: guide.mimeType,
          order: 0,
        },
      ];
    const connection = await db.openDatabase();
    await new Promise((resolve, reject) => {
      const tx = connection.transaction(["assets", "collections"], "readwrite");
      for (const a of state.assets) tx.objectStore("assets").put(a);
      for (const c of state.collections) tx.objectStore("collections").put(c);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    let draft = await authoring.createDirectPromptDraft();
    draft = await db.saveSceneDraft({
      ...draft,
      title: "Synthetic old Direct take",
      shotType: "property_environment",
      directPrompt: { version: 1, text: oldText, origin: "manual" },
      directReferences: [
        {
          mediaId: guide.id,
          role: "reference",
          altText: "Keep the old guide association",
          order: 0,
        },
      ],
    });
    const old = await authoring.saveAuthoredScene(draft.id, {
      requestId: "synthetic-b1-old",
      expectedInputRevision: draft.inputRevision,
      target: {
        collectionId: "project",
        shotId: "shot",
        expectedProjectRevision: 1,
      },
      selectAsPreferred: true,
    });
    const snapshot = await db.getAllSnapshot();
    return {
      projectId: "project",
      shotId: "shot",
      projectRevision: snapshot.collections[0].project.revision,
      oldSceneId: old.id,
      oldDraftId: draft.id,
      guideId: guide.id,
      originalId: original.id,
    };
  }, oldRecipeDirectText);
  await page.reload();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  return ids;
}
export async function openRecipeOperation(page, id = "recipe") {
  const button = page.getByRole("button", {
    name: "Review " + id,
    exact: true,
  });
  if (!(await button.isVisible()))
    await page
      .locator("details.import-group > summary")
      .filter({ hasText: /^Scenes/ })
      .click();
  await button.click();
}
export function browserRecipe(
  ids,
  { character = false, id = "synthetic-browser-recipe" } = {},
) {
  return {
    schema: "krakinai.change-set.v2",
    changeSetId: id,
    source: { kind: "codex", label: "Synthetic B1 acceptance" },
    title: "Synthetic B1 recipe proposal",
    operations: [
      {
        operationId: "recipe",
        type: "scene.create_recipe",
        clientRef: "recipe",
        project: { id: ids.projectId, expectedRevision: ids.projectRevision },
        shot: { id: ids.shotId },
        title: "Synthetic Courtyard Recipe",
        shotType: character ? "character_scene" : "property_environment",
        settings: { aspectRatio: "16:9", durationSeconds: 4 },
        assetRefs: [
          {
            asset: { id: "environment" },
            slot: "environment",
            expectedRevision: 2,
          },
          ...(character
            ? [
                {
                  asset: { id: "character" },
                  slot: "character",
                  expectedRevision: 1,
                },
                {
                  asset: { id: "action" },
                  slot: "action",
                  expectedRevision: 1,
                },
              ]
            : []),
          { asset: { id: "camera" }, slot: "camera", expectedRevision: 1 },
        ],
        sceneInstructions:
          "Keep the original geometry and established continuity.",
      },
    ],
  };
}
export function candidateRecipe(ids) {
  const input = browserRecipe(ids, {
      character: true,
      id: "synthetic-candidate-recipe",
    }),
    scene = input.operations[0];
  scene.assetRefs = [
    { asset: { id: "camera" }, slot: "camera", expectedRevision: 1 },
    ...["character", "environment", "action"].map((slot) => ({
      slot,
      asset: { ref: "new-" + slot },
    })),
  ];
  input.operations = [
    ...["character", "environment", "action"].map((kind) => ({
      operationId: "new-" + kind,
      type: "asset.propose",
      clientRef: "new-" + kind,
      kind,
      title: "Synthetic proposed " + kind,
      promptText:
        kind === "character"
          ? "An adult fictional guide with round glasses."
          : kind === "environment"
            ? "A sunken conservatory lined with ferns."
            : "Welcome the arriving visitor with an open palm.",
      tags: ["synthetic"],
    })),
    scene,
  ];
  return input;
}
export async function beginWriteObservation(page) {
  await page.evaluate(() => {
    window.__recipeWrites = [];
    for (const method of ["add", "put", "delete", "clear"]) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        window.__recipeWrites.push({ store: this.name, method });
        return original.apply(this, args);
      };
    }
  });
}
export async function observedWrites(page) {
  return page.evaluate(() => window.__recipeWrites ?? []);
}
export async function readRecipeEvidence(page) {
  return page.evaluate(async () => {
    const snapshot = await (
      await import("/src/storage/db.ts")
    ).getAllSnapshot();
    const hashes = await Promise.all(
      snapshot.media.map(async (media) => ({
        id: media.id,
        sha256: Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await media.blob.arrayBuffer(),
            ),
          ),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
      })),
    );
    return {
      scenes: snapshot.scenes.map((s) => ({
        id: s.id,
        authoringMode: s.authoringMode,
        outputs: s.outputs,
        slotIds: Object.fromEntries(
          Object.entries(s.slots).map(([slot, component]) => [
            slot,
            { id: component.sourceId, revision: component.sourceRevision },
          ]),
        ),
      })),
      counts: {
        assets: snapshot.assets.length,
        scenes: snapshot.scenes.length,
        projects: snapshot.collections.length,
        drafts: snapshot.drafts.length,
        media: snapshot.media.length,
      },
      preferredTake:
        snapshot.collections[0]?.project?.shots[0]?.selectedSceneId,
      mediaHashes: hashes,
    };
  });
}
