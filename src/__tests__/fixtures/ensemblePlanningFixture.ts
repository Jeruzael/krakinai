import type { ChangeSetState } from "../../types/changeSet";
import type { SavedScene, Variant } from "../../types/domain";
import { recipeState, recipeTime } from "./recipeChangeSetFixture";
import { ensembleDraft, actor } from "./ensembleFixture";
import { assembleScenePrompt } from "../../domain/promptAssembler";
export function ensembleState(): ChangeSetState {
  const s = recipeState(),
    base = s.assets.find((a) => a.category === "characters")!;
  s.assets = s.assets.filter((a) => a.category !== "characters");
  for (const [id, name] of [
    ["character", "Aya"],
    ["lucas", "Lucas"],
    ["marco", "Marco"],
  ]) {
    const p = actor(id, name);
    s.assets.push({
      ...base,
      id,
      title: p.sourceTitle,
      promptText: p.promptText,
      identityRevision: 1,
    });
  }
  s.assets.push({
    ...base,
    id: "generic-wardrobe",
    category: "wardrobe",
    title: "Generic formal clothing",
    promptText: "Formal neutral clothing.",
  });
  s.variants = ["character", "lucas", "marco"].map(
    (id, i) =>
      ({
        id: i === 0 ? "aya-outfit" : `${id}-suit`,
        parentCharacterId: id,
        type: "Outfit",
        targetSlot: "wardrobe",
        title: `${id} Outfit`,
        description: "Synthetic",
        promptText: i === 0 ? "A white bridal gown." : `A ${id} formal suit.`,
        tags: ["formal"],
        mediaLinks: [],
        favorite: false,
        reviewStatus: "unreviewed",
        notes: "",
        revision: 1,
        createdAt: recipeTime,
        updatedAt: recipeTime,
      }) as Variant,
  );
  return s;
}
export function ensembleParentState(): ChangeSetState {
  const s = ensembleState(),
    d = ensembleDraft(),
    r = assembleScenePrompt(d);
  const scene = {
    ...d,
    id: "ensemble-parent",
    outputs: r.outputs,
    references: r.references,
    revision: 1,
    createdAt: recipeTime,
    sceneRevision: {
      version: 1,
      rootSceneId: "ensemble-parent",
      sequence: 1,
      createdAt: recipeTime,
    },
  } as SavedScene;
  s.scenes = [scene];
  const shot = s.collections[0].project!.shots[0];
  shot.takeSceneIds = [scene.id];
  shot.selectedSceneId = scene.id;
  shot.status = "prompt_ready";
  return s;
}
