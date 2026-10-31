import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { useAiConnection } from '../connections/AiConnectionContext';
import { ConnectionPanel } from '../components/aiConnections/ConnectionPanel';
import { PermissionsWorkspace } from '../components/aiConnections/PermissionsWorkspace';
import { IncomingProposals } from '../components/aiConnections/IncomingProposals';
import './changeSets.css';
import './aiConnections.css';

const views = [{ id: 'connection', label: 'Connection' }, { id: 'permissions', label: 'Permissions' }, { id: 'proposals', label: 'Incoming Proposals' }] as const;
type View = typeof views[number]['id'];
export function AiConnectionsScreen() {
  const { snapshot, navigate } = useLibrary(), { phase, view } = useAiConnection();
  const [active, setActive] = useState<View>('connection'), [selected, setSelected] = useState<string>(), [permissionChanges, setPermissionChanges] = useState(false);
  if (!snapshot) return <p role="status">Loading this browser library…</p>;
  const status = phase === 'connected' ? 'Connected' : phase === 'pairing' ? 'Pairing' : phase === 'error' ? 'Connection error' : 'Disconnected';
  return <div className="ai-connections change-set-workspace">
    <header className="import-heading"><div><p className="import-eyebrow">Production workspace</p><h1>AI Connections</h1><p>Connect Codex, choose its context, and review proposed changes.</p></div><div className="ai-heading-actions"><strong className={'ai-status ' + phase} role="status">{status}</strong><button className="btn btn-secondary btn-sm" onClick={() => navigate('/imports/ai')}>Use manual AI Change Set import</button></div></header>
    <div className="ai-workspace-tabs" role="tablist" aria-label="AI Connections views">
      {views.map((item, index) => <button id={'ai-view-' + item.id} key={item.id} type="button" role="tab" aria-label={item.label} aria-controls={'ai-panel-' + item.id} aria-selected={active === item.id} tabIndex={active === item.id ? 0 : -1} onClick={() => setActive(item.id)} onKeyDown={event => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length;
        setActive(views[next].id);
        document.getElementById('ai-view-' + views[next].id)?.focus();
      }}>{item.label}{item.id === 'proposals' && <span className="ai-tab-count" aria-label={view.proposals.length + ' proposals'}>{view.proposals.length}</span>}{item.id === 'permissions' && permissionChanges && <span aria-label="Unapplied changes" className="ai-unsaved-dot"/>}</button>)}
    </div>
    <p className="ai-proposal-announcement" role="status" aria-live="polite">{view.proposals.length ? view.proposals.length + ' proposal(s) available for review. Your current view and focus are unchanged.' : ''}</p>
    <section id="ai-panel-connection" role="tabpanel" aria-labelledby="ai-view-connection" hidden={active !== 'connection'}><ConnectionPanel active={active === 'connection'} permissionChanges={permissionChanges} onPermissions={() => { setActive('permissions'); document.getElementById('ai-view-permissions')?.focus(); }}/></section>
    <section id="ai-panel-permissions" role="tabpanel" aria-labelledby="ai-view-permissions" hidden={active !== 'permissions'}><PermissionsWorkspace snapshot={snapshot} onDirty={setPermissionChanges}/></section>
    <section id="ai-panel-proposals" role="tabpanel" aria-labelledby="ai-view-proposals" hidden={active !== 'proposals'}><IncomingProposals selected={selected} proposals={view.proposals} onSelect={setSelected}/></section>
  </div>;
}
