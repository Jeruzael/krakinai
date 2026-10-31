import React, { useRef, useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useAiConnection } from '../connections/AiConnectionContext';
import { authorizedSceneIds } from '../domain/mcpScope';
import { StudioDialog } from '../components/StudioDialog';
import { McpProposalReview } from '../components/McpProposalReview';
import type { McpScope } from '../types/mcp';
import './changeSets.css';
import './aiConnections.css';

function RecordChoices({ title, items, selected, onChange, disabled }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange(ids: string[]): void; disabled: boolean }) {
  const [query, setQuery] = useState(''), [limit, setLimit] = useState(50);
  const matches = items.filter(i => `${i.label} ${i.id}`.toLowerCase().includes(query.toLowerCase()));
  return <details className="import-group"><summary>{title} ({selected.length} selected)</summary><label>Search {title}<input value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }}/></label><div className="ai-choice-list" role="group" aria-label={title}>
    {matches.slice(0, limit).map(item => <label className="import-check" key={item.id}><input type="checkbox" aria-label={`Allow ${title}: ${item.label}`} checked={selected.includes(item.id)} disabled={disabled} onChange={e => onChange(e.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))}/><span>{item.label}<small className="ai-break">{item.id}</small></span></label>)}
    {!matches.length && <p className="muted-text">No matching records in this browser library.</p>}
    {matches.length > limit && <button className="btn btn-secondary btn-sm" onClick={() => setLimit(n => n + 50)}>Show 50 more</button>}
  </div></details>;
}
export function AiConnectionsScreen() {
  const { snapshot, navigate } = useLibrary(), connection = useAiConnection();
  const { scope, phase, pairing, view } = connection;
  const [address, setAddress] = useState('http://127.0.0.1:4177'), [key, setKey] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [disconnectDialog, setDisconnectDialog] = useState(false), [selected, setSelected] = useState<string>();
  const disconnectRef = useRef<HTMLButtonElement>(null);
  if (!snapshot) return <p role="status">Loading this browser library…</p>;
  const status = phase === 'connected' ? 'Connected' : phase === 'pairing' ? 'Pairing' : phase === 'error' ? 'Connection error' : 'Disconnected';
  const disabled = busy || phase === 'pairing', sceneScope = authorizedSceneIds(scope, snapshot);
  const permissions = (next: McpScope) => { try { connection.setPermissions(next); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'These permissions exceed the connection limits.'); } };
  const pick = (field: 'projectIds' | 'sceneIds' | 'assetIds' | 'variantIds' | 'templateIds' | 'fullPromptSceneIds' | 'mediaIds' | 'candidateIds', ids: string[]) => permissions({ ...scope, [field]: ids });
  const flag = (field: keyof McpScope, label: string) => <label className="import-check"><input type="checkbox" aria-label={label} checked={scope[field] === true} disabled={disabled} onChange={event => permissions({ ...scope, [field]: event.target.checked })}/><span>{label}</span></label>;
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'The connection could not be completed.'); } finally { setBusy(false); } };
  return <div className="ai-connections change-set-workspace">
    <header className="import-heading"><div><p className="import-eyebrow">Local production connection</p><h1>AI Connections</h1><p>Share selected context with local Codex and review every proposed change here.</p></div><button className="btn btn-secondary" onClick={() => navigate('/imports/ai')}>Use manual AI Change Set import</button></header>
    <div className="ai-connection-grid"><aside className="ai-connection-controls">
      <section className="card ai-connect-card"><div className="import-heading"><h2>Codex Local Bridge</h2><strong className={`ai-status ${phase}`} role="status">{status}</strong></div>
        <dl className="ai-session"><dt>Current application origin</dt><dd><code>{window.location.origin}</code></dd><dt>Browser library session</dt><dd>{connection.librarySession}</dd><dt>This browser</dt><dd>{snapshot.assets.length} assets · {snapshot.scenes.length} scenes · {snapshot.collections.length} collections</dd></dl>
        <p className="muted-text">Another origin, port or browser profile has a separate library. Stay in the browser containing your records.</p>
        <label>Local bridge address<input aria-label="Local bridge address" value={address} disabled={phase === 'connected' || phase === 'pairing' || busy} onChange={e => setAddress(e.target.value)} autoComplete="off" spellCheck={false}/></label>
        {pairing ? <section className="ai-pairing" aria-label="Pairing verification"><h3>Verify the Windows window</h3><p>Compare the bridge path, application origin and this verification code in the separate native window.</p><code className="ai-verification">{pairing.verificationCode}</code><p className="muted-text">Show its one-time key and enter it below while the Windows window is open. Then choose Allow there and Confirm pairing here. The key is never needed in chat.</p><label>One-time pairing key<input type="password" aria-label="One-time pairing key" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} maxLength={80} spellCheck={false}/></label><div className="import-buttons"><button className="btn btn-secondary" disabled={busy} onClick={() => void connection.disconnect()}>Cancel pairing</button><button className="btn btn-primary" disabled={busy || !key} onClick={() => { const value = key; setKey(''); void run(() => connection.finishPairing(value)); }}>Confirm pairing</button></div><small>If you cancel, also deny or close the native window. A pending challenge expires in two minutes.</small></section> : phase === 'connected' ? <><p className="ai-break">Paired browser session: {view.sessionId?.slice(0, 8)}</p><button ref={disconnectRef} className="btn btn-secondary" onClick={() => setDisconnectDialog(true)}>Disconnect Codex</button></> : <button className="btn btn-primary" disabled={busy} onClick={() => void run(() => connection.beginPairing(address))}>{busy ? 'Connecting…' : 'Connect Codex'}</button>}
        {(error || connection.message) && <p className={error ? 'banner banner-warning' : 'muted-text'} role={error ? 'alert' : 'status'}>{error || connection.message}</p>}
        <details className="import-group"><summary>Local setup and recovery</summary><p>Start the verified stdio server from your Codex configuration. The tested Windows command and disconnect instructions are in <code>docs/local-codex-mcp.md</code>. This app does not edit your Codex configuration.</p><p>After a restart, pair again and explicitly authorize any receipt needed to recover confirmed IDs. Unfinished proposals need a fresh submission and review.</p></details>
      </section>
      <section className="card ai-connect-card" aria-label="Connection permissions"><h2>Permissions</h2><p className="muted-text">Selected context is visible to Codex and may be sent to its configured model provider. Original media bytes are never shared.</p>
        {flag('allowProposals', 'Allow change-set proposals')}{flag('allowNewProjects', 'Allow new project creation')}
        <RecordChoices title="Projects" items={snapshot.collections.map(p => ({ id: p.id, label: p.name }))} selected={scope.projectIds} onChange={ids => pick('projectIds', ids)} disabled={disabled}/>
        <RecordChoices title="Additional scene metadata" items={snapshot.scenes.map(s => ({ id: s.id, label: s.title }))} selected={scope.sceneIds} onChange={ids => pick('sceneIds', ids)} disabled={disabled}/>
        <RecordChoices title="Reusable assets" items={snapshot.assets.map(a => ({ id: a.id, label: `${a.title} · ${a.category}` }))} selected={scope.assetIds} onChange={ids => pick('assetIds', ids)} disabled={disabled}/>
        <RecordChoices title="Variants" items={snapshot.variants.map(v => ({ id: v.id, label: v.title }))} selected={scope.variantIds} onChange={ids => pick('variantIds', ids)} disabled={disabled}/>
        <RecordChoices title="Templates" items={snapshot.templates.map(t => ({ id: t.id, label: t.name }))} selected={scope.templateIds} onChange={ids => pick('templateIds', ids)} disabled={disabled}/>
        <RecordChoices title="Original media use" items={snapshot.media.map(m => ({ id: m.id, label: m.displayName ?? m.filename }))} selected={scope.mediaIds} onChange={ids => pick('mediaIds', ids)} disabled={disabled}/>
        <details className="import-group"><summary>Text and privacy permissions</summary>
          {flag('includeAssetText', 'Share ordinary asset prompt text')}{flag('includeCharacterIdentity', 'Share Character identities and approved anchors')}{flag('includeNotes', 'Share private production notes')}{flag('includeMediaFilenames', 'Share media filenames')}
          <p className="muted-text">An exact Full prompt can itself contain identities, notes or filenames. Selecting it shares the complete string.</p>
          <RecordChoices title="Complete scene prompts" items={snapshot.scenes.filter(s => sceneScope.has(s.id)).map(s => ({ id: s.id, label: s.title }))} selected={scope.fullPromptSceneIds} onChange={ids => pick('fullPromptSceneIds', ids)} disabled={disabled}/>
        </details>
        <details className="import-group"><summary>Receipt recovery permissions ({scope.receiptGrants.length})</summary><p>Share only confirmed result IDs and outcomes for the exact selected import, including historical records.</p>{(snapshot.preferences.aiImports?.receipts ?? []).map(receipt => <label className="import-check" key={receipt.changeSetId}><input type="checkbox" disabled={disabled} aria-label={`Share receipt ${receipt.changeSetId}`} checked={scope.receiptGrants.some(g => g.changeSetId === receipt.changeSetId && g.packageDigest === receipt.packageDigest)} onChange={e => connection.setPermissions({ ...scope, receiptGrants: e.target.checked ? [...scope.receiptGrants, { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest }] : scope.receiptGrants.filter(g => g.changeSetId !== receipt.changeSetId) })}/><span className="ai-break">{receipt.title ?? receipt.changeSetId}<small>{receipt.packageDigest.slice(0, 12)}</small></span></label>)}</details>
        <p className="muted-text">Automatic application: <strong>Never</strong>. Permission changes invalidate pending approvals immediately.</p>
      </section>
    </aside><section className="ai-incoming-panel" aria-label="Incoming MCP proposals">
      {selected ? <McpProposalReview key={selected} proposalId={selected} onClose={() => setSelected(undefined)}/> : <section className="card ai-connect-card"><h2>Incoming proposals</h2><p className="muted-text" role="status" aria-live="polite">{view.proposals.length ? `${view.proposals.length} proposal(s) in this browser session.` : 'No incoming proposals. Your library changes only after your review.'}</p>{view.proposals.map(p => <article className="ai-proposal-row" key={p.id}><div><strong>{p.preview?.changeSet.title ?? p.changeSetId}</strong><small>{p.status.replaceAll('_', ' ')} · {p.preview?.changeSet.operations.length ?? 0} operations</small></div><button className="btn btn-secondary btn-sm" onClick={() => setSelected(p.id)}>Review proposal</button></article>)}<p className="muted-text">Proposal arrival does not open a dialog, change your route or move keyboard focus.</p></section>}
    </section></div>
    {disconnectDialog && <StudioDialog title="Disconnect Codex?" onClose={() => setDisconnectDialog(false)} returnFocusRef={disconnectRef} footer={<><button className="btn btn-secondary" onClick={() => setDisconnectDialog(false)}>Keep connected</button><button className="btn btn-primary" onClick={() => { setDisconnectDialog(false); void connection.disconnect(); }}>Disconnect now</button></>}><p>This immediately revokes this browser's access and pending approvals. A batch already authorized at its atomic write boundary may finish; committed records and receipts remain saved.</p></StudioDialog>}
  </div>;
}
