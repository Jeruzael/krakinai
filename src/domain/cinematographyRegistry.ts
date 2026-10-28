import type { ShotType } from "../types/domain";
import { CATALOG_FAMILIES, CATALOG_TECHNIQUES } from "./cinematographyCatalog";
export type CinematographyFamilyId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O";
export type TechniqueOwner = "camera" | "lighting" | "styles" | "storyboard";
export type CameraDimension =
  | "shotSize"
  | "height"
  | "angle"
  | "orientation"
  | "framing"
  | "composition"
  | "movement"
  | "lens"
  | "focus"
  | "capture"
  | "rig"
  | "specialized"
  | "property"
  | "graphics";
export interface CinematographyTechnique {
  id: string;
  name: string;
  aliases: string[];
  family: CinematographyFamilyId;
  description: string;
  direction: string;
  owner: TechniqueOwner;
  kind: "technique" | "parameter" | "related";
  method: "capture" | "editing" | "simulation" | "planning";
  shotTypes: ShotType[];
  dimension?: CameraDimension;
  propertyRecommended: boolean;
  guidance: string;
  priority: "P0" | "P1" | "P2" | "P3";
  motionKind?: "static" | "rotation" | "translation" | "optical" | "compound";
  focusKind?: "fixed" | "transition";
}
export interface CinematographyFilters {
  family?: CinematographyFamilyId;
  shotType?: ShotType;
  owner?: TechniqueOwner;
  propertyRecommended?: boolean;
}
export const CINEMATOGRAPHY_FAMILIES: {
  id: CinematographyFamilyId;
  name: string;
}[] = [...CATALOG_FAMILIES];
export const CINEMATOGRAPHY_TECHNIQUES: CinematographyTechnique[] =
  CATALOG_TECHNIQUES;
export function normalizeTechniqueSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const byId = new Map(CINEMATOGRAPHY_TECHNIQUES.map((t) => [t.id, t]));
const searchIndex = CINEMATOGRAPHY_TECHNIQUES.map((technique, index) => ({
  technique,
  index,
  names: [technique.name, ...technique.aliases].map(normalizeTechniqueSearch),
  text: normalizeTechniqueSearch(
    [
      technique.name,
      ...technique.aliases,
      technique.description,
      technique.guidance,
    ].join(" "),
  ),
}));
export function getCinematographyTechnique(
  id: string,
): CinematographyTechnique | undefined {
  return byId.get(id);
}
export function searchCinematography(
  query: string,
  filters: CinematographyFilters = {},
): CinematographyTechnique[] {
  const normalized = normalizeTechniqueSearch(query.slice(0, 1000)),
    tokens = normalized.split(" ").filter(Boolean);
  return searchIndex
    .filter(
      ({ technique: t, text }) =>
        (!filters.family || t.family === filters.family) &&
        (!filters.shotType || t.shotTypes.includes(filters.shotType)) &&
        (!filters.owner || t.owner === filters.owner) &&
        (!filters.propertyRecommended || t.propertyRecommended) &&
        tokens.every((token) => text.includes(token)),
    )
    .map((entry) => ({
      ...entry,
      score:
        normalized && entry.names.includes(normalized)
          ? 0
          : normalized &&
              entry.names.some((name) => name.startsWith(normalized))
            ? 1
            : 2,
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.technique);
}
