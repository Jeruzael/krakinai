import type {
  AiContextDocument,
  AiContextSelection,
  AiContextScene,
} from "../types/aiContext";
import type { ChangeSetState } from "../types/changeSet";
import type { Collection, ProjectShot, MediaAsset, IdentityAnchor, MediaLink } from "../types/domain";
import { getProjectShots } from "./projectStoryboard";
import { getRevisionHead, revisionRoot } from "./sceneRevisions";
import{projectEnsembleContext}from'./ensembleAiContext';
export const MAX_AI_CONTEXT_BYTES = 5 * 1024 * 1024;
/** Shared disclosure policy for manual context exports and scoped MCP metadata. */
export function projectAiContextLink(l: MediaLink, mediaMap: ReadonlyMap<string, MediaAsset>, notes: boolean, filenames: boolean) {
  return { mediaId: l.mediaId, role: l.role, order: l.order,
    ...(notes ? { altText: l.altText } : {}),
    ...(filenames ? { filename: l.filename ?? mediaMap.get(l.mediaId)?.filename } : {}),
    available: mediaMap.has(l.mediaId) };
}
export function projectAiContextProject(c: Collection, shots: ProjectShot[], notes: boolean): Record<string, unknown> {
  return { id: c.id, name: c.name, expectedRevision: c.project?.revision ?? 0,
    ...(notes ? { description: c.description, planningNotes: c.planningNotes } : {}),
    shots: shots.map(s => ({ id: s.id, order: s.order, code: s.code, title: s.title, status: s.status,
      takeSceneIds: [...s.takeSceneIds], selectedSceneId: s.selectedSceneId ?? null,
      plannedShotType: s.plannedShotType, plannedDurationSeconds: s.plannedDurationSeconds,
      ...(notes ? { continuityNotes: s.continuityNotes } : {}) })) };
}
function withinSize(text: string) {
  if (new TextEncoder().encode(text).length > MAX_AI_CONTEXT_BYTES)
    throw Error(
      "AI context exceeds 5 MiB. Select fewer records or omit full text; no content was truncated.",
    );
}
export function buildAiContext(
  state: ChangeSetState,
  selection: AiContextSelection = {},
): AiContextDocument {
  const selected = (
    key:
      | "projectIds"
      | "sceneIds"
      | "assetIds"
      | "variantIds"
      | "templateIds"
      | "fullPromptSceneIds",
    max: number,
  ) => {
    const list = selection[key] ?? [];
    if (
      !Array.isArray(list) ||
      list.length > max ||
      list.some((id) => typeof id !== "string" || !id.trim()) ||
      new Set(list).size !== list.length
    )
      throw Error(`AI context ${key} selection limit/IDs are invalid.`);
    return list;
  };
  const projects = selected("projectIds", 10).map((id) => {
    const c = state.collections.find((c) => c.id === id);
    if (!c) throw Error("Selected project is unavailable.");
    return c;
  });
  const explicitScenes = selected("sceneIds", 250),
    assetIds = selected("assetIds", 500),
    templateIds = selected("templateIds", 500),
    promptIds = new Set(selected("fullPromptSceneIds", 250));
  const variantIds = selected("variantIds", 500);
  if (assetIds.length + variantIds.length + templateIds.length > 500)
    throw Error(
      "AI context reusable-record limit is 500 assets/variants/templates together.",
    );
  const flag = (
    key:
      | "includeAssetText"
      | "includeCharacterIdentity"
      | "includeNotes"
      | "includeMediaFilenames",
  ) => {
    if (selection[key] !== undefined && typeof selection[key] !== "boolean")
      throw Error("Privacy controls must be explicit booleans.");
    return selection[key] === true;
  };
  const assetText = flag("includeAssetText"),
    identities = flag("includeCharacterIdentity"),
    notes = flag("includeNotes"),
    filenames = flag("includeMediaFilenames");
  let count = 0;
  const shots = projects.map((p) => {
    const s = getProjectShots(p, state.scenes);
    count += s.length;
    return s;
  });
  if (count > 250)
    throw Error(
      "AI context storyboard limit is 250 shots. Select fewer projects.",
    );
  const sceneIds = [
    ...new Set([
      ...shots.flatMap((s) => s.flatMap((s) => s.takeSceneIds)),
      ...explicitScenes,
    ]),
  ];
  if (sceneIds.length > 250)
    throw Error("AI context scene metadata limit is 250.");
  for (const id of explicitScenes)
    if (!state.scenes.some((s) => s.id === id))
      throw Error("Explicitly selected scene is unavailable.");
  for (const id of promptIds)
    if (!sceneIds.includes(id))
      throw Error("Full-prompt target is outside the selected scene scope.");
  const mediaMap = new Map(state.media.map((m) => [m.id, m]));
  const link = (l: MediaLink) => projectAiContextLink(l, mediaMap, notes, filenames);
  const anchor = (a: IdentityAnchor | undefined) =>
    a
      ? {
          text: a.text,
          ...(a.approvedText !== undefined
            ? { approvedText: a.approvedText }
            : {}),
          ...(a.approvedMasterIdentityRevision !== undefined
            ? {
                approvedMasterIdentityRevision:
                  a.approvedMasterIdentityRevision,
              }
            : {}),
          ...(a.approvedAt !== undefined ? { approvedAt: a.approvedAt } : {}),
        }
      : undefined;
  const doc: AiContextDocument = {
    schema: "krakinai.ai-context.v1",
    exportedAt: new Date().toISOString(),
    privacy: {
      fullScenePrompts: promptIds.size > 0,
      assetText,
      characterIdentity: identities,
      notes,
      mediaFilenames: filenames,
    },
    projects: projects.map((c, i) => projectAiContextProject(c, shots[i], notes)),
    scenes: sceneIds.map((id): AiContextScene => {
      const s = state.scenes.find((s) => s.id === id);
      if (!s) {
        if (promptIds.has(id))
          throw Error("Selected full prompt is unavailable.");
        return { id, missing: true };
      }
      return {
        id,
        title: s.title,
        authoringMode: s.authoringMode ?? "recipe",
        shotType: s.shotType,
        rootSceneId: revisionRoot(s),
        expectedHeadId: getRevisionHead(s, state.scenes).id,
        sequence: s.sceneRevision?.sequence ?? 1,
        ...(s.ensemble?{ensemble:projectEnsembleContext(s,state,{notes,fullPrompt:promptIds.has(id)},link)}:{}),
        componentContext: Object.fromEntries(
          Object.entries(s.slots).map(([slot, snapshot]) => {
            const current =
              snapshot!.sourceType === "asset"
                ? state.assets.find((a) => a.id === snapshot!.sourceId)
                : snapshot!.sourceType === "variant"
                  ? state.variants?.find((v) => v.id === snapshot!.sourceId)
                  : state.templates.find((t) => t.id === snapshot!.sourceId);
            return [
              slot,
              {
                sourceType: snapshot!.sourceType,
                sourceId: snapshot!.sourceId,
                sourceRevision: snapshot!.sourceRevision,
                parentCharacterId: snapshot!.parentCharacterId,
                available: !!current,
                expectedRevision: current?.revision,
              },
            ];
          }),
        ),
        settings: {
          aspectRatio: s.settings.aspectRatio,
          durationSeconds: s.settings.durationSeconds,
          ...(notes ? { toolNotes: s.settings.toolNotes } : {}),
        },
        pendingInputs:
          s.pendingInputs?.map((p) => ({
            id: p.id,
            kind: p.kind,
            ...(notes ? { label: p.label, notes: p.notes } : {}),
          })) ?? [],
        references: s.references.map(link),
        ...(s.referencePack
          ? {
              referencePack: {
                version: 1,
                entries: s.referencePack.entries.map((l, index) => ({
                  ...link(l),
                  associationIndex: index,
                  sourceSlot: l.sourceSlot,
                  sourceId: l.sourceId,
                  purpose: l.purpose,
                })),
              },
            }
          : {}),
        ...(notes
          ? { claimNotes: s.claimNotes, reviewNotes: s.reviewNotes }
          : {}),
        ...(promptIds.has(id) ? { fullPrompt: s.outputs.full } : {}),
      };
    }),
    assets: assetIds.map((id) => {
      const a = state.assets.find((a) => a.id === id);
      if (!a) throw Error("Selected asset is unavailable.");
      const includeText = a.category === "characters" ? identities : assetText;
      return {
        id: a.id,
        title: a.title,
        category: a.category,
        tags: [...a.tags],
        expectedRevision: a.revision,
        references: a.mediaLinks.map(link),
        ...(includeText
          ? {
              promptText: a.promptText,
              compactText: a.compactText,
              avoidText: a.avoidText,
            }
          : {}),
        ...(a.category === "characters" && identities
          ? {
              identityRevision: a.identityRevision ?? a.revision,
              identityAnchor: anchor(a.identityAnchor),
            }
          : {}),
        ...(notes ? { description: a.description, notes: a.notes } : {}),
      };
    }),
    variants: variantIds.map((id) => {
      const v = state.variants?.find((v) => v.id === id);
      if (!v) throw Error("Selected variant is unavailable.");
      return {
        id: v.id,
        title: v.title,
        type: v.type,
        targetSlot: v.targetSlot,
        parentCharacterId: v.parentCharacterId,
        tags: [...v.tags],
        expectedRevision: v.revision,
        references: v.mediaLinks.map(link),
        ...(assetText
          ? {
              promptText: v.promptText,
              compactText: v.compactText,
              avoidText: v.avoidText,
            }
          : {}),
        ...(notes ? { description: v.description, notes: v.notes } : {}),
      };
    }),
    templates: templateIds.map((id) => {
      const t = state.templates.find((t) => t.id === id);
      if (!t) throw Error("Selected template is unavailable.");
      return {
        id: t.id,
        name: t.name,
        category: t.category,
        ...(t.ensembleDefault?{ensembleDefault:{version:1,ensemble:projectEnsembleContext({ensemble:t.ensembleDefault.ensemble},state,{notes,fullPrompt:assetText,identityText:identities,assetText},link,anchor),...(t.ensembleDefault.referencePack?{referencePack:{version:1,entries:t.ensembleDefault.referencePack.entries.map(l=>({...link(l),associationId:l.associationId,participantId:l.participantId,sourceSlot:l.sourceSlot,sourceId:l.sourceId,purpose:l.purpose}))}}:{})}}:{}),
        expectedRevision: t.revision,
        ...(notes ? { description: t.description } : {}),
        ...(assetText
          ? {
              sceneInstructionsDefault: t.sceneInstructionsDefault,
              defaults: Object.fromEntries(
                Object.entries(t.defaults)
                  .filter(([slot]) => slot !== "character" || identities)
                  .map(([slot, d]) => [
                    slot,
                    {
                      slot: d!.slot,
                      title: d!.title,
                      promptText: d!.promptText,
                      compactText: d!.compactText,
                      avoidText: d!.avoidText,
                    },
                  ]),
              ),
            }
          : {}),
        ...(identities && t.includedCharacterSnapshot
          ? {
              includedCharacter: {
                sourceId: t.includedCharacterSnapshot.sourceId,
                sourceRevision: t.includedCharacterSnapshot.sourceRevision,
                sourceTitle: t.includedCharacterSnapshot.sourceTitle,
                promptText: t.includedCharacterSnapshot.promptText,
                identityAnchor: anchor(
                  t.includedCharacterSnapshot.identityAnchor,
                ),
              },
            }
          : {}),
      };
    }),
  };
  withinSize(JSON.stringify(doc));
  return doc;
}
export function serializeAiContext(
  state: ChangeSetState,
  selection: AiContextSelection = {},
): string {
  const text = JSON.stringify(buildAiContext(state, selection), null, 2);
  withinSize(text);
  return text;
}
