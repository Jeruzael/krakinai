import React from "react";
import type { SceneEnsembleV1 } from "../types/ensemble";
export function EnsembleTemplateChoice({
  ensemble,
  mode,
  confirmed,
  onMode,
  onConfirm,
}: {
  ensemble: SceneEnsembleV1;
  mode?: "full" | "shared_only";
  confirmed: boolean;
  onMode: (mode: "full" | "shared_only" | undefined) => void;
  onConfirm: (confirmed: boolean) => void;
}) {
  return (
    <fieldset className="ensemble-template-choice">
      <legend>Save ensemble explicitly</legend>
      <label>
        Ensemble contents
        <select
          className="select"
          required
          value={mode ?? ""}
          onChange={(event) =>
            onMode((event.target.value as typeof mode) || undefined)
          }
        >
          <option value="">Choose what this template contains</option>
          <option value="full">
            Full ensemble: participants, outfits and ordered cues
          </option>
          <option value="shared_only">Shared components only</option>
        </select>
      </label>
      {mode === "full" && (
        <p className="muted-text">
          Captures all participants, their locked identities, per-person
          clothing, ordered cues and their selected reference associations.
          Keeps shared scene components alongside the complete ensemble.
        </p>
      )}
      {mode === "shared_only" && (
        <>
          <p className="banner banner-warning">
            Omits {ensemble.participants.length} participants,{" "}
            {ensemble.participants.filter((p) => p.wardrobe).length} per-person
            clothing selections and {ensemble.dialogueCues.length} dialogue
            cues, plus their participant reference associations. Your draft and
            original files remain stored.
          </p>
          <ul aria-label="Omitted participants and clothing">
            {ensemble.participants.map((p) => (
              <li key={p.id}>
                {p.character.sourceTitle} ·{" "}
                {p.wardrobe?.sourceTitle ?? "No per-person clothing"}
              </li>
            ))}
          </ul>
          <details>
            <summary>
              Omitted ordered cues ({ensemble.dialogueCues.length})
            </summary>
            <ol>
              {ensemble.dialogueCues.map((c) => (
                <li key={c.id}>
                  <strong>
                    {c.speaker || "Speaker not entered"} · {c.id}
                  </strong>
                  <p className="ensemble-exact">
                    {c.line || "Line not entered"}
                  </p>
                </li>
              ))}
            </ol>
          </details>
          <label className="import-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => onConfirm(event.target.checked)}
            />
            I acknowledge these ensemble omissions
          </label>
        </>
      )}
    </fieldset>
  );
}
