import type {
  ChangeSet,
  ChangeSetApproval,
  ChangeSetState,
  ImportCandidate,
} from "../types/changeSet";
import type { MediaLink, SavedScene } from "../types/domain";
import { canonicalStringify } from "./changeSetCanonical";
import { findCandidateMatches } from "./changeSetCandidates";
import { revisionRoot } from "./sceneRevisions";
import { isDirectPrompt } from "./directPrompt";
import { getActiveSceneSlots } from "./shotTypeRules";
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
    const decision = approval.assetDecisions[op.operationId];
    if (decision?.assetId) assetIds.add(decision.assetId);
  }
  // Recipe restoration consults the live character to validate an approved anchor.
  // Bind that read (including disappearance), while retaining the frozen source scene.
  for (const op of input.operations)
    if (op.type === "scene.restore") {
      const restored = state.scenes.find((s) => s.id === op.restoreFromSceneId);
      if (restored && !isDirectPrompt(restored)) {
        const masterId = getActiveSceneSlots(restored).character?.sourceId;
        if (masterId) assetIds.add(masterId);
      }
    }
  const scenes = state.scenes.filter((s) => sceneIds.has(s.id)),
    assets = state.assets.filter((a) => assetIds.has(a.id)),
    templates = state.templates.filter((t) => assetIds.has(t.id));
  const roots = new Set(scenes.map(revisionRoot));
  const links = (s: SavedScene) => [
    ...s.references,
    ...(s.directReferences ?? []),
    ...(s.sourceMediaLinks ?? []),
    ...(s.referencePack?.entries ?? []),
    ...Object.values(s.slots).flatMap((slot) => slot?.mediaLinks ?? []),
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
  return canonicalStringify({
    projects: state.collections.filter((c) => projectIds.has(c.id)),
    scenes,
    assets,
    variants,
    templates,
    candidates,
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
