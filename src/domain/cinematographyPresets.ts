import type { PromptAsset } from "../types/domain";
import {
  searchCinematography,
  normalizeTechniqueSearch,
  getCinematographyTechnique,
} from "./cinematographyRegistry";
export interface CinematographyCorePreset {
  techniqueId: string;
  assetId: string;
  title: string;
  promptText: string;
  aliases: string[];
}
export interface CinematographyPresetPreview {
  preset: CinematographyCorePreset;
  state: "available" | "existing" | "ambiguous";
  matchingAssetIds: string[];
  reason: string;
}
export const CINEMATOGRAPHY_CORE_PACK_VERSION = "1";
export const CINEMATOGRAPHY_CORE_PRESETS: CinematographyCorePreset[] = [
  ["cowboy", "Cowboy / American shot"],
  ["big_close", "Big close-up (BCU)"],
  ["thirds", "Rule of thirds"],
  ["leading_lines", "Leading lines"],
  ["negative_space", "Negative space"],
  ["look_room", "Look room / nose room"],
  ["deep_focus", "Deep focus"],
  ["source_locked", "Source-locked composition"],
].map(([code, name]) => {
  const technique = searchCinematography(name).find((t) => t.name === name);
  if (!technique) throw new Error(`Core technique missing: ${name}`);
  return {
    techniqueId: technique.id,
    assetId: `asset_cine_core_v1_${code}`,
    title: technique.name,
    promptText: `${technique.direction}\nKeep independent Character, Clothing, Environment, Action, Lighting and Style choices unchanged.`,
    aliases:
      code === "look_room"
        ? ["look room", ...technique.aliases]
        : technique.aliases,
  };
});
const equivalentPatterns: Record<string, RegExp> = {
  cowboy: /\b(?:frame|crop|framing|shot)\b[^.;\n]{0,45}\bmid[- ]thigh\b/i,
  big_close: /\bvery\s+tight\s+(?:facial|face)\s+(?:crop|framing|close)/i,
  thirds: /\b(?:three[- ]by[- ]three|3[x×]3)\b[^.;\n]{0,45}\bgrid\b/i,
  leading_lines:
    /\b(?:lines|edges)\b[^.;\n]{0,45}\b(?:guide|lead)\b[^.;\n]{0,30}\b(?:eye|attention|subject|focal)\b/i,
  negative_space: /\b(?:empty|unoccupied|negative)\s+(?:space|area)\b/i,
  look_room:
    /\bleave\b[^.;\n]{0,30}\bspace\b[^.;\n]{0,30}\b(?:looks?|facing|gaze)\b/i,
  deep_focus:
    /\b(?:everything|all\s+(?:focal\s+)?planes)\b[^.;\n]{0,90}\b(?:sharp|in focus)\b|\b(?:foreground|near)\b[^.;\n]{0,60}\b(?:background|far)\b[^.;\n]{0,30}\bsimultaneously\b[^.;\n]{0,20}\b(?:sharp|in focus)\b/i,
  source_locked:
    /\b(?:original|source)\b[^.;\n]{0,60}\b(?:diagram|graphic|image)\b[^.;\n]{0,50}\b(?:fixed|unchanged|locked)\b/i,
};
const negated = (text: string, at: number) =>
  /\b(?:no|not|never|without|avoid|don't|doesn't|isn't)\b/i.test(
    text.slice(0, at),
  );
function match(
  preset: CinematographyCorePreset,
  asset: PromptAsset,
): "positive" | "mention" | undefined {
  if (asset.id === preset.assetId) return "positive";
  const phrases = [preset.title, ...preset.aliases]
      .map(normalizeTechniqueSearch)
      .filter(Boolean),
    fields = [
      asset.title,
      asset.promptText,
      asset.compactText ?? "",
      asset.description ?? "",
      ...asset.tags,
      asset.notes ?? "",
    ];
  const canonicalDirection = normalizeTechniqueSearch(
    getCinematographyTechnique(preset.techniqueId)!.direction,
  );
  let mentioned = false;
  const semantic =
    equivalentPatterns[preset.assetId.slice("asset_cine_core_v1_".length)];
  for (const field of fields) {
    const normalizedField = ` ${normalizeTechniqueSearch(field)} `;
    const canonicalAt = normalizedField.indexOf(` ${canonicalDirection} `);
    if (canonicalAt >= 0) {
      mentioned = true;
      if (!negated(normalizedField, canonicalAt)) return "positive";
    }
    for (const clause of field.split(/[.;\n]|\bbut\b/i)) {
      const normalized = ` ${normalizeTechniqueSearch(clause)} `;
      for (const phrase of phrases) {
        const index = normalized.indexOf(` ${phrase} `);
        if (index < 0) continue;
        mentioned = true;
        if (!negated(normalized, index)) return "positive";
      }
      if (semantic) {
        // Temporal focus changes do not establish simultaneous near/far sharpness.
        const deep = preset.assetId.endsWith("_deep_focus");
        const temporal =
          /\b(?:rack|pull|transition|shift|until|then|defocus\w*|blur\w*)\b/i.test(
            clause,
          );
        if (deep && temporal) continue;
        const found = semantic.exec(clause);
        if (found) {
          mentioned = true;
          if (!negated(clause, found.index)) return "positive";
        }
        if (deep) {
          const depth =
            /\b(?:foreground|near)\b[^.;\n]{0,60}\b(?:background|far)\b[^.;\n]{0,35}\b(?:sharp|in focus)\b/i.exec(
              clause,
            );
          if (depth) {
            mentioned = true;
            if (
              !negated(clause, depth.index) &&
              /\b(?:keep|maintain|both|throughout|together)\b/i.test(clause)
            )
              return "positive";
          }
        }
      }
    }
  }
  return mentioned ? "mention" : undefined;
}
export function previewCinematographyCorePresets(
  assets: PromptAsset[],
): CinematographyPresetPreview[] {
  const camera = assets.filter((a) => a.category === "camera");
  return CINEMATOGRAPHY_CORE_PRESETS.map((preset) => {
    const found = camera
        .map((asset) => ({ asset, result: match(preset, asset) }))
        .filter((v) => v.result),
      positive = found.filter((v) => v.result === "positive");
    return {
      preset,
      state: positive.length
        ? "existing"
        : found.length
          ? "ambiguous"
          : "available",
      matchingAssetIds: (positive.length ? positive : found).map(
        (v) => v.asset.id,
      ),
      reason: positive.length
        ? "An existing asset or equivalent positive Camera direction is present; it will not be replaced."
        : found.length
          ? "Only a negated or uncertain mention was found. Review it manually; automatic installation skips this entry."
          : "No equivalent positive Camera content was found in title, prompt, compact text, description, tags or notes.",
    };
  });
}
