import { seedCinematography } from "./cinematography-fixture.mjs";
export const ORIGINAL_DIRECT_PROMPT =
  '  # MIDORI — Shot 05\r\n\r\n“Dito ang ating tahanan—tara na!” 😊 e\u0301\r\n\tKeep the exact architecture.\r\n{"negative":"Do not invent labels, amenities or prices."}  ';
export async function seedDirectPrompt(
  page,
  { saved = false, project = false, source = false, reference = false } = {},
) {
  const legacy = await seedCinematography(page);
  const ids = await page.evaluate(
    async ({ text, saved, project, source, reference }) => {
      const db = await import("/src/storage/db.ts"),
        a = await import("/src/storage/sceneAuthoring.ts"),
        projects = await import("/src/storage/projects.ts");
      const initial = await db.getAllSnapshot(),
        media = initial.media[0];
      let draft = await a.createDirectPromptDraft();
      draft = await db.saveSceneDraft({
        ...draft,
        title: "MIDORI — Living Room Reveal",
        shotType: source ? "graphic_motion" : "property_environment",
        directPrompt: { version: 1, text, origin: "chatgpt" },
        settings: { aspectRatio: "9:16", durationSeconds: 8 },
        ...(reference
          ? {
              directReferences: [
                {
                  mediaId: media.id,
                  role: "reference",
                  altText: "Original guide",
                  filename: media.filename,
                  mimeType: media.mimeType,
                  order: 0,
                },
              ],
            }
          : {}),
        ...(source
          ? {
              sourceMediaLinks: [
                {
                  mediaId: media.id,
                  role: "reference",
                  altText: "Original source image",
                  filename: media.filename,
                  mimeType: media.mimeType,
                  order: 0,
                },
              ],
            }
          : {}),
      });
      const scene = saved
        ? await a.saveAuthoredScene(draft.id, {
            requestId: "fixture-original",
            expectedInputRevision: draft.inputRevision,
          })
        : undefined;
      let collection, shot, drama, dramaDraft;
      if (project) {
        collection = await db.createCollection({ name: "MIDORI" });
        collection = await projects.addProjectShot({
          collectionId: collection.id,
          title: "05 Living Room",
          ...(scene ? { sceneId: scene.id } : {}),
          plannedShotType: source ? "graphic_motion" : "property_environment",
        });
        shot = collection.project.shots[0];
        for (let i = 1; i < 15; i++)
          collection = await projects.addProjectShot({
            collectionId: collection.id,
            title: `Planned ${i + 1}`,
          });
        drama = await db.createCollection({ name: "Fictional Drama" });
        drama = await projects.addProjectShot({
          collectionId: drama.id,
          title: "Unrelated opening",
        });
        dramaDraft = await a.createDirectPromptDraft();
        dramaDraft = await db.saveSceneDraft({
          ...dramaDraft,
          title: "Drama untouched",
          directPrompt: { version: 1, text: "A fictional drama scene." },
        });
      }
      return {
        draftId: draft.id,
        sceneId: scene?.id,
        mediaId: media.id,
        collectionId: collection?.id,
        shotId: shot?.id,
        dramaId: drama?.id,
        dramaDraftId: dramaDraft?.id,
        assetCount: initial.assets.length,
      };
    },
    { text: ORIGINAL_DIRECT_PROMPT, saved, project, source, reference },
  );
  await page.reload();
  return {
    ...legacy,
    ...ids,
    legacyDraftId: legacy.draftId,
    legacySceneId: legacy.sceneId,
  };
}
export const readDirectLibrary = (page) =>
  page.evaluate(async () => {
    const s = await (await import("/src/storage/db.ts")).getAllSnapshot();
    return {
      ...s,
      media: s.media.map(({ blob, posterBlob, ...m }) => ({
        ...m,
        blobSize: blob.size,
      })),
    };
  });
export const projectQuery = (ids) =>
  `?collection=${encodeURIComponent(ids.collectionId)}&shot=${encodeURIComponent(ids.shotId)}&takeTarget=1&tab=storyboard`;
export async function pasteOriginal(page, text) {
  await page
    .getByRole("textbox", { name: "Complete Prompt", exact: true })
    .evaluate((element, value) => {
      element.focus();
      element.select();
      const data = new DataTransfer();
      data.setData("text/plain", value);
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
}
