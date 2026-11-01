import React, { useState, useRef, useEffect } from "react";
import { Users, MessageSquare } from "lucide-react";
import type { PromptAsset, SceneDraft, Variant } from "../types/domain";
import type { DialogueCue } from "../types/ensemble";
import { ENSEMBLE_LIMITS } from "../types/ensemble";
import type { RecipeEnsemblePatch } from "../types/changeSet";
import { enableSceneEnsemble } from "../domain/ensemble";
import { applyRecipeEnsemblePatch } from "../domain/changeSetEnsemble";
import { StudioDialog } from "./StudioDialog";
import { ParticipantEditor } from "./ParticipantEditor";
import { DialogueCueEditor } from "./DialogueCueEditor";
import "./ensemble.css";
type View = {
  kind:
    | "enable"
    | "participants"
    | "cues"
    | "edit_participant"
    | "edit_cue"
    | "remove_participant"
    | "remove_cue";
  id?: string;
};
export function EnsembleControls({
  draft,
  assets,
  variants,
  onChange,
  request,
}: {
  draft: SceneDraft;
  assets: PromptAsset[];
  variants: Variant[];
  onChange: (next: SceneDraft) => Promise<boolean | void> | boolean | void;
  request?: { kind: "participants" | "cues"; id?: string; token: number };
}) {
  const [view, setView] = useState<View>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const content = useRef<HTMLDivElement>(null),
    returnFocus = useRef<HTMLElement | null>(null),
    mainButton = useRef<HTMLButtonElement>(null);
  const ensemble = draft.ensemble;
  const open = (next: View, trigger?: HTMLElement) => {
    if (trigger) returnFocus.current = trigger;
    setError("");
    setView(next);
  };
  useEffect(() => {
    if (request && ensemble)
      open(
        {
          kind: request.id
            ? request.kind === "participants"
              ? "edit_participant"
              : "edit_cue"
            : request.kind,
          id: request.id,
        },
        document.activeElement as HTMLElement,
      );
  }, [request]);
  useEffect(() => {
    content.current
      ?.querySelector<HTMLElement>("[data-ensemble-heading]")
      ?.focus();
  }, [view?.kind, view?.id]);
  useEffect(() => {
    if (!returnFocus.current?.isConnected)
      returnFocus.current = mainButton.current;
  }, [!!ensemble]);
  const save = async (next: SceneDraft, after?: View) => {
    setBusy(true);
    setError("");
    try {
      if ((await onChange(next)) === false)
        throw Error(
          "Draft could not be saved. Your editing controls remain here; retry after resolving the save error.",
        );
      setView(after);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const patch = (value: RecipeEnsemblePatch, after?: View) => {
    try {
      void save(
        applyRecipeEnsemblePatch(
          draft,
          value,
          { assets, variants },
          (_kind, target) => {
            if (!("id" in target))
              throw Error("Choose an actual library record.");
            return target.id;
          },
        ),
        after,
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const move = (
    type: "participants" | "dialogueCues",
    id: string,
    delta: number,
  ) => {
    const items = [...ensemble![type]],
      index = items.findIndex((item) => item.id === id),
      other = index + delta;
    if (index < 0 || other < 0 || other >= items.length) return;
    [items[index], items[other]] = [items[other], items[index]];
    patch(
      type === "participants"
        ? { version: 1, participantOrder: items.map((item) => item.id) }
        : { version: 1, dialogueCues: items as DialogueCue[] },
      view,
    );
  };
  const participant = ensemble?.participants.find((p) => p.id === view?.id),
    cue = ensemble?.dialogueCues.find((c) => c.id === view?.id);
  return (
    <section
      className="ensemble-controls"
      aria-label="Participants and ordered dialogue"
    >
      {!ensemble ? (
        <button
          ref={mainButton}
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={(event) => open({ kind: "enable" }, event.currentTarget)}
        >
          <Users size={16} />
          Enable participants &amp; ordered cues
        </button>
      ) : (
        <div className="ensemble-toolbar">
          <button
            ref={mainButton}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(event) =>
              open({ kind: "participants" }, event.currentTarget)
            }
          >
            <Users size={16} />
            Participants ({ensemble.participants.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(event) => open({ kind: "cues" }, event.currentTarget)}
          >
            <MessageSquare size={16} />
            Dialogue cues ({ensemble.dialogueCues.length})
          </button>
          <span className="muted-text">
            Primary:{" "}
            {ensemble.participants.find(
              (p) => p.id === ensemble.primaryParticipantId,
            )?.character.sourceTitle ?? "No visual primary"}
          </span>
          {ensemble.participants.some((p) => p.generation?.fallbackReason) && (
            <span className="badge badge-warning">
              Review identity fallback in Participants
            </span>
          )}
        </div>
      )}
      {view && (
        <StudioDialog
          title={
            view.kind === "enable"
              ? "Enable participants and ordered cues"
              : view.kind.includes("participant")
                ? "Participants"
                : "Ordered dialogue cues"
          }
          onClose={() => !busy && setView(undefined)}
          size="wide"
          returnFocusRef={returnFocus}
        >
          <div ref={content} className="ensemble-dialog">
            {error && (
              <p role="alert" className="banner banner-error">
                {error}
              </p>
            )}
            {view.kind === "enable" && (
              <>
                <h3 tabIndex={-1} data-ensemble-heading>
                  Opt in for this draft
                </h3>
                <p>
                  Add compact participant and ordered-cue controls. The existing
                  character, clothing, exact dialogue and selected references
                  stay captured. Identities and library records are not
                  rewritten.
                </p>
                <p className="muted-text">
                  Up to {ENSEMBLE_LIMITS.participants} participants and{" "}
                  {ENSEMBLE_LIMITS.cues} cues.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => {
                    try {
                      void save(enableSceneEnsemble(draft));
                    } catch (cause) {
                      setError((cause as Error).message);
                    }
                  }}
                >
                  Enable for this draft
                </button>
              </>
            )}
            {view.kind === "participants" && ensemble && (
              <>
                <h3 tabIndex={-1} data-ensemble-heading>
                  Participants
                </h3>
                <p className="muted-text">
                  {ensemble.participants.length}/{ENSEMBLE_LIMITS.participants}{" "}
                  participants. Details open separately; identity text stays
                  locked.
                </p>
                <div className="ensemble-list">
                  {ensemble.participants.map((p, index) => (
                    <article className="ensemble-row" key={p.id}>
                      <div>
                        <strong>{p.character.sourceTitle}</strong>
                        <p className="muted-text">
                          {p.presence === "on_camera"
                            ? "On camera"
                            : "Off camera"}{" "}
                          ·{" "}
                          {p.id === ensemble.primaryParticipantId
                            ? "Primary · "
                            : ""}
                          {p.wardrobe?.sourceTitle ?? "No clothing selected"}
                        </p>
                      </div>
                      <div className="ensemble-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={"Edit " + p.character.sourceTitle}
                          disabled={busy}
                          onClick={() =>
                            open({ kind: "edit_participant", id: p.id })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy || index === 0}
                          aria-label={`Move participant ${p.id} up`}
                          onClick={() => move("participants", p.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={
                            busy || index === ensemble.participants.length - 1
                          }
                          aria-label={`Move participant ${p.id} down`}
                          onClick={() => move("participants", p.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={"Remove " + p.character.sourceTitle}
                          disabled={busy}
                          onClick={() =>
                            open({ kind: "remove_participant", id: p.id })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={
                    busy ||
                    ensemble.participants.length >= ENSEMBLE_LIMITS.participants
                  }
                  onClick={() => open({ kind: "edit_participant" })}
                >
                  Add participant
                </button>
              </>
            )}
            {view.kind === "edit_participant" && ensemble && (
              <ParticipantEditor
                key={view.id ?? "new"}
                draft={draft}
                participant={participant}
                assets={assets}
                variants={variants}
                busy={busy}
                onBack={() => open({ kind: "participants" })}
                onSave={(value) => patch(value, { kind: "participants" })}
              />
            )}
            {view.kind === "remove_participant" && participant && (
              <>
                <h3 tabIndex={-1} data-ensemble-heading>
                  Remove participant
                </h3>
                <p>
                  Remove {participant.character.sourceTitle} from this draft?
                  Existing files and selected reference associations remain.
                  Relink or remove their dialogue cues first; explicitly select
                  another primary if needed.
                </p>
                <div className="ensemble-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => open({ kind: "participants" })}
                  >
                    Back to participants
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() =>
                      patch(
                        { version: 1, removeParticipantIds: [participant.id] },
                        { kind: "participants" },
                      )
                    }
                  >
                    Confirm removal
                  </button>
                </div>
              </>
            )}
            {view.kind === "cues" && ensemble && (
              <>
                <h3 tabIndex={-1} data-ensemble-heading>
                  Ordered dialogue cues
                </h3>
                <p className="muted-text">
                  {ensemble.dialogueCues.length}/{ENSEMBLE_LIMITS.cues} cues.
                  Intended timing is guidance; order and exact lines are
                  preserved.
                </p>
                <div className="ensemble-list">
                  {ensemble.dialogueCues.map((c, index) => (
                    <article className="ensemble-row" key={c.id}>
                      <div>
                        <strong>
                          {index + 1}. {c.speaker || "Speaker not entered"}
                        </strong>
                        <p className="muted-text">
                          {
                            {
                              spoken: "Spoken on camera",
                              on_camera: "On camera",
                              voiceover: "Voiceover",
                              off_screen: "Off screen",
                            }[c.mode ?? "spoken"]
                          }{" "}
                          ·{" "}
                          {ensemble.participants.find(
                            (p) => p.id === c.participantId,
                          )?.character.sourceTitle ?? "Unlinked narration"}
                        </p>
                        <p className="ensemble-excerpt">
                          {c.line.slice(0, 100) || "Line not entered"}
                        </p>
                      </div>
                      <div className="ensemble-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          aria-label={`Edit cue ${c.id}`}
                          onClick={() => open({ kind: "edit_cue", id: c.id })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy || index === 0}
                          aria-label={`Move cue ${c.id} up`}
                          onClick={() => move("dialogueCues", c.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={
                            busy || index === ensemble.dialogueCues.length - 1
                          }
                          aria-label={`Move cue ${c.id} down`}
                          onClick={() => move("dialogueCues", c.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          aria-label={`Remove cue ${c.id}`}
                          onClick={() => open({ kind: "remove_cue", id: c.id })}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={
                    busy || ensemble.dialogueCues.length >= ENSEMBLE_LIMITS.cues
                  }
                  onClick={() => open({ kind: "edit_cue" })}
                >
                  Add cue
                </button>
              </>
            )}
            {view.kind === "edit_cue" && ensemble && (
              <DialogueCueEditor
                key={view.id ?? "new"}
                initial={cue}
                participants={ensemble.participants}
                busy={busy}
                onBack={() => open({ kind: "cues" })}
                onSave={(value) =>
                  patch(
                    {
                      version: 1,
                      dialogueCues: cue
                        ? ensemble.dialogueCues.map((c) =>
                            c.id === value.id ? value : c,
                          )
                        : [...ensemble.dialogueCues, value],
                    },
                    { kind: "cues" },
                  )
                }
              />
            )}
            {view.kind === "remove_cue" && cue && (
              <>
                <h3 tabIndex={-1} data-ensemble-heading>
                  Remove cue
                </h3>
                <p>
                  Remove cue {cue.id} and its exact line from this draft? Saved
                  scenes remain unchanged.
                </p>
                <div className="ensemble-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => open({ kind: "cues" })}
                  >
                    Back to cues
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() =>
                      patch(
                        {
                          version: 1,
                          dialogueCues: ensemble!.dialogueCues.filter(
                            (c) => c.id !== cue.id,
                          ),
                        },
                        { kind: "cues" },
                      )
                    }
                  >
                    Confirm removal
                  </button>
                </div>
              </>
            )}
          </div>
        </StudioDialog>
      )}
    </section>
  );
}
