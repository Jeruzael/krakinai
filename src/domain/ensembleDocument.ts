import type { OutputMode } from "../types/domain";
import {
  buildDialogueDocument,
  buildSceneComponentDocument,
  type SceneDocument,
  type SceneDocumentSource,
} from "./sceneDocument";
import {
  getEnsembleAvoidParts,
  getSceneSnapshotEntries,
  getReferenceLinkIdentity,
  getReferenceAssociationId,
} from "./ensembleReferences";
import { getSceneLevelAvoidText } from "./shotTypeRules";
import type { PromptAsset } from "../types/domain";
import { resolveGenerationIdentity } from "./identityAnchors";
import type { EnsembleSource } from "./ensemble";
export function resolveEnsembleGenerationIdentities(
  source: EnsembleSource,
  liveMasters?: ReadonlyMap<string, PromptAsset>,
  saved = false,
): Record<
  string,
  { source: "master" | "approved_anchor"; description: string }
> {
  return Object.fromEntries(
    (source.ensemble?.participants ?? []).map((p) => [
      p.id,
      p.character.sourceType === "asset"
        ? resolveGenerationIdentity(
            { slots: { character: p.character }, generation: p.generation },
            liveMasters?.get(p.character.sourceId),
            saved,
          ).identity
        : { source: "master" as const, description: p.character.promptText },
    ]),
  );
}
const safe = (v: string | undefined) =>
  v && !/^(?:blob:|data:|file:|[a-z]:[\\/]|[\\/])/i.test(v) ? v : null;
export function buildEnsembleDocument(
  source: SceneDocumentSource,
  base: SceneDocument,
): SceneDocument {
  const e = source.ensemble!;
  const snapshots = getSceneSnapshotEntries(source, { activeOnly: true });
  const refs = snapshots.flatMap(({ slot, snapshot, participantId }) => {
    const occurrences = new Map<string, number>();
    return [...snapshot.mediaLinks]
      .sort((a, b) => a.order - b.order)
      .map((link) => {
        const key = getReferenceLinkIdentity(link),
          occurrence = occurrences.get(key) ?? 0;
        occurrences.set(key, occurrence + 1);
        return {
          ...link,
          sourceSlot: slot,
          sourceId: snapshot.sourceId,
          associationId: getReferenceAssociationId(
            slot,
            snapshot.sourceId,
            key,
            occurrence,
            participantId,
          ),
          ...(participantId ? { participantId } : {}),
        };
      });
  });
  return {
    ...base,
    schema: "krakinai.scene-prompt.v2",
    primaryParticipantId: e.primaryParticipantId,
    components: { ...base.components, character: null, wardrobe: null },
    dialogue: null,
    participants: e.participants.map((p) => {
      const character = buildSceneComponentDocument("character", p.character);
      return {
        id: p.id,
        name: p.character.sourceTitle,
        role: p.role ?? null,
        presence: p.presence,
        performanceNotes: p.performanceNotes ?? null,
        characterSource: character.source,
        character: p.presence === "on_camera" ? character : null,
        wardrobe:
          p.presence === "on_camera" && p.wardrobe
            ? buildSceneComponentDocument("wardrobe", p.wardrobe)
            : null,
      };
    }),
    dialogueCues: e.dialogueCues.flatMap((c) => {
      const d = buildDialogueDocument(c);
      return d
        ? [
            {
              ...d,
              id: c.id,
              ...(c.participantId ? { participantId: c.participantId } : {}),
              ...(c.timing ? { timing: structuredClone(c.timing) } : {}),
            },
          ]
        : [];
    }),
    avoidText: [
      ...getEnsembleAvoidParts(source),
      getSceneLevelAvoidText(source),
    ]
      .filter((v) => v.trim())
      .join(", "),
    referenceFiles: [
      ...base.referenceFiles.filter(
        (r) =>
          !snapshots.some((e) =>
            e.snapshot.mediaLinks.some((l) => l.mediaId === r.mediaId),
          ),
      ),
      ...refs.map((l) => ({
        mediaId: safe(l.mediaId),
        role: l.role,
        altText: safe(l.altText),
        viewLabel: safe(l.viewLabel),
        order: l.order,
        filename:
          l.filename && !/^(?:blob:|data:|file:|https?:)/i.test(l.filename)
            ? l.filename.split(/[\\/]/).pop() || null
            : null,
        mimeType: safe(l.mimeType),
        sourceSlot: l.sourceSlot,
        sourceId: l.sourceId,
        associationId: l.associationId,
        ...(l.participantId ? { participantId: l.participantId } : {}),
      })),
    ].map((r, order) => ({ ...r, order })),
  };
}
export function formatEnsembleParticipants(
  doc: SceneDocument,
  mode: OutputMode,
): string[] {
  return (doc.participants ?? []).map((p) =>
    [
      `${mode === "structured" ? "=== PARTICIPANT" : "## Participant"}: ${p.name} [${p.id}]${mode === "structured" ? " ===" : ""}`,
      `Presence: ${p.presence === "on_camera" ? "On camera" : "Off camera"}${p.id === doc.primaryParticipantId ? " (primary)" : ""}`,
      ...(p.role ? [`Role: ${p.role}`] : []),
      ...(p.character ? [`Character Identity:\n${p.character.prompt}`] : []),
      ...(p.wardrobe
        ? [
            `Wardrobe & Accessories:\n${mode === "compact" ? p.wardrobe.compactPrompt : p.wardrobe.prompt}`,
          ]
        : []),
      ...(p.performanceNotes
        ? [`Performance Notes: ${p.performanceNotes}`]
        : []),
    ].join("\n\n"),
  );
}
