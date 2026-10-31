import { it, expect } from "vitest";
import {
  getProjectCast,
  getWardrobeContinuity,
  getProjectDialogue,
  formatProjectScript,
  getProjectDialogueRowKey,
  getUnboundProjectParticipants,
} from "../domain/projectContinuity";
import { ensembleDraft } from "./fixtures/ensembleFixture";
import { recipeState, recipeTime } from "./fixtures/recipeChangeSetFixture";
import { assembleScenePrompt } from "../domain/promptAssembler";
import type { SavedScene, Collection } from "../types/domain";
import { sceneDuplicateKey } from "../domain/sceneDuplicates";
function fixture() {
  const d = ensembleDraft(),
    r = assembleScenePrompt(d),
    scene = {
      ...d,
      id: "ensemble-take",
      outputs: r.outputs,
      references: r.references,
      revision: 1,
      createdAt: recipeTime,
      updatedAt: recipeTime,
    } as SavedScene;
  const collection = {
    ...recipeState().collections[0],
    project: {
      ...recipeState().collections[0].project!,
      shots: [
        {
          id: "a",
          order: 0,
          code: "01",
          title: "Vows",
          takeSceneIds: [scene.id],
          selectedSceneId: scene.id,
          status: "prompt_ready",
        },
      ],
    },
  } as Collection;
  return { scene, collection };
}
it("binds duplicate and retry content to secondary identities even when manually retained output text is identical", () => {
  const { scene } = fixture(),
    next = structuredClone(scene);
  next.ensemble!.participants[1].character.sourceId = "different-character";
  next.ensemble!.participants[1].wardrobe!.parentCharacterId =
    "different-character";
  expect(next.outputs).toEqual(scene.outputs);
  expect(sceneDuplicateKey(next)).not.toBe(sceneDuplicateKey(scene));
});
it("derives both actual Characters and compares wardrobe by Character across participant IDs", () => {
  const { scene, collection } = fixture();
  const next = structuredClone(scene);
  next.id = "next";
  next.ensemble!.participants[1].id = "groom";
  next.ensemble!.participants[1].wardrobe!.promptText = "Changed groom suit.";
  next.ensemble!.dialogueCues[1].participantId = "groom";
  collection.project!.shots.push({
    ...collection.project!.shots[0],
    id: "b",
    order: 1,
    code: "02",
    takeSceneIds: [next.id],
    selectedSceneId: next.id,
  });
  expect(
    getProjectCast(collection, [scene, next], []).map((r) => r.characterId),
  ).toEqual(["character", "lucas"]);
  const rows = getWardrobeContinuity(collection, [scene, next]);
  expect(rows.map((r) => [r.characterId, r.changed])).toEqual([
    ["character", false],
    ["lucas", false],
    ["character", false],
    ["lucas", true],
  ]);
});
it("never invents Character Bible identities from frozen template sources", () => {
  const { scene, collection } = fixture();
  scene.ensemble!.participants[1].character.sourceType = "template";
  expect(
    getProjectCast(collection, [scene], []).map((r) => r.characterId),
  ).toEqual(["character"]);
  expect(getUnboundProjectParticipants(collection, [scene])).toMatchObject([
    {
      shotId: "a",
      participantId: "lucas",
      name: "Lucas / Base Identity",
      sourceId: "lucas",
    },
  ]);
});
it("keeps exact cue order/text, unique keys and one duration/shot heading even with a take reused in two shots", () => {
  const { scene, collection } = fixture();
  collection.project!.shots.push({
    ...collection.project!.shots[0],
    id: "b",
    order: 1,
    code: "02",
  });
  const before = JSON.stringify({ scene, collection }),
    rows = getProjectDialogue(collection, [scene]),
    script = formatProjectScript(collection, [scene]);
  expect(rows.map((r) => r.exactLine)).toEqual(
    [...scene.ensemble!.dialogueCues, ...scene.ensemble!.dialogueCues].map(
      (c) => c.line,
    ),
  );
  expect(new Set(rows.map(getProjectDialogueRowKey)).size).toBe(4);
  expect(rows[1]).toMatchObject({
    cueId: "lucas-reply",
    participantId: "lucas",
  });
  expect(script.split("## 01 Vows")).toHaveLength(2);
  expect(script.split("## 02 Vows")).toHaveLength(2);
  expect(script.split("Intended duration:")).toHaveLength(3);
  expect(script.split("  I do.\r\n😊  ")).toHaveLength(3);
  expect(JSON.stringify({ scene, collection })).toBe(before);
});
