import React, { useState } from "react";
import type { SceneEnsembleV1 } from "../types/ensemble";
import "./ensemble.css";
export function EnsembleSummary({
  ensemble,
  label = "Ensemble participants and cues",
}: {
  ensemble: SceneEnsembleV1;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <section className="ensemble-review" aria-label={label}>
      <h3>{label}</h3>
      <p className="muted-text">
        {ensemble.participants.length} participants ·{" "}
        {ensemble.dialogueCues.length} ordered cues. Identity descriptions are
        frozen and read only.
      </p>
      {ensemble.participants.map((p) => (
        <details key={p.id}>
          <summary>{p.character.sourceTitle} locked identity</summary>
          <p>
            <code>{p.id}</code> · {p.presence} ·{" "}
            {p.id === ensemble.primaryParticipantId ? "Primary" : "Supporting"}{" "}
            · {p.role || "No role entered"}
          </p>
          <p>
            Character: {p.character.sourceType} ·{" "}
            <code>{p.character.sourceId}</code> · rev{" "}
            {p.character.sourceRevision}
          </p>
          <label>
            {p.character.sourceTitle} master identity
            <textarea
              className="textarea"
              readOnly
              rows={4}
              value={p.character.promptText}
            />
          </label>
          <p>
            Generation: {p.generation?.identitySource ?? "master"}
            {p.generation?.fallbackReason
              ? ` · ${p.generation.fallbackReason}`
              : ""}
          </p>
          {p.generation?.anchor && (
            <details>
              <summary>Captured approved generation anchor</summary>
              <pre>{p.generation.anchor.text}</pre>
            </details>
          )}
          {p.wardrobe && (
            <>
              <p>
                Clothing: {p.wardrobe.sourceTitle} · {p.wardrobe.sourceType} ·{" "}
                <code>{p.wardrobe.sourceId}</code> · rev{" "}
                {p.wardrobe.sourceRevision}
              </p>
              <label>
                {p.character.sourceTitle} clothing prompt
                <textarea
                  className="textarea"
                  readOnly
                  rows={3}
                  value={p.wardrobe.overrideText ?? p.wardrobe.promptText}
                />
              </label>
            </>
          )}
          {p.performanceNotes && (
            <p className="ensemble-exact">Performance: {p.performanceNotes}</p>
          )}
          {[p.character, p.wardrobe].flatMap((snapshot, index) =>
            (snapshot?.mediaLinks ?? []).map((m, i) => (
              <p key={`${index}:${i}`}>
                <code>{m.mediaId}</code> · {m.role} ·{" "}
                {m.displayName ?? m.altText}
              </p>
            )),
          )}
        </details>
      ))}
      <ol>
        {ensemble.dialogueCues.map((c) => (
          <li key={c.id}>
            <details>
              <summary>
                {c.speaker || "Speaker not entered"} · cue {c.id} ·{" "}
                {c.mode ?? "spoken"}
              </summary>
              <p>
                Linked participant:{" "}
                {c.participantId ?? "Unlinked narration / off-screen speaker"} ·
                Language: {c.language ?? "Unspecified"} · Captions:{" "}
                {c.captionPreference ?? "unspecified"}
              </p>
              {c.timing && (
                <p>
                  Intended timing: {c.timing.startSeconds}–{c.timing.endSeconds}
                  s
                </p>
              )}
              <label>
                Exact line {c.id}
                <textarea
                  className="textarea"
                  readOnly
                  rows={4}
                  value={c.line}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.line);
                    setStatus(`Copied exact cue ${c.id}.`);
                  } catch {
                    setStatus(
                      "Copy failed. Select the full line above and copy it manually.",
                    );
                  }
                }}
              >
                Copy exact cue {c.id}
              </button>
              {(c.deliveryNotes || c.performanceDirection) && (
                <details>
                  <summary>Delivery and Performance Studio data</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        deliveryNotes: c.deliveryNotes,
                        performanceDirection: c.performanceDirection,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </details>
          </li>
        ))}
      </ol>
      <p role="status">{status}</p>
    </section>
  );
}
