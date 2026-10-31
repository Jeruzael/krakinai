import { it, expect } from "vitest";
import {
  collectReferenceCandidates,
  getGenerationPackReferences,
} from "../domain/referencePack";
import { buildSceneDocument } from "../domain/sceneDocument";
import { assembleScenePrompt } from "../domain/promptAssembler";
import { buildGenerationDocument } from "../domain/generationDocument";
import { enableSceneEnsemble, syncEnsemblePrimary } from "../domain/ensemble";
import { actor, ensembleLegacyDraft } from "./fixtures/ensembleFixture";
import { getActiveReferencePack } from "../domain/shotTypeRules";
const link = {
  mediaId: "shared-guide",
  role: "reference" as const,
  altText: "Same file, distinct identity relationships.",
  order: 0,
};
it.each(["secondary-wardrobe", "off-camera", "removed"])(
  "retains explicit participant provenance in a Property / Environment pack and Generation JSON: %s",
  (scenario) => {
    let s = source();
    s.shotType = "property_environment";
    delete s.ensemble!.participants[0].wardrobe;
    const secondary = s.ensemble!.participants[1];
    secondary.wardrobe = {
      ...actor("secondary-clothing", "Secondary suit"),
      slot: "wardrobe",
      mediaLinks: [{ ...link, mediaId: "suit-guide" }],
    };
    s = syncEnsemblePrimary(s);
    const selected = collectReferenceCandidates(s, new Map());
    const guide = selected.find((e) => e.mediaId === "suit-guide")!;
    s.referencePack = { version: 1, entries: selected };
    if (scenario === "off-camera")
      s.ensemble!.participants[1].presence = "off_camera";
    if (scenario === "removed") s.ensemble!.participants.pop();
    const expected = structuredClone(s.referencePack);
    expect(getActiveReferencePack(s)?.entries).toContainEqual(guide);
    const json = buildGenerationDocument(s, {
      references: getGenerationPackReferences(s.referencePack),
    });
    expect(
      json.references.some(
        (e) =>
          e.associationId === guide.associationId &&
          e.participantId === "lucas",
      ),
    ).toBe(true);
    expect(s.referencePack).toEqual(expected);
    if (scenario !== "secondary-wardrobe") {
      expect(
        collectReferenceCandidates(
          { ...s, referencePack: undefined },
          new Map(),
        ).some((e) => e.mediaId === "suit-guide"),
      ).toBe(false);
      expect(
        buildGenerationDocument({
          ...s,
          referencePack: undefined,
        }).references.some((e) => e.mediaId === "suit-guide"),
      ).toBe(false);
    }
  },
);
it("does not auto-export a formerly visible participant file from an old saved checklist after that person moves off camera", () => {
  const s = source();
  s.ensemble!.participants[1].character.mediaLinks[0].mediaId =
    "secondary-guide";
  const saved = { ...s, references: assembleScenePrompt(s).references };
  saved.ensemble!.participants[1].presence = "off_camera";
  expect(
    buildSceneDocument(saved).referenceFiles.some(
      (r) => r.mediaId === "secondary-guide",
    ),
  ).toBe(false);
});
it("retains selected secondary participant references for Property / Environment scenes", () => {
  const s = source();
  s.shotType = "property_environment";
  s.ensemble!.participants[1].character.mediaLinks[0].mediaId =
    "secondary-guide";
  const refs = collectReferenceCandidates(s, new Map());
  s.referencePack = { version: 1, entries: refs };
  expect(getActiveReferencePack(s)?.entries).toEqual(refs);
});
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
it("preserves an explicitly selected pack file and its ownership without injecting an off-camera identity", () => {
  const s = source();
  s.ensemble!.participants[1].character.mediaLinks[0].mediaId =
    "secondary-guide";
  const refs = collectReferenceCandidates(s, new Map());
  s.referencePack = { version: 1, entries: [{ ...refs[1], order: 0 }] };
  s.ensemble!.participants[1].presence = "off_camera";
  const before = structuredClone(s),
    doc = buildGenerationDocument(s, {
      references: getGenerationPackReferences(s.referencePack),
    });
  expect(doc.references).toMatchObject([
    { mediaId: "secondary-guide", participantId: "lucas" },
  ]);
  expect(doc.participants?.find((p) => p.id === "lucas")?.identity).toBeNull();
  expect(s).toEqual(before);
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
