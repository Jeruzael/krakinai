import { beforeEach, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import {
  clearAllStoresForTesting,
  initializeDatabase,
  saveSceneDraft,
  createCollection,
  getAllSnapshot,
} from "../storage/db";
import {
  createDirectPromptDraft,
  saveAuthoredScene,
} from "../storage/sceneAuthoring";
import { addProjectShot } from "../storage/projects";
import { serializeSceneJson } from "../domain/sceneDocument";
import { serializeGenerationJson } from "../domain/generationDocument";
import { buildProjectExport } from "../domain/projectExport";
const exact =
  ' \r\n# A title-like prefix\r\n\r\n“Dito tayo.” 😊 e\u0301\r\n{"negative":"Do not invent labels."}  ';
const hash = async (value: string | Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : Uint8Array.from(value),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
beforeEach(async () => {
  await clearAllStoresForTesting();
  await initializeDatabase();
});
it("exports honestly identified direct JSON without invented assembled formats", async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "MIDORI",
    shotType: "graphic_motion",
    directPrompt: { version: 1, text: exact, origin: "chatgpt" },
    pendingInputs: [
      { version: 1, id: "plan", kind: "source_image", label: "Floor plan" },
    ],
  });
  const scene = await saveAuthoredScene(draft.id, {
    requestId: "json",
    expectedInputRevision: draft.inputRevision,
  });
  for (const json of [
    serializeSceneJson(scene),
    serializeGenerationJson(scene),
  ]) {
    const parsed = JSON.parse(json);
    expect(parsed.authoringMode).toBe("direct_prompt");
    expect(parsed.directPrompt.text).toBe(exact);
    expect(await hash(parsed.directPrompt.text)).toBe(await hash(exact));
    expect(parsed.pendingInputs).toHaveLength(1);
    expect(parsed.sceneRevision.rootSceneId).toBe(scene.id);
    expect(parsed.outputs?.structured).toBeUndefined();
  }
});
it("exports exact direct prompt.txt with no fabricated structured/compact files and keeps planned shots", async () => {
  let draft = await createDirectPromptDraft();
  draft = await saveSceneDraft({
    ...draft,
    title: "MIDORI",
    directPrompt: { version: 1, text: exact },
  });
  const scene = await saveAuthoredScene(draft.id, {
    requestId: "zip",
    expectedInputRevision: draft.inputRevision,
  });
  const c = await createCollection({ name: "MIDORI" });
  await addProjectShot({
    collectionId: c.id,
    title: "Saved",
    sceneId: scene.id,
  });
  const project = await addProjectShot({
    collectionId: c.id,
    title: "Planned only",
  });
  const result = await buildProjectExport(project, await getAllSnapshot(), {
    includeGenerationJson: true,
  });
  const entries = unzipSync(result.bytes);
  const prompt = Object.entries(entries).find(([name]) =>
    name.endsWith("/prompt.txt"),
  )![1];
  expect(await hash(prompt)).toBe(await hash(exact));
  expect(strFromU8(prompt)).toBe(exact);
  expect(
    Object.keys(entries).some((n) => /\/(?:structured|compact)\.txt$/.test(n)),
  ).toBe(false);
  expect(result.manifest.shots).toHaveLength(2);
  expect(result.manifest.shots[0].files?.structured).toBeUndefined();
  expect(result.manifest.shots[1].files).toBeUndefined();
});
