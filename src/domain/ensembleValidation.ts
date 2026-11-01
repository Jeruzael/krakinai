import { ENSEMBLE_LIMITS,ENSEMBLE_LOCAL_ID_PATTERN } from "../types/ensemble";
import { canonicalStringify } from "./changeSetCanonical";
import { validatePhase4Record } from "./phase4Validation";
import { validatePerformanceDirection } from "./dialoguePerformance";
import { getShotTypeRules, isShotType, resolveShotType } from "./shotTypeRules";
import { MAX_FILES_PER_RECORD } from "./validation";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number, required = false): v is string =>
  typeof v === "string" && v.length <= max && (!required || !!v.trim());
const id = (v: unknown): v is string =>
  text(v, ENSEMBLE_LIMITS.id, true) &&
  new RegExp(ENSEMBLE_LOCAL_ID_PATTERN).test(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
const same = (a: unknown, b: unknown) =>
  a === undefined || b === undefined
    ? a === b
    : canonicalStringify(a) === canonicalStringify(b);
const optionalText = (v: unknown, max: number) =>
  v === undefined || text(v, max);
const snapshotKeys = [
  "slot",
  "sourceType",
  "sourceId",
  "sourceRevision",
  "sourceTitle",
  "parentCharacterId",
  "promptText",
  "compactText",
  "avoidText",
  "mediaLinks",
  "overrideText",
  "overrideCompactText",
  "identityRevision",
  "identityAnchor",
  "cameraComposition",
];
function snapshotError(
  v: unknown,
  slot: "character" | "wardrobe",
): string | undefined {
  if (
    !record(v) ||
    !keys(v, snapshotKeys) ||
    v.slot !== slot ||
    ![
      "asset",
      "template",
      ...(slot === "wardrobe" ? ["variant"] : []),
    ].includes(String(v.sourceType)) ||
    !text(v.sourceId, 1000, true) ||
    !text(v.sourceTitle, 1000, true) ||
    !Number.isSafeInteger(v.sourceRevision) ||
    (v.sourceRevision as number) < 1 ||
    !text(v.promptText, 100000, true)
  )
    return `Invalid ${slot} snapshot.`;
  for (const k of [
    "compactText",
    "avoidText",
    "overrideText",
    "overrideCompactText",
  ])
    if (!optionalText(v[k], 100000)) return `Invalid ${slot} snapshot text.`;
  if (
    slot === "character" &&
    (v.overrideText !== undefined || v.overrideCompactText !== undefined)
  )
    return "Character identity overrides are not allowed.";
  if (
    v.parentCharacterId !== undefined &&
    !text(v.parentCharacterId, 1000, true)
  )
    return "Invalid wardrobe parent Character ID.";
  if (
    !Array.isArray(v.mediaLinks) ||
    v.mediaLinks.length > MAX_FILES_PER_RECORD
  )
    return `Invalid ${slot} reference list.`;
  for (const link of v.mediaLinks) {
    if (
      !record(link) ||
      !text(link.mediaId, 1000, true) ||
      !["reference", "sample", "result"].includes(String(link.role)) ||
      !text(link.altText, 10000) ||
      !Number.isSafeInteger(link.order) ||
      (link.order as number) < 0
    )
      return `Invalid ${slot} reference association.`;
    for (const k of [
      "filename",
      "mimeType",
      "viewLabel",
      "displayName",
      "exportFilename",
    ])
      if (!optionalText(link[k], 1000))
        return `Invalid ${slot} reference metadata.`;
    if (link.namesCaptured !== undefined && link.namesCaptured !== true)
      return `Invalid ${slot} captured names.`;
  }
  return validatePhase4Record({ slots: { [slot]: v } });
}
/** Structural draft validation preserves incomplete cue text; assembly requires complete speech. */
export function validateSceneEnsemble(
  source: unknown,
  options: { forAssembly?: boolean } = {},
): string[] {
  if (!record(source)) return ["Invalid ensemble source."];
  if (source.ensemble === undefined) return [];
  const errors: string[] = [],
    e = source.ensemble;
  if (source.authoringMode === "direct_prompt")
    errors.push(
      "Direct Prompt cannot carry an assembled ensemble. Create a recipe separately.",
    );
  if (source.dialogue !== undefined)
    errors.push(
      "Use dialogue cues instead of a second legacy dialogue record.",
    );
  if (
    !record(e) ||
    !keys(e, [
      "version",
      "primaryParticipantId",
      "participants",
      "dialogueCues",
    ]) ||
    e.version !== 1 ||
    !Array.isArray(e.participants) ||
    !Array.isArray(e.dialogueCues)
  )
    return [...errors, "Invalid ensemble version or structure."];
  if (
    e.participants.length > ENSEMBLE_LIMITS.participants ||
    e.dialogueCues.length > ENSEMBLE_LIMITS.cues
  )
    return [
      ...errors,
      `Ensembles allow at most ${ENSEMBLE_LIMITS.participants} participants and ${ENSEMBLE_LIMITS.cues} dialogue cues.`,
    ];
  if (e.primaryParticipantId !== null && !id(e.primaryParticipantId))
    errors.push("Select a valid primary participant ID or no visual primary.");
  const participants = new Map<string, Record<string, unknown>>(),
    characters = new Set<string>();
  for (const p of e.participants) {
    if (
      !record(p) ||
      !keys(p, [
        "id",
        "character",
        "wardrobe",
        "role",
        "presence",
        "performanceNotes",
        "generation",
      ]) ||
      !id(p.id)
    ) {
      errors.push("Invalid participant ID or fields.");
      continue;
    }
    const label = `Participant ${p.id}: `;
    if (participants.has(p.id))
      errors.push(label + "duplicate participant ID.");
    participants.set(p.id, p);
    if (!["on_camera", "off_camera"].includes(String(p.presence)))
      errors.push(label + "select on-camera or off-camera presence.");
    if (
      !optionalText(p.role, ENSEMBLE_LIMITS.role) ||
      !optionalText(p.performanceNotes, ENSEMBLE_LIMITS.performanceNotes)
    )
      errors.push(label + "role or performance notes exceed their bounds.");
    const characterError = snapshotError(p.character, "character");
    if (characterError) errors.push(label + characterError);
    if (p.wardrobe !== undefined) {
      const wardrobeError = snapshotError(p.wardrobe, "wardrobe");
      if (wardrobeError) errors.push(label + wardrobeError);
    }
    if (record(p.character)) {
      const key = JSON.stringify([
        p.character.sourceType,
        p.character.sourceId,
      ]);
      if (characters.has(key))
        errors.push(label + "duplicate Character source.");
      characters.add(key);
      if (
        record(p.wardrobe) &&
        p.wardrobe.sourceType === "variant" &&
        (p.character.sourceType !== "asset" ||
          p.wardrobe.parentCharacterId !== p.character.sourceId)
      )
        errors.push(
          label +
            "Outfit variant belongs to a different parent Character. Select a compatible Outfit.",
        );
      const metadata = validatePhase4Record({
        slots: {
          character: p.character,
          ...(record(p.wardrobe) ? { wardrobe: p.wardrobe } : {}),
        },
        ...(p.generation !== undefined ? { generation: p.generation } : {}),
      });
      if (metadata) errors.push(label + metadata);
    }
  }
  const visual = [...participants.values()].filter(
    (p) => p.presence === "on_camera",
  );
  const primary =
    typeof e.primaryParticipantId === "string"
      ? participants.get(e.primaryParticipantId)
      : undefined;
  if (
    (visual.length && (!primary || primary.presence !== "on_camera")) ||
    (!visual.length && e.primaryParticipantId !== null)
  )
    errors.push(
      "Select an existing on-camera primary participant, or no primary when everyone is off-camera.",
    );
  const slots = record(source.slots) ? source.slots : {};
  const projected = primary?.presence === "on_camera" ? primary : undefined;
  if (
    !same(slots.character, projected?.character) ||
    !same(slots.wardrobe, projected?.wardrobe) ||
    !same(source.generation, projected?.generation)
  )
    errors.push(
      "The primary participant mirror differs from the stored Character, wardrobe or generation. Review and synchronize the primary controls.",
    );
  if (source.shotType !== undefined && !isShotType(source.shotType))
    errors.push("Select a valid Shot Type.");
  else {
    const ruleSource = {
      shotType: source.shotType as
        import("../types/domain").ShotType | undefined,
      slots: {},
    };
    if (
      getShotTypeRules(ruleSource).inapplicableSlots.includes("character") &&
      visual.length
    )
      errors.push(
        "This Shot Type does not support visual Character participants. Use off-camera narration or change Shot Type.",
      );
    if (
      options.forAssembly &&
      resolveShotType(ruleSource) === "character_scene" &&
      e.dialogueCues.length &&
      !visual.length
    )
      errors.push(
        "A Character Scene with dialogue requires a visual Character participant. Use a non-character Shot Type for narration-only work.",
      );
  }
  const cueIds = new Set<string>();
  const duration = record(source.settings)
    ? source.settings.durationSeconds
    : undefined;
  for (const cue of e.dialogueCues) {
    if (
      !record(cue) ||
      !keys(cue, [
        "id",
        "participantId",
        "speaker",
        "line",
        "mode",
        "deliveryNotes",
        "performanceDirection",
        "language",
        "captionPreference",
        "timing",
      ]) ||
      !id(cue.id)
    ) {
      errors.push("Invalid dialogue cue ID or fields.");
      continue;
    }
    const label = `Cue ${cue.id}: `;
    if (cueIds.has(cue.id)) errors.push(label + "duplicate cue ID.");
    cueIds.add(cue.id);
    if (
      !text(cue.speaker, 100) ||
      !text(cue.line, 4000) ||
      !optionalText(cue.deliveryNotes, 1000) ||
      !optionalText(cue.language, 100)
    )
      errors.push(
        label + "invalid speaker, exact line or delivery text bounds.",
      );
    if (
      options.forAssembly &&
      (!text(cue.speaker, 100, true) || !text(cue.line, 4000, true))
    )
      errors.push(
        label + "enter a speaker and exact spoken line before assembling.",
      );
    if (
      cue.mode !== undefined &&
      !["spoken", "on_camera", "voiceover", "off_screen"].includes(
        String(cue.mode),
      )
    )
      errors.push(label + "invalid dialogue mode.");
    if (
      cue.captionPreference !== undefined &&
      !["unspecified", "none", "requested"].includes(
        String(cue.captionPreference),
      )
    )
      errors.push(label + "invalid caption preference.");
    if (
      cue.participantId !== undefined &&
      (!id(cue.participantId) || !participants.has(cue.participantId))
    )
      errors.push(
        label +
          "select an existing linked participant or explicitly leave narration unlinked.",
      );
    if (
      cue.mode === undefined ||
      ["spoken", "on_camera"].includes(String(cue.mode))
    ) {
      const speaker =
        typeof cue.participantId === "string"
          ? participants.get(cue.participantId)
          : undefined;
      if (!speaker || speaker.presence !== "on_camera")
        errors.push(
          label +
            "on-camera speech requires an explicit on-camera participant.",
        );
    }
    const performance = validatePerformanceDirection(cue.performanceDirection);
    if (performance) errors.push(label + performance);
    const timing=validateDialogueCueTiming(cue.timing,typeof duration==='number'?duration:undefined);
    if(timing)errors.push(label+timing);
  }
  return errors;
}
export function validateDialogueCueTiming(t:unknown,duration?:number):string|undefined{
 if(t===undefined)return;
 if(!record(t)||!keys(t,['startSeconds','endSeconds'])||typeof t.startSeconds!=='number'||typeof t.endSeconds!=='number'||!Number.isFinite(t.startSeconds)||!Number.isFinite(t.endSeconds)||t.startSeconds<0||t.endSeconds<=t.startSeconds||typeof duration==='number'&&t.endSeconds>duration)return'intended timing must have a finite start/end within the scene duration.';
}
