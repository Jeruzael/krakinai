import { it, expect } from "vitest";
import { planChangeSet } from "../domain/changeSetPlanner";
import { parseChangeSet } from "../domain/changeSetValidation";
import { buildAiContext } from "../domain/aiContext";
import {
  emptyState,
  allocationFor,
  allContentApproval,
} from "./fixtures/changeSetFixture";
import type { ChangeSet } from "../types/changeSet";
const input = (): any => ({
  schema: "krakinai.change-set.v1",
  changeSetId: "explicit-context",
  source: { kind: "codex" },
  operations: [
    {
      operationId: "s",
      type: "scene.create_direct_prompt",
      clientRef: "scene",
      title: "Property scene",
      shotType: "property_environment",
      prompt: { version: 1, text: "Exact original prose." },
      assetRefs: [
        {
          slot: "character",
          asset: { id: "asset_character" },
          expectedRevision: 1,
        },
      ],
      variantRefs: [
        { slot: "wardrobe", variantId: "variant_outfit", expectedRevision: 1 },
      ],
    },
  ],
});
function fixture() {
  const s: any = emptyState();
  s.assets.push({
    ...s.assets[0],
    id: "asset_character",
    title: "Approved identity",
    category: "characters",
    promptText: "IDENTITY_PRIVATE",
    reviewStatus: "user-approved",
    mediaLinks: [
      {
        mediaId: "media_guide",
        role: "reference",
        altText: "Character reference",
        order: 0,
      },
    ],
  });
  s.variants = [
    {
      id: "variant_outfit",
      parentCharacterId: "asset_character",
      targetSlot: "wardrobe",
      type: "Outfit",
      title: "Stored outfit",
      promptText: "VARIANT_PRIVATE",
      tags: [],
      mediaLinks: [
        {
          mediaId: "media_guide",
          role: "sample",
          altText: "Outfit sample",
          order: 0,
        },
      ],
      favorite: false,
      reviewStatus: "unreviewed",
      revision: 1,
      createdAt: "2026-10-30",
      updatedAt: "2026-10-30",
    },
  ];
  s.media = [
    {
      id: "media_guide",
      filename: "opaque-unit-fixture.png",
      safeFilename: "opaque-unit-fixture.png",
      mimeType: "image/png",
      byteSize: 6,
      blob: new Blob(["opaque"], { type: "image/png" }),
      createdAt: "2026-10-30",
    },
  ];
  return s;
}
it("links exact existing variants and keeps explicit context media even for inactive component slots without rewriting text", () => {
  const state = fixture(),
    before = structuredClone(state),
    data = parseChangeSet(input()),
    p = planChangeSet(data, allContentApproval(), state, allocationFor(data));
  expect(p.findings.filter((f) => f.severity === "blocking")).toEqual([]);
  expect(p.scenes[0].outputs.full).toBe("Exact original prose.");
  expect(p.scenes[0].slots.wardrobe).toMatchObject({
    sourceType: "variant",
    sourceId: "variant_outfit",
    parentCharacterId: "asset_character",
  });
  expect(p.scenes[0].referencePack!.entries.map((e) => e.sourceSlot)).toEqual([
    "character",
    "wardrobe",
  ]);
  expect(p.scenes[0].references).toHaveLength(2);
  expect(state).toEqual(before);
});
it("uses the existing ownership rule to block incompatible variant context,never switching the character implicitly", () => {
  const state = fixture();
  state.variants[0].parentCharacterId = "asset_other_character";
  const data = input() as ChangeSet,
    p = planChangeSet(data, allContentApproval(), state, allocationFor(data));
  expect(
    p.findings.some(
      (f) => f.severity === "blocking" && /character|variant/i.test(f.message),
    ),
  ).toBe(true);
  expect(p.scenes).toHaveLength(0);
  expect(
    state.assets.find((a: any) => a.id === "asset_character").reviewStatus,
  ).toBe("user-approved");
});
it("exports selected variant metadata and frozen context IDs,with text only under explicit opt-in", () => {
  const state = fixture(),
    data = input() as ChangeSet,
    p = planChangeSet(data, allContentApproval(), state, allocationFor(data));
  state.scenes = p.scenes;
  const doc: any = buildAiContext(state, {
    sceneIds: [p.scenes[0].id],
    variantIds: ["variant_outfit"],
  } as any);
  expect(doc.variants[0]).toMatchObject({
    id: "variant_outfit",
    expectedRevision: 1,
    parentCharacterId: "asset_character",
  });
  expect(doc.scenes[0].componentContext.wardrobe.sourceId).toBe(
    "variant_outfit",
  );
  expect(JSON.stringify(doc)).not.toContain("VARIANT_PRIVATE");
  expect(JSON.stringify(doc)).not.toContain("IDENTITY_PRIVATE");
  const withText = buildAiContext(state, {
    sceneIds: [p.scenes[0].id],
    variantIds: ["variant_outfit"],
    includeAssetText: true,
  } as any);
  expect(JSON.stringify(withText)).toContain("VARIANT_PRIVATE");
  expect(JSON.stringify(withText)).not.toContain("IDENTITY_PRIVATE");
});
