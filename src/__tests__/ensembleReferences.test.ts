import { it, expect } from "vitest";
import {
  collectReferenceCandidates,
  getGenerationPackReferences,
} from "../domain/referencePack";
import { buildSceneDocument } from "../domain/sceneDocument";
import { enableSceneEnsemble, syncEnsemblePrimary } from "../domain/ensemble";
import { actor, ensembleLegacyDraft } from "./fixtures/ensembleFixture";
const link = {
  mediaId: "shared-guide",
  role: "reference" as const,
  altText: "Same file, distinct identity relationships.",
  order: 0,
};
function source() {
  const s = enableSceneEnsemble(ensembleLegacyDraft());
  s.ensemble!.participants[0].character.mediaLinks = [{ ...link }];
  s.ensemble!.participants.push({
    id: "lucas",
    character: { ...actor("lucas", "Lucas"), mediaLinks: [{ ...link }] },
    presence: "on_camera",
  });
  return syncEnsemblePrimary(s);
}
it("retains separate participant references and skips duplicated primary mirrors", () => {
  const s = source(),
    refs = collectReferenceCandidates(s, new Map());
  expect(refs).toHaveLength(2);
  expect(refs.map((r: any) => r.participantId)).toEqual(["primary", "lucas"]);
  expect(new Set(refs.map((r) => r.associationId)).size).toBe(2);
  expect(refs.every((r) => r.mediaId === "shared-guide")).toBe(true);
  const doc: any = buildSceneDocument(s);
  expect(doc.referenceFiles).toHaveLength(2);
  expect(doc.referenceFiles.map((r: any) => r.participantId)).toEqual([
    "primary",
    "lucas",
  ]);
  expect(
    getGenerationPackReferences({ version: 1, entries: refs }).map(
      (r: any) => r.participantId,
    ),
  ).toEqual(["primary", "lucas"]);
});
it("keeps two owned associations when both people intentionally reuse the same generic wardrobe asset", () => {
  const s = source();
  for (const p of s.ensemble!.participants)
    p.wardrobe = {
      slot: "wardrobe",
      sourceType: "asset",
      sourceId: "shared-formal",
      sourceTitle: "Generic formal wardrobe",
      sourceRevision: 1,
      promptText: "Formal clothing.",
      mediaLinks: [{ ...link, role: "sample" }],
    };
  const refs = collectReferenceCandidates(
    syncEnsemblePrimary(s),
    new Map(),
  ).filter((r) => r.sourceSlot === "wardrobe");
  expect(refs).toHaveLength(2);
  expect(new Set(refs.map((r) => r.associationId)).size).toBe(2);
});
it("does not automatically select an off-camera visual attachment", () => {
  const s = source();
  s.ensemble!.participants[1].presence = "off_camera";
  const refs = collectReferenceCandidates(s, new Map());
  expect(refs).toHaveLength(1);
  expect((refs[0] as any).participantId).toBe("primary");
});
it("preserves exact legacy association IDs when no ensemble exists", () => {
  const s = ensembleLegacyDraft();
  s.slots.character!.mediaLinks = [{ ...link }];
  const refs = collectReferenceCandidates(s, new Map());
  expect(refs[0].associationId).toBe(
    JSON.stringify([
      "character",
      "character",
      JSON.stringify([link.mediaId, link.role, "", link.altText]),
      0,
    ]),
  );
  expect(refs[0]).not.toHaveProperty("participantId");
});
