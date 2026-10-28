// Fresh Playwright context only. Never point this fixture at a user's browser profile.
import { seedOutputWorkspace } from "./output-workspace-fixture.mjs";

export async function seedCinematography(page) {
  const ids = await seedOutputWorkspace(page);
  await page.evaluate(async ({ draftId }) => {
    const db = await import("/src/storage/db.ts");
    const snapshot = await db.getAllSnapshot();
    const draft = snapshot.drafts.find((d) => d.id === draftId);
    draft.slots.camera.promptText = "The camera remains static on a tripod.";
    draft.slots.camera.compactText = "Static tripod camera.";
    draft.slots.camera.overrideText =
      "  Authored Camera baseline.\nKeep this spacing.  ";
    draft.slots.camera.overrideCompactText = " Exact compact baseline. ";
    draft.dialogue = undefined;
    // The reused output-only fixture renames its character asset; keep draft variant ownership valid.
    for (const slot of Object.values(draft.slots)) {
      if (slot.sourceType === "variant")
        slot.parentCharacterId = draft.slots.character.sourceId;
    }
    draft.sceneInstructions = "Preserve the established scene and identity.";
    await db.saveSceneDraft(draft);
    await db.savePromptAsset({
      title: "Synthetic alternate Camera",
      category: "camera",
      promptText: "A smooth lateral tracking view.",
      tags: [],
      mediaLinks: [],
    });
    await db.savePromptAsset({
      title: "Synthetic equivalent composition",
      category: "camera",
      promptText: "Keep empty space alongside the subject.",
      tags: ["leading lines"],
      mediaLinks: [],
    });
    await db.savePromptAsset({
      title: "Synthetic uncertain composition",
      category: "camera",
      promptText: "Avoid rule of thirds.",
      tags: [],
      mediaLinks: [],
    });
  }, ids);
  await page.reload();
  await page.goto(`/#/builder/${ids.draftId}`);
  await page
    .getByRole("heading", { name: "Scene Builder", exact: true })
    .waitFor();
  return ids;
}
export const readLibrary = (page) =>
  page.evaluate(async () => {
    const snapshot = await (
      await import("/src/storage/db.ts")
    ).getAllSnapshot();
    return {
      ...snapshot,
      media: snapshot.media.map(({ blob, ...metadata }) => ({
        ...metadata,
        blobSize: blob.size,
      })),
    };
  });
export const cameraDialog = (page) =>
  page.getByRole("dialog", { name: "Compose Camera directions", exact: true });
export async function openCamera(page) {
  await page
    .getByRole("button", { name: "Compose Camera directions", exact: true })
    .click();
  const dialog = cameraDialog(page);
  await dialog.waitFor();
  return dialog;
}
export async function selectTechnique(dialog, label, name) {
  await dialog
    .getByRole("combobox", { name: label, exact: true })
    .selectOption({ label: name });
}
export async function noOverflow(page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
}
