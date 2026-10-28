import React, { useId } from 'react';
import type {
  PromptAsset,
  SavedScene,
  SceneDraft,
  SceneGenerationChoice,
} from '../types/domain';
import {
  getIdentityAnchorStatus,
  getIdentityRevision,
  resolveGenerationIdentity,
} from '../domain/identityAnchors';
import './generationIdentity.css';

export const GenerationIdentityControl: React.FC<{
  source: SceneDraft | SavedScene;
  liveMaster?: PromptAsset;
  saved?: boolean;
  compact?: boolean;
  onChange?: (choice: SceneGenerationChoice) => void | Promise<void>;
}> = ({ source, liveMaster, saved = false, compact = false, onChange }) => {
  const id = useId();
  const anchor = source.slots.character?.identityAnchor;
  const candidate: SceneGenerationChoice = {
    identitySource: 'approved_anchor',
    ...(anchor?.approvedText &&
    anchor.approvedAt &&
    anchor.approvedMasterIdentityRevision !== undefined
      ? {
          anchor: {
            text: anchor.approvedText,
            approvedAt: anchor.approvedAt,
            approvedMasterIdentityRevision:
              anchor.approvedMasterIdentityRevision,
          },
        }
      : {}),
  };
  const available =
    !saved &&
    resolveGenerationIdentity(
      { ...source, generation: candidate },
      liveMaster,
      false
    ).identity.source === 'approved_anchor';
  const resolved = resolveGenerationIdentity(source, liveMaster, saved);
  const character = source.slots.character;
  const status = saved
    ? resolved.identity.source === 'approved_anchor'
      ? 'Approved in saved snapshot'
      : 'Master Identity in saved snapshot'
    : available
      ? 'Approved and current'
      : liveMaster && getIdentityAnchorStatus(liveMaster) === 'stale'
        ? 'Stale'
        : 'Draft or unavailable';
  const explanation = (
    <>
      <span className="muted-text">
        Master Identity is the complete authoritative description. An Identity
        Anchor is optional shorter text that you approve for generation.
      </span>
      <span className="muted-text">
        {resolved.reason ??
          (saved
            ? 'Frozen generation identity. Edit a Copy to change.'
            : available
              ? 'Applies to generation exports; canonical outputs keep the master.'
              : 'Approve an anchor, then refresh the selected Character snapshot to use it.')}
      </span>
    </>
  );
  return (
    <div className="generation-identity-control">
      <label htmlFor={id} className="form-label">
        Character Identity Source
      </label>
      <select
        id={id}
        className="select"
        value={resolved.identity.source}
        disabled={saved || !source.slots.character}
        onChange={(event) =>
          void onChange?.(
            event.target.value === 'approved_anchor'
              ? candidate
              : { identitySource: 'master' }
          )
        }
      >
        <option value="master">Full Master Identity</option>
        <option
          value="approved_anchor"
          disabled={
            !available && resolved.identity.source !== 'approved_anchor'
          }
        >
          Approved Identity Anchor
        </option>
      </select>
      <span
        className={`badge ${available || (saved && resolved.identity.source === 'approved_anchor') ? 'badge-success' : ''}`}
      >
        {status}
      </span>
      {character && (
        <span className="muted-text identity-source-revision">
          Master revision {getIdentityRevision(character)} · Selected record
          revision {character.sourceRevision}
        </span>
      )}
      {compact ? (
        <details className="generation-identity-help">
          <summary>Identity source details</summary>
          <div>{explanation}</div>
        </details>
      ) : (
        explanation
      )}
    </div>
  );
};
