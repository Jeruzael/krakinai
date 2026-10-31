import React, { useState } from "react";
import type { PromptAsset, SceneDraft, Variant } from "../types/domain";
import type { SceneParticipant } from "../types/ensemble";
import type {
  RecipeEnsemblePatch,
  RecipeParticipantUpsert,
} from "../types/changeSet";
import { resolveGenerationIdentity } from "../domain/identityAnchors";
import { ENSEMBLE_LIMITS } from "../types/ensemble";
export function ParticipantEditor({
  draft,
  participant,
  assets,
  variants,
  busy,
  onSave,
  onBack,
}: {
  draft: SceneDraft;
  participant?: SceneParticipant;
  assets: PromptAsset[];
  variants: Variant[];
  busy: boolean;
  onSave: (patch: RecipeEnsemblePatch) => void;
  onBack: () => void;
}) {
  const [id] = useState(
    () => participant?.id ?? `participant_${crypto.randomUUID()}`,
  );
  const [character, setCharacter] = useState(
    participant?.character.sourceType === "asset"
      ? participant.character.sourceId
      : "",
  );
  const [refreshCharacter, setRefreshCharacter] = useState(!participant);
  const originalClothing = participant?.wardrobe
    ? `${participant.wardrobe.sourceType}:${participant.wardrobe.sourceId}`
    : "";
  const [clothing, setClothing] = useState(originalClothing),
    [role, setRole] = useState(participant?.role ?? ""),
    [presence, setPresence] = useState(participant?.presence ?? "on_camera");
  const [performance, setPerformance] = useState(
      participant?.performanceNotes ?? "",
    ),
    [identity, setIdentity] = useState(
      participant?.generation?.identitySource ?? "master",
    );
  const [identityChanged, setIdentityChanged] = useState(false),
    [primary, setPrimary] = useState(
      draft.ensemble!.primaryParticipantId ?? "",
    );
  const selected = assets.find(
    (a) => a.id === character && a.category === "characters",
  );
  const outfits = variants.filter(
    (v) =>
      v.type === "Outfit" &&
      v.targetSlot === "wardrobe" &&
      v.parentCharacterId === character &&
      !!selected,
  );
  const wardrobe = assets.filter((a) => a.category === "wardrobe");
  const compatibleIds = [
    ...wardrobe.map((a) => `asset:${a.id}`),
    ...outfits.map((v) => `variant:${v.id}`),
  ];
  const currentIdentity = participant
    ? resolveGenerationIdentity(
        {
          slots: { character: participant.character },
          generation: participant.generation,
        },
        assets.find((a) => a.id === participant.character.sourceId),
      )
    : undefined;
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const update: RecipeParticipantUpsert = {
      id,
      role,
      presence,
      performanceNotes: performance,
    };
    if (
      refreshCharacter ||
      character !==
        (participant?.character.sourceType === "asset"
          ? participant.character.sourceId
          : "")
    )
      update.character = {
        asset: { id: character },
        expectedRevision: selected?.revision ?? -1,
      };
    if (clothing !== originalClothing) {
      if (!clothing) update.wardrobe = null;
      else {
        const [kind, ...parts] = clothing.split(":"),
          sourceId = parts.join(":");
        if (kind === "asset")
          update.wardrobe = {
            asset: { id: sourceId },
            expectedRevision:
              assets.find((a) => a.id === sourceId)?.revision ?? -1,
          };
        else
          update.wardrobe = {
            variant: { id: sourceId },
            expectedRevision:
              variants.find((v) => v.id === sourceId)?.revision ?? -1,
          };
      }
    }
    if (identityChanged) update.identitySource = identity;
    onSave({
      version: 1,
      participantUpserts: [update],
      primaryParticipantId: primary || null,
    });
  };
  return (
    <form className="ensemble-editor form-grid" onSubmit={save}>
      <h3 tabIndex={-1} data-ensemble-heading>
        {participant ? "Edit participant" : "Add participant"}
      </h3>
      <p className="muted-text">
        Stable participant ID: <code>{id}</code>
      </p>
      <label>
        Character
        <select
          className="select"
          value={character}
          onChange={(event) => {
            setCharacter(event.target.value);
            setRefreshCharacter(!!event.target.value || !participant);
            setIdentity("master");
            setIdentityChanged(true);
          }}
        >
          <option value="">
            {participant?.character.sourceType === "template"
              ? "Keep frozen template identity"
              : "Choose an actual stored Character"}
          </option>
          {character && !selected && (
            <option value={character}>
              Keep unavailable frozen Character ({character})
            </option>
          )}
          {assets
            .filter((a) => a.category === "characters")
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · rev {a.revision}
              </option>
            ))}
        </select>
      </label>
      {participant && (
        <details>
          <summary>Full locked identity</summary>
          <label>
            Locked identity
            <textarea
              className="textarea"
              readOnly
              rows={5}
              value={participant.character.promptText}
            />
          </label>
          <p className="muted-text">
            Frozen {participant.character.sourceType} ·{" "}
            {participant.character.sourceId} · rev{" "}
            {participant.character.sourceRevision}. Identity text is never
            rewritten here.
          </p>
        </details>
      )}
      {participant?.character.sourceType === "template" && (
        <p className="banner banner-info">
          This frozen template identity is unbound. It has no inferred Character
          ID or Character Bible. Choose a real Character before using its Outfit
          variants or approved anchor.
        </p>
      )}
      {participant && selected && (
        <label className="import-check">
          <input
            type="checkbox"
            checked={refreshCharacter}
            onChange={(event) => setRefreshCharacter(event.target.checked)}
          />
          Refresh this Character snapshot from its current library revision
        </label>
      )}
      <label>
        Clothing / Outfit
        <select
          className="select"
          value={clothing}
          onChange={(event) => setClothing(event.target.value)}
        >
          <option value="">No per-person clothing</option>
          {clothing && !compatibleIds.includes(clothing) && (
            <option value={clothing}>
              Keep frozen clothing — review compatibility
            </option>
          )}
          <optgroup label="Shared wardrobe assets">
            {wardrobe.map((a) => (
              <option key={a.id} value={`asset:${a.id}`}>
                {a.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Outfits for the selected Character">
            {outfits.map((v) => (
              <option key={v.id} value={`variant:${v.id}`}>
                {v.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <p className="muted-text">
        Changing Character does not reassign an Outfit. Explicitly clear
        incompatible clothing or select a matching Outfit.
      </p>
      <label>
        Presence
        <select
          className="select"
          value={presence}
          onChange={(event) =>
            setPresence(event.target.value as typeof presence)
          }
        >
          <option value="on_camera">On camera</option>
          <option value="off_camera">Off camera</option>
        </select>
      </label>
      <label>
        Primary participant
        <select
          className="select"
          value={primary}
          onChange={(event) => setPrimary(event.target.value)}
        >
          <option value="">No visual primary</option>
          {draft
            .ensemble!.participants.filter((p) => p.id !== id)
            .map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={p.presence !== "on_camera"}
              >
                {p.character.sourceTitle}
                {p.presence === "off_camera" ? " (off camera)" : ""}
              </option>
            ))}
          <option value={id} disabled={presence !== "on_camera"}>
            {selected?.title ??
              participant?.character.sourceTitle ??
              "This new participant"}
          </option>
        </select>
      </label>
      <label>
        Role
        <input
          className="input"
          maxLength={ENSEMBLE_LIMITS.role}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
      </label>
      <label>
        Performance notes
        <textarea
          className="textarea"
          rows={3}
          maxLength={ENSEMBLE_LIMITS.performanceNotes}
          value={performance}
          onChange={(event) => setPerformance(event.target.value)}
        />
      </label>
      <label>
        Generation identity
        <select
          className="select"
          value={identity}
          onChange={(event) => {
            setIdentity(event.target.value as typeof identity);
            setIdentityChanged(true);
          }}
        >
          <option value="master">Master identity</option>
          <option value="approved_anchor" disabled={!selected}>
            Approved anchor, when still valid
          </option>
        </select>
      </label>
      <p className="muted-text">
        Master outputs retain the complete frozen identity. Generation exports
        independently check this participant’s approved anchor.
      </p>
      {currentIdentity?.reason && (
        <p className="banner banner-warning">{currentIdentity.reason}</p>
      )}
      <div className="ensemble-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onBack}
        >
          Back to participants
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Save participant
        </button>
      </div>
    </form>
  );
}
