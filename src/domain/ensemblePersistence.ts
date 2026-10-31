import type { MediaAsset, PromptAsset } from "../types/domain";
import { syncEnsemblePrimary, type EnsembleSource } from "./ensemble";
import { resolveGenerationIdentity } from "./identityAnchors";
import { captureMediaNames } from "./mediaNaming";
/** Existing writers share this synchronous preparation; no data is persisted here. */
export function prepareEnsembleSource<T extends EnsembleSource>(
  source: T,
  assets: readonly PromptAsset[],
  media?: ReadonlyMap<string, MediaAsset>,
): T {
  if (!source.ensemble) return source;
  const next = structuredClone(source);
  for (const p of next.ensemble!.participants) {
    if (media) {
      p.character.mediaLinks = captureMediaNames(p.character.mediaLinks, media);
      if (p.wardrobe)
        p.wardrobe.mediaLinks = captureMediaNames(p.wardrobe.mediaLinks, media);
    }
    if (p.generation) {
      p.generation =
        p.character.sourceType === "asset"
          ? resolveGenerationIdentity(
              { slots: { character: p.character }, generation: p.generation },
              assets.find((a) => a.id === p.character.sourceId),
            ).generation
          : p.generation.identitySource === "approved_anchor"
            ? {
                identitySource: "master",
                fallbackReason:
                  "Bind a stored Character before selecting an approved identity anchor.",
              }
            : structuredClone(p.generation);
    }
  }
  return syncEnsemblePrimary(next);
}
