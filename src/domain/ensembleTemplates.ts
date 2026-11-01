import type { SceneDraft, Template } from "../types/domain";
import type { EnsembleTemplateDefaultV1 } from "../types/ensemble";
import { syncEnsemblePrimary, type EnsembleSource } from "./ensemble";
import { validateSceneEnsemble } from "./ensembleValidation";
import { validatePhase4Record } from "./phase4Validation";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function createEnsembleTemplateDefault(
  draft: SceneDraft,
  includeEnsemble: boolean,
): EnsembleTemplateDefaultV1 | undefined {
  if (!draft.ensemble || !includeEnsemble) return;
  const error = validateSceneEnsemble(draft)[0];
  if (error) throw Error(error);
  const entries = draft.referencePack?.entries
    // Selected provenance can outlive a participant. Shared non-participant
    // template pack associations remain outside this explicit template feature.
    .filter((e) => e.participantId)
    .map((e, order) => ({ ...structuredClone(e), order }));
  return {
    version: 1,
    ensemble: structuredClone(draft.ensemble),
    ...(entries ? { referencePack: { version: 1, entries } } : {}),
  };
}
export function applyEnsembleTemplateDefault<T extends EnsembleSource>(
  template: Pick<Template, "ensembleDefault">,
  draft: T,
): T {
  if (!template.ensembleDefault) return draft;
  return syncEnsemblePrimary({
    ...structuredClone(draft),
    ensemble: structuredClone(template.ensembleDefault.ensemble),
    ...(template.ensembleDefault.referencePack
      ? {
          referencePack: structuredClone(
            template.ensembleDefault.referencePack,
          ),
        }
      : {}),
  });
}
export function validateEnsembleTemplateDefault(
  template: Record<string, unknown>,
): string | undefined {
  if (template.ensembleDefault === undefined) return;
  const d = template.ensembleDefault;
  if (
    !record(d) ||
    d.version !== 1 ||
    Object.keys(d).some(
      (k) => !["version", "ensemble", "referencePack"].includes(k),
    ) ||
    !record(d.ensemble) ||
    !Array.isArray(d.ensemble.participants)
  )
    return "Invalid ensemble template defaults.";
  if (
    template.includedCharacterSnapshot !== undefined ||
    (record(template.defaults) && template.defaults.wardrobe !== undefined)
  )
    return "Ensemble template defaults cannot also contain a separate primary Character or wardrobe default.";
  const ensemble = d.ensemble;
  const primary = (ensemble.participants as unknown[]).find(
    (p) => record(p) && p.id === ensemble.primaryParticipantId,
  );
  const source = {
    ensemble: d.ensemble,
    slots:
      record(primary) && primary.presence === "on_camera"
        ? {
            character: primary.character,
            ...(primary.wardrobe !== undefined
              ? { wardrobe: primary.wardrobe }
              : {}),
          }
        : {},
    ...(record(primary) && primary.generation !== undefined
      ? { generation: primary.generation }
      : {}),
    settings: template.settingsDefault ?? {},
    shotType: template.shotType,
    ...(d.referencePack !== undefined
      ? { referencePack: d.referencePack }
      : {}),
  };
  return validatePhase4Record(source);
}
