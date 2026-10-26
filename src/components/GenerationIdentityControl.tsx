import React, { useId } from 'react';
import type { PromptAsset, SavedScene, SceneDraft, SceneGenerationChoice } from '../types/domain';
import { resolveGenerationIdentity } from '../domain/identityAnchors';
import './generationIdentity.css';

export const GenerationIdentityControl: React.FC<{
  source: SceneDraft | SavedScene;
  liveMaster?: PromptAsset;
  saved?: boolean;
  onChange?: (choice: SceneGenerationChoice) => void | Promise<void>;
}> = ({source, liveMaster, saved = false, onChange}) => {
  const id = useId();
  const anchor = source.slots.character?.identityAnchor;
  const candidate: SceneGenerationChoice = {
    identitySource:'approved_anchor',
    ...(anchor?.approvedText && anchor.approvedAt && anchor.approvedMasterIdentityRevision !== undefined ? {
      anchor:{text:anchor.approvedText,approvedAt:anchor.approvedAt,approvedMasterIdentityRevision:anchor.approvedMasterIdentityRevision},
    } : {}),
  };
  const available = resolveGenerationIdentity({...source,generation:candidate},liveMaster,saved).identity.source === 'approved_anchor';
  const resolved = resolveGenerationIdentity(source,liveMaster,saved);
  return <div className="generation-identity-control">
    <label htmlFor={id} className="form-label">Character Identity Source</label>
    <select id={id} className="select" value={resolved.identity.source} disabled={saved || !source.slots.character} onChange={event => void onChange?.(event.target.value === 'approved_anchor' ? candidate : {identitySource:'master'})}>
      <option value="master">Full Master Identity</option>
      <option value="approved_anchor" disabled={!available && resolved.identity.source !== 'approved_anchor'}>Approved Identity Anchor</option>
    </select>
    <span className="muted-text">{resolved.reason ?? (saved ? 'Frozen generation identity. Edit a Copy to change.' : available ? 'Applies to generation exports; canonical outputs keep the master.' : 'Approve an anchor, then refresh the selected Character snapshot to use it.')}</span>
  </div>;
};
