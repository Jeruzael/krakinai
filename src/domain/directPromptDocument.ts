import type { SceneDocumentSource } from "./sceneDocument";
import { isDirectPrompt, validateSceneAuthoring } from "./directPrompt";

/** Direct JSON describes authored source. It is not a recipe or provider request. */
export function buildDirectPromptDocument(
  source: SceneDocumentSource,
  kind: "scene" | "generation" = "scene",
) {
  if (!isDirectPrompt(source))
    throw new Error("Direct Prompt content is required.");
  const error = validateSceneAuthoring(source);
  if (error) throw new Error(error);
  return {
    schema:
      kind === "scene"
        ? "krakinai.direct-scene-prompt.v1"
        : "krakinai.direct-generation-prompt.v1",
    authoringMode: "direct_prompt" as const,
    title: source.title,
    directPrompt: structuredClone(source.directPrompt),
    ...(source.shotType !== undefined ? { shotType: source.shotType } : {}),
    settings: structuredClone(source.settings),
    outputs: { full: source.directPrompt.text },
    unavailableFormats: ["structured", "compact", "provider_presets"],
    references: structuredClone(
      source.references ?? source.directReferences ?? [],
    ),
    ...(source.sourceMediaLinks
      ? { sourceMediaLinks: structuredClone(source.sourceMediaLinks) }
      : {}),
    ...(source.referencePack
      ? { referencePack: structuredClone(source.referencePack) }
      : {}),
    ...(source.pendingInputs
      ? { pendingInputs: structuredClone(source.pendingInputs) }
      : {}),
    ...(source.claimNotes !== undefined
      ? { claimNotes: source.claimNotes }
      : {}),
    ...(source.sceneRevision
      ? { sceneRevision: structuredClone(source.sceneRevision) }
      : {}),
    ...(source.sourceSceneId ? { sourceSceneId: source.sourceSceneId } : {}),
    ...(Object.keys(source.slots).length
      ? { sourceContextSnapshots: structuredClone(source.slots) }
      : {}),
    readiness: {
      status: "not_evaluated",
      notice:
        "Stored associations and pending inputs are declared metadata. Recheck current media in KRAKINAI before generation. Copying text does not upload files or verify factual claims.",
    },
  };
}
