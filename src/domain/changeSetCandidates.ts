import type {
  CandidateKind,
  CandidateMatch,
  ChangeSetState,
  ImportCandidate,
} from "../types/changeSet";
import type { PromptCategory } from "../types/domain";
export const CANDIDATE_CATEGORY: Record<
  Exclude<CandidateKind, "template">,
  PromptCategory
> = {
  character: "characters",
  wardrobe: "wardrobe",
  environment: "environments",
  action: "actions",
  camera: "camera",
  lighting: "lighting",
  style: "styles",
};
const normalize = (v: string) =>
  v
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const terms = (v: string) => new Set(normalize(v).split(/\s+/).filter(Boolean));
const similarity = (a: Set<string>, b: Set<string>) => {
  const both = [...a].filter((x) => b.has(x)).length;
  return both / (a.size + b.size - both || 1);
};
export function findCandidateMatches(
  candidate: Pick<ImportCandidate, "kind" | "title" | "promptText" | "tags">,
  state: Pick<ChangeSetState, "assets" | "templates">,
): CandidateMatch[] {
  const values =
    candidate.kind === "template"
      ? state.templates.map((t) => ({
          id: t.id,
          title: t.name,
          text: t.sceneInstructionsDefault ?? "",
          tags: [] as string[],
          revision: t.revision,
        }))
      : state.assets
          .filter(
            (a) =>
              a.category ===
              CANDIDATE_CATEGORY[
                candidate.kind as Exclude<CandidateKind, "template">
              ],
          )
          .map((a) => ({
            id: a.id,
            title: a.title,
            text: a.promptText,
            tags: a.tags,
            revision: a.revision,
          }));
  const content = normalize(candidate.promptText),
    words = terms(candidate.promptText),
    title = normalize(candidate.title),
    tags = new Set(candidate.tags.map(normalize));
  return values
    .flatMap((v) => {
      const current = terms(v.text),
        tagOverlap = v.tags.filter((t) => tags.has(normalize(t))).length;
      const reason =
        normalize(v.title) === title
          ? "Matching normalized title"
          : normalize(v.text) === content
            ? "Matching normalized prompt"
            : words.size >= 12 &&
                current.size >= 12 &&
                similarity(words, current) >= 0.85
              ? "Highly overlapping prompt terms"
              : tagOverlap >= 2 &&
                  similarity(terms(v.title), terms(candidate.title)) >= 0.5
                ? "Related title and tags"
                : undefined;
      return reason
        ? [
            {
              id: v.id,
              title: v.title,
              revision: v.revision,
              reason,
              kind: candidate.kind,
            },
          ]
        : [];
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
