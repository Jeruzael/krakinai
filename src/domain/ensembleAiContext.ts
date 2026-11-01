import type { ChangeSetState } from "../types/changeSet";
import type { IdentityAnchor, MediaLink, SavedScene } from "../types/domain";
import type { SceneParticipant } from "../types/ensemble";
/** Scene metadata mirrors legacy disclosure: exact script requires a full-prompt grant. */
export function projectEnsembleContext(
  scene: Pick<SavedScene, "ensemble">,
  state: ChangeSetState,
  options: {
    notes: boolean;
    fullPrompt: boolean;
    identityText?: boolean;
    assetText?: boolean;
  },
  link: (l: MediaLink) => unknown,
  anchor?: (a: IdentityAnchor | undefined) => unknown,
) {
  const e = scene.ensemble;
  if (!e) return;
  const snapshot = (s: SceneParticipant["character"]) => {
    const current =
        s.sourceType === "asset"
          ? state.assets.find((a) => a.id === s.sourceId)
          : s.sourceType === "variant"
            ? state.variants?.find((v) => v.id === s.sourceId)
            : state.templates.find((t) => t.id === s.sourceId),
      text = s.slot === "character" ? options.identityText : options.assetText;
    return {
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceRevision: s.sourceRevision,
      parentCharacterId: s.parentCharacterId,
      available: !!current,
      expectedRevision: current?.revision,
      references: s.mediaLinks.map(link),
      ...(text
        ? {
            promptText: s.promptText,
            compactText: s.compactText,
            avoidText: s.avoidText,
            ...(s.slot === "character"
              ? { identityAnchor: anchor?.(s.identityAnchor) }
              : {
                  overrideText: s.overrideText,
                  overrideCompactText: s.overrideCompactText,
                }),
          }
        : {}),
    };
  };
  return {
    version: 1,
    primaryParticipantId: e.primaryParticipantId,
    participants: e.participants.map((p) => ({
      id: p.id,
      name: p.character.sourceTitle,
      presence: p.presence,
      character: snapshot(p.character),
      ...(p.wardrobe ? { wardrobe: snapshot(p.wardrobe) } : {}),
      ...(p.generation
        ? {
            generation: {
              identitySource: p.generation.identitySource,
              ...(options.identityText && p.generation.anchor
                ? { anchor: structuredClone(p.generation.anchor) }
                : {}),
            },
          }
        : {}),
      ...(options.notes
        ? { role: p.role, performanceNotes: p.performanceNotes }
        : {}),
    })),
    dialogueCues: e.dialogueCues.map((c) => ({
      id: c.id,
      participantId: c.participantId,
      mode: c.mode,
      language: c.language,
      captionPreference: c.captionPreference,
      ...(c.timing ? { timing: structuredClone(c.timing) } : {}),
      ...(options.fullPrompt
        ? {
            speaker: c.speaker,
            line: c.line,
            deliveryNotes: c.deliveryNotes,
            ...(c.performanceDirection
              ? {
                  performanceDirection: structuredClone(c.performanceDirection),
                }
              : {}),
          }
        : {}),
    })),
  };
}
