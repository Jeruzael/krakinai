import React, { useState } from "react";
import type { DialogueCue, SceneParticipant } from "../types/ensemble";
import { PerformanceDirection } from "./PerformanceDirection";
export function DialogueCueEditor({
  initial,
  participants,
  busy,
  onSave,
  onBack,
}: {
  initial?: DialogueCue;
  participants: SceneParticipant[];
  busy: boolean;
  onSave: (cue: DialogueCue) => void;
  onBack: () => void;
}) {
  const [cue, setCue] = useState<DialogueCue>(() =>
    initial
      ? structuredClone(initial)
      : {
          id: `cue_${crypto.randomUUID()}`,
          speaker: "",
          line: "",
          mode: "voiceover",
        },
  );
  const [start, setStart] = useState(
      initial?.timing?.startSeconds.toString() ?? "",
    ),
    [end, setEnd] = useState(initial?.timing?.endSeconds.toString() ?? "");
  return (
    <form
      className="ensemble-editor form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const next = { ...cue };
        if (start !== "" || end !== "")
          next.timing = {
            startSeconds: start === "" ? NaN : Number(start),
            endSeconds: end === "" ? NaN : Number(end),
          };
        else delete next.timing;
        onSave(next);
      }}
    >
      <h3 tabIndex={-1} data-ensemble-heading>
        {initial ? "Edit dialogue cue" : "Add dialogue cue"}
      </h3>
      <p className="muted-text">
        Stable cue ID: <code>{cue.id}</code>. Drafts may keep incomplete lines;
        assembly checks completeness.
      </p>
      <label>
        Speaker
        <input
          className="input"
          maxLength={100}
          value={cue.speaker}
          onChange={(event) => setCue({ ...cue, speaker: event.target.value })}
        />
      </label>
      <label>
        Dialogue mode
        <select
          className="select"
          value={cue.mode ?? "spoken"}
          onChange={(event) =>
            setCue({ ...cue, mode: event.target.value as DialogueCue["mode"] })
          }
        >
          <option value="spoken">Spoken on camera (legacy)</option>
          <option value="on_camera">On-camera dialogue</option>
          <option value="voiceover">Voiceover</option>
          <option value="off_screen">Off-screen dialogue</option>
        </select>
      </label>
      <label>
        Linked participant
        <select
          className="select"
          value={cue.participantId ?? ""}
          onChange={(event) => {
            const next = { ...cue };
            if (event.target.value) next.participantId = event.target.value;
            else delete next.participantId;
            setCue(next);
          }}
        >
          <option value="">Unlinked narration / off-screen speaker</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.character.sourceTitle} ·{" "}
              {p.presence === "on_camera" ? "on camera" : "off camera"}
            </option>
          ))}
        </select>
      </label>
      <p className="muted-text">
        On-camera speech needs an explicitly linked on-camera person. Linking
        never renames the speaker or changes identity.
      </p>
      <label>
        Exact spoken line
        <textarea
          className="textarea"
          rows={5}
          maxLength={4000}
          value={cue.line}
          onChange={(event) => setCue({ ...cue, line: event.target.value })}
        />
      </label>
      <label>
        Language
        <input
          className="input"
          maxLength={100}
          value={cue.language ?? ""}
          onChange={(event) => setCue({ ...cue, language: event.target.value })}
        />
      </label>
      <label>
        Captions
        <select
          className="select"
          value={cue.captionPreference ?? "unspecified"}
          onChange={(event) =>
            setCue({
              ...cue,
              captionPreference: event.target
                .value as DialogueCue["captionPreference"],
            })
          }
        >
          <option value="unspecified">Unspecified</option>
          <option value="none">No captions</option>
          <option value="requested">Captions requested</option>
        </select>
      </label>
      <details>
        <summary>Intended timing (optional)</summary>
        <div className="ensemble-fields">
          <label>
            Start seconds
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label>
            End seconds
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>
      </details>
      <details>
        <summary>Performance Studio</summary>
        <PerformanceDirection
          dialogue={cue}
          onChange={(value) => setCue({ ...cue, ...value, id: cue.id })}
        />
      </details>
      <div className="ensemble-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onBack}
        >
          Back to cues
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Save cue
        </button>
      </div>
    </form>
  );
}
