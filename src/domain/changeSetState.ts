import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetState,
  ImportCandidate,
  ImportVariantCandidate,
} from "../types/changeSet";
import type { MediaLink, SavedScene } from "../types/domain";
import { canonicalStringify } from "./changeSetCanonical";
import { findCandidateMatches } from "./changeSetCandidates";
import { revisionRoot } from "./sceneRevisions";
import { isDirectPrompt } from "./directPrompt";
import { getActiveSceneSlots } from "./shotTypeRules";
import { isRecipeOperation } from "../types/changeSet";
import{getSceneSnapshotEntries}from'./ensembleReferences';
import{findOutfitCandidateMatches}from'./changeSetVariants';
/** Relevant current data only; no hashing or other async work in the transaction. */
export function changeSetStateSignature(
  input: ChangeSet,
  approval: ChangeSetApproval,
  state: ChangeSetState,
  duplicateScenes: string[] = [],
): string {
  const projectIds = new Set<string>(),
    sceneIds = new Set<string>(duplicateScenes),
    assetIds = new Set<string>(),
    variantIds = new Set<string>(),
    mediaIds = new Set<string>(),
    candidateIds = new Set<string>();
  for (const op of input.operations) {
    if ("project" in op && op.project && "id" in op.project)
      projectIds.add(op.project.id);
    for (const field of ["sceneId", "restoreFromSceneId"] as const)
      if (field in op)
        sceneIds.add((op as unknown as Record<string, string>)[field]);
    if ("scene" in op && "id" in op.scene) sceneIds.add(op.scene.id);
    if ("sourceScene" in op && op.sourceScene && "id" in op.sourceScene)
      sceneIds.add(op.sourceScene.id);
    if ("assetRefs" in op)
      for (const a of op.assetRefs ?? [])
        if ("id" in a.asset) assetIds.add(a.asset.id);
    if ("variantRefs" in op)
      for (const v of op.variantRefs ?? []) variantIds.add(v.variantId);
    for (const field of ["references", "sourceMedia"] as const)
      if (field in op)
        for (const link of (op as unknown as Record<string, MediaLink[]>)[
          field
        ] ?? [])
          mediaIds.add(link.mediaId);
    if (op.type === "asset.review_candidate") candidateIds.add(op.candidateId);
    if(op.type==='variant.propose')assetIds.add(op.parentCharacterId);
    if(op.type==='variant.review_candidate'){candidateIds.add(op.candidateId);const candidate=state.preferences.aiImports?.variantCandidates?.find(c=>c.id===op.candidateId);if(candidate)assetIds.add(candidate.parentCharacterId)}
    if(isRecipeOperation(op))for(const p of op.ensemble?.participantUpserts??[]){if(p.character&&'id'in p.character.asset)assetIds.add(p.character.asset.id);if(p.wardrobe){if('asset'in p.wardrobe){if('id'in p.wardrobe.asset)assetIds.add(p.wardrobe.asset.id)}else if('id'in p.wardrobe.variant)variantIds.add(p.wardrobe.variant.id)}}
    const variantDecision=approval.variantDecisions?.[op.operationId];if(variantDecision?.variantId)variantIds.add(variantDecision.variantId);
    const decision = approval.assetDecisions[op.operationId];
    if (decision?.assetId) assetIds.add(decision.assetId);
  }
  // Recipe restoration consults the live character to validate an approved anchor.
  // Bind that read (including disappearance), while retaining the frozen source scene.
  for (const op of input.operations)
    if (isRecipeOperation(op) && "sceneId" in op) {
      const parent = state.scenes.find((s) => s.id === op.sceneId),
        masterId = parent && getActiveSceneSlots(parent).character?.sourceId;
      if (masterId) assetIds.add(masterId);
      if(parent?.ensemble)for(const {snapshot}of getSceneSnapshotEntries(parent)){if(snapshot.sourceType==='asset'||snapshot.sourceType==='template')assetIds.add(snapshot.sourceId);if(snapshot.sourceType==='variant')variantIds.add(snapshot.sourceId)}
    }
  for (const op of input.operations)
    if (op.type === "scene.restore") {
      const restored = state.scenes.find((s) => s.id === op.restoreFromSceneId);
      if (restored && !isDirectPrompt(restored)) {
        const masterId = getActiveSceneSlots(restored).character?.sourceId;
        if (masterId) assetIds.add(masterId);
        if(restored.ensemble)for(const {snapshot}of getSceneSnapshotEntries(restored)){if(snapshot.sourceType==='asset'||snapshot.sourceType==='template')assetIds.add(snapshot.sourceId);if(snapshot.sourceType==='variant')variantIds.add(snapshot.sourceId)}
      }
    }
  for(const variant of state.variants??[])if(variantIds.has(variant.id))assetIds.add(variant.parentCharacterId);
  const scenes = state.scenes.filter((s) => sceneIds.has(s.id)),
    assets = state.assets.filter((a) => assetIds.has(a.id)),
    templates = state.templates.filter((t) => assetIds.has(t.id));
  const roots = new Set(scenes.map(revisionRoot));
  const links = (s: SavedScene) => [
    ...s.references,
    ...(s.directReferences ?? []),
    ...(s.sourceMediaLinks ?? []),
    ...(s.referencePack?.entries ?? []),
    ...getSceneSnapshotEntries(s).flatMap(e=>e.snapshot.mediaLinks),
  ];
  for (const s of scenes)
    for (const link of links(s)) mediaIds.add(link.mediaId);
  for (const a of assets)
    for (const link of a.mediaLinks) mediaIds.add(link.mediaId);
  const variants = state.variants?.filter((v) => variantIds.has(v.id)) ?? [];
  for (const v of variants)
    for (const link of v.mediaLinks) mediaIds.add(link.mediaId);
  const candidates =
    state.preferences.aiImports?.candidates.filter((c) =>
      candidateIds.has(c.id),
    ) ?? [];
  const proposals: Pick<
    ImportCandidate,
    "kind" | "title" | "promptText" | "tags"
  >[] = input.operations.flatMap<
    Pick<ImportCandidate, "kind" | "title" | "promptText" | "tags">
  >((op) =>
    op.type === "asset.propose"
      ? [op]
      : op.type === "asset.review_candidate"
        ? candidates.filter((c) => c.id === op.candidateId)
        : [],
  );
  const matches = proposals.map((c) => ({
    title: c.title,
    matches: findCandidateMatches(c, state),
  }));
  const variantCandidates=state.preferences.aiImports?.variantCandidates?.filter(c=>candidateIds.has(c.id))??[];
  const variantProposals=input.operations.flatMap<Pick<ImportVariantCandidate,'title'|'promptText'|'tags'|'parentCharacterId'>>(op=>op.type==='variant.propose'?[op]:op.type==='variant.review_candidate'?variantCandidates.filter(c=>c.id===op.candidateId):[]);
  const variantMatches=variantProposals.map(c=>({title:c.title,parentCharacterId:c.parentCharacterId,matches:findOutfitCandidateMatches(c,state)}));
  return canonicalStringify({
    projects: state.collections.filter((c) => projectIds.has(c.id)),
    scenes,
    assets,
    variants,
    templates,
    candidates,
    ...(['krakinai.change-set.v3','krakinai.change-set.v4'].includes(input.schema)?{variantCandidates,variantMatches}:{}),
    heads: state.scenes
      .filter((s) => roots.has(revisionRoot(s)))
      .map((s) => ({
        id: s.id,
        revision: s.revision,
        updatedAt: s.updatedAt,
        sceneRevision: s.sceneRevision,
        versionOfSceneId: s.versionOfSceneId,
      })),
    media: state.media
      .filter((m) => mediaIds.has(m.id))
      .map(({ blob, posterBlob, ...m }) => ({
        ...m,
        blobSize: blob.size,
        blobType: blob.type,
        posterSize: posterBlob?.size,
        posterType: posterBlob?.type,
      })),
    matches,
    names: input.operations.flatMap((op) =>
      op.type === "project.create"
        ? state.collections
            .filter(
              (c) =>
                c.name.normalize("NFKC").toLowerCase() ===
                op.name.normalize("NFKC").toLowerCase(),
            )
            .map((c) => ({ id: c.id, name: c.name }))
        : [],
    ),
  });
}
