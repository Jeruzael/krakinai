import React, { useEffect, useMemo, useState } from 'react';
import { useAiConnection } from '../../connections/AiConnectionContext';
import type { ChangeSetState } from '../../types/changeSet';
import type { McpScope } from '../../types/mcp';
import { authorizedSceneIds } from '../../domain/mcpScope';
import {
  buildPermissionInventory, CAPABILITY_FIELDS, changeSelection, clearAllRecords, DISCLOSURE_FIELDS,
  normalizePermissionDraft, PERMISSION_FIELDS, permissionFingerprint, permissionIds, permissionInventoryStamp,
  presetPermissionDraft, projectPermissionContext, selectAllRecords, validatePermissionDraft, type PermissionField,
} from '../../domain/mcpPermissionDraft';
import { StudioDialog } from '../StudioDialog';
import { PermissionRecordPicker } from './PermissionRecordPicker';
import { PermissionReview } from './PermissionReview';

export function PermissionsWorkspace({ snapshot, onDirty }: { snapshot: ChangeSetState; onDirty(value: boolean): void }) {
  const connection = useAiConnection(), { scope, phase, view } = connection;
  const [draft, setDraft] = useState(() => structuredClone(scope)), [category, setCategory] = useState<PermissionField>('projectIds');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [dependentRemoved, setDependentRemoved] = useState<string[]>([]);
  const [preset, setPreset] = useState('Custom'), [projectId, setProjectId] = useState('');
  const [fullAccess, setFullAccess] = useState<{ scope: McpScope; stamp: string }>();
  const appliedStamp = scope.epoch + ':' + permissionFingerprint(scope) + ':' + (phase === 'connected');
  const disabled = phase === 'pairing', dirty = permissionFingerprint(scope) !== permissionFingerprint(draft);
  const inventory = useMemo(() => buildPermissionInventory(snapshot, draft), [snapshot, draft]);
  const reviewInventory = useMemo(() => {
    const old = buildPermissionInventory(snapshot, scope);
    return Object.fromEntries(PERMISSION_FIELDS.map(({ field }) => [field, [...old[field], ...inventory[field].filter(row => !old[field].some(item => item.id === row.id))]])) as typeof inventory;
  }, [snapshot, scope, inventory]);
  useEffect(() => { setDraft(structuredClone(scope)); setFullAccess(undefined); setDependentRemoved([]); setError(''); setPreset('Custom'); }, [appliedStamp]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  const edit = (action: (current: McpScope) => McpScope, presetName = 'Custom') => {
    try {
      const next = normalizePermissionDraft(action(draft), snapshot);
      setDependentRemoved(draft.fullPromptSceneIds.filter(id => !next.fullPromptSceneIds.includes(id)));
      setDraft(next); setPreset(presetName); setError(''); setMessage('');
    } catch (e) { setError(e instanceof Error ? e.message : 'The selection could not be changed.'); }
  };
  const select = (field: PermissionField, ids: string[], value: boolean) => edit(current => changeSelection(current, field, ids, value));
  const reset = () => { setDraft(structuredClone(scope)); setFullAccess(undefined); setDependentRemoved([]); setPreset('Custom'); setError(''); setMessage('Unapplied changes reset. Active permissions are unchanged.'); };
  const proposeFullAccess = () => {
    try { setFullAccess({ scope: presetPermissionDraft('full', draft, snapshot), stamp: permissionInventoryStamp(snapshot) }); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Full access exceeds the selected scope limits.'); }
  };
  const apply = () => {
    try {
      const next = validatePermissionDraft(draft, snapshot);
      connection.setPermissions(next);
      setDraft(next); setError(''); setDependentRemoved([]);
      setMessage(phase === 'connected' ? 'Permissions applied. Previous pending approvals are invalidated; production changes still require separate review.' : 'Permissions applied for the next pairing. No active connection or database change was created.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Permissions could not be applied.'); }
  };
  const focused = projectId && snapshot.collections.some(p => p.id === projectId) ? projectPermissionContext(projectId, snapshot) : undefined;
  return <div className="ai-permissions-workspace">
    <section className="card ai-permission-overview" aria-label="Applied permissions">
      <div className="ai-section-heading"><div><h2>Applied permissions</h2><p className="muted-text">{phase === 'connected' ? 'This is what the paired Codex session can currently access.' : 'These selections are prepared for the next pairing; no session is authorized yet.'}</p></div><span className="ai-state-chip">{dirty ? 'Unapplied changes' : 'Up to date'}</span></div>
      <div className="ai-access-summary"><span>{scope.projectIds.length} projects</span><span>{authorizedSceneIds(scope, snapshot).size} scenes with metadata access</span><span>{scope.assetIds.length} reusable assets</span><span>{scope.variantIds.length} variants · {scope.templateIds.length} templates</span><span>{scope.fullPromptSceneIds.length} full prompts</span><span>{scope.mediaIds.length} media IDs</span><span>{scope.candidateIds.length} candidates</span><span>{scope.receiptGrants.length} explicit receipts</span><span>{view.approvedReceiptGrants.length} approved-batch receipts</span></div>
      <p className="muted-text">Project grants follow current storyboard take membership. Full prompt text is a separate grant. New projects and reusable assets are not selected automatically.</p>
    </section>
    <div className="ai-permission-actions"><div>{dirty ? <button className="ai-review-link" onClick={() => { const review = document.getElementById('ai-permission-review'); review?.scrollIntoView({ block: 'start' }); review?.focus({ preventScroll: true }); }}>Review unapplied changes</button> : <strong>Permissions reviewed</strong>}<small>Session-scoped · explicit IDs · no automatic saves</small></div><div className="ai-permission-action-buttons"><button className="btn btn-secondary" disabled={disabled || !dirty} onClick={reset}>Reset changes</button><button className="btn btn-ghost" disabled={disabled || !dirty} onClick={reset}>Cancel changes</button><button className="btn btn-primary" disabled={disabled || (!dirty && !view.approvedReceiptGrants.length)} onClick={apply}>Apply Permissions</button></div>{error && <p className="banner banner-warning" role="alert">{error}</p>}{message && <p className="ai-permission-message" role="status">{message}</p>}</div>
    <section className="card ai-permission-editor">
      <div className="ai-section-heading"><div><h3>Choose access</h3><p className="muted-text">Edit a draft, inspect the review, then apply it once. Preset: <strong>{preset}</strong>.</p></div>
        <div className="ai-preset-buttons" aria-label="Permission presets"><button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => edit(s => presetPermissionDraft('minimal', s, snapshot), 'Minimal Access')}>Minimal Access</button><button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => edit(s => presetPermissionDraft('creative', s, snapshot), 'Creative Production')}>Creative Production</button><button className="btn btn-secondary btn-sm" disabled={disabled} onClick={proposeFullAccess}>Full Access</button><button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => setPreset('Custom')}>Custom</button></div>
      </div>
      <div className="ai-global-actions"><button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => edit(s => selectAllRecords(s, snapshot))}>Select All Records</button><button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => edit(clearAllRecords)}>Clear All Records</button><button className="btn btn-ghost btn-sm" disabled={disabled} onClick={proposeFullAccess}>Grant Full Access</button><span>Ordinary bulk selection does not enable sensitive disclosure or proposal capabilities.</span></div>
      <details className="ai-project-shortcut"><summary>Select Project for AI Work</summary><div className="ai-project-choice"><label>Project<select aria-label="Project for AI work" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Choose a project…</option>{snapshot.collections.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn btn-secondary btn-sm" disabled={disabled || !focused} onClick={() => focused && select('projectIds', [focused.project.id], true)}>Select this project</button></div>
        {focused && <div className="ai-project-context"><code>{focused.project.id}</code><p>{focused.shotCount} storyboard shots · {focused.sceneCount} linked saved scenes · {focused.missingSceneIds.length} unavailable takes</p><p>{focused.relatedAssetIds.length} related available assets · {focused.relatedVariantIds.length} related variants · {focused.missingMediaIds.length} missing media references · {focused.pendingInputs} pending inputs</p><p>{focused.relatedAssetIds.filter(id => draft.assetIds.includes(id)).length} related assets selected. Identity: {draft.includeCharacterIdentity ? 'on' : 'off'} · Notes: {draft.includeNotes ? 'on' : 'off'} · Filenames: {draft.includeMediaFilenames ? 'on' : 'off'}.</p><p className="muted-text">Related records come from stored IDs and associations. Similar names never establish ownership.</p>{!focused.relatedAssetIds.length && !focused.relatedVariantIds.length ? <p>No linked recipe assets were found. Select reusable records explicitly below.</p> : <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => edit(s => changeSelection(changeSelection(s, 'assetIds', focused.relatedAssetIds, true), 'variantIds', focused.relatedVariantIds, true))}>Add related reusable records</button>}</div>}
      </details>
      <div className="ai-record-workspace">
        <nav className="ai-category-nav" aria-label="Permission record categories">{PERMISSION_FIELDS.map(item => <button key={item.field} className={category === item.field ? 'active' : ''} aria-pressed={category === item.field} aria-label={item.label + ' category, ' + permissionIds(draft, item.field).length + ' selected'} onClick={() => setCategory(item.field)}><span>{item.label}{'sensitive' in item && <small>Sensitive</small>}</span><strong>{permissionIds(draft, item.field).length}</strong></button>)}</nav>
        <div className="ai-record-content">{PERMISSION_FIELDS.map(item => <div key={item.field} hidden={category !== item.field}><PermissionRecordPicker field={item.field} title={item.label} items={inventory[item.field]} selected={permissionIds(draft, item.field)} onSelect={(ids, value) => select(item.field, ids, value)} disabled={disabled}/></div>)}</div>
      </div>
    </section>
    <section className="card ai-privacy-section" aria-label="Sensitive information permissions"><div className="ai-section-heading"><div><h3>Sensitive information</h3><p className="muted-text">Separate opt-ins for text within selected records. Original media bytes are never shared.</p></div></div><div className="ai-disclosure-grid">{DISCLOSURE_FIELDS.map(item => <label className="ai-disclosure" key={item.field}><input type="checkbox" aria-label={item.label} checked={draft[item.field]} disabled={disabled} onChange={e => edit(s => ({ ...s, [item.field]: e.target.checked }))}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div></section>
    <section className="card ai-capability-section" aria-label="Proposal capabilities"><h3>Proposal capabilities</h3><div className="ai-disclosure-grid">{CAPABILITY_FIELDS.map(item => <label className="ai-disclosure" key={item.field}><input type="checkbox" aria-label={item.label} checked={draft[item.field]} disabled={disabled} onChange={e => edit(s => ({ ...s, [item.field]: e.target.checked }))}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div><p className="muted-text">Automatic application: <strong>Never</strong>. Changing permissions does not approve incoming proposals.</p></section>
    {dependentRemoved.length > 0 && <div className="banner banner-warning" role="status"><strong>{dependentRemoved.length} dependent full-prompt selection(s) removed from this draft:</strong><ul>{dependentRemoved.map(id => <li key={id}>{snapshot.scenes.find(s => s.id === id)?.title ?? id} <code>{id}</code></li>)}</ul>Active grants change only after Apply.</div>}
    {(dirty || view.approvedReceiptGrants.length > 0) && <div className="card ai-review-card"><PermissionReview applied={scope} draft={draft} inventory={reviewInventory} temporary={view.approvedReceiptGrants}/></div>}
    {fullAccess && <StudioDialog title="Review full access" onClose={() => setFullAccess(undefined)} footer={<><button className="btn btn-secondary" onClick={() => setFullAccess(undefined)}>Cancel</button><button className="btn btn-primary" onClick={() => { if (fullAccess.stamp !== permissionInventoryStamp(snapshot)) { setFullAccess(undefined); setError('The library changed while full access was being reviewed. Open the review again; no permissions were changed.'); return; } edit(() => fullAccess.scope, 'Full Access'); setFullAccess(undefined); }}>Use full-access draft</button></>}>
      <p>This proposes all currently eligible records. Future projects and reusable assets are excluded. Existing project grants follow their storyboard take metadata. Review these selections again before Apply Permissions.</p>
      <dl className="ai-full-access-counts">{PERMISSION_FIELDS.map(({ field, label }) => <React.Fragment key={field}><dt>{label}</dt><dd>{permissionIds(fullAccess.scope, field).length}</dd></React.Fragment>)}{[...DISCLOSURE_FIELDS, ...CAPABILITY_FIELDS].map(({ field, label }) => <React.Fragment key={field}><dt>{label}</dt><dd>{fullAccess.scope[field] ? 'On' : 'Off'}</dd></React.Fragment>)}</dl>
      <p className="banner banner-warning">Full prompts may contain character identity and private production details. Identity, private notes and media filenames are included in this proposed access.</p><p>Original media bytes are never shared. Production change sets still require separate browser approval. This confirmation only stages permission selections.</p>
    </StudioDialog>}
  </div>;
}
