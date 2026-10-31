import React from 'react';
import type { McpScope, ReceiptGrant } from '../../types/mcp';
import { PERMISSION_FIELDS, permissionIds, scopeDiff, type PermissionInventory } from '../../domain/mcpPermissionDraft';

export function PermissionReview({ applied, draft, inventory, temporary }: { applied: McpScope; draft: McpScope; inventory: PermissionInventory; temporary: ReceiptGrant[] }) {
  const rows = scopeDiff(applied, draft, inventory);
  return <section id="ai-permission-review" tabIndex={-1} className="ai-permission-review" aria-label="Permission review">
    <div className="ai-section-heading"><div><h3>Review access changes</h3><p className="muted-text">Previously allowed → Proposed. Only Apply Permissions changes active access.</p></div></div>
    <div className="ai-review-columns">{(['read', 'sensitive', 'capability'] as const).map(kind => <div key={kind}><h4>{kind === 'read' ? 'Ordinary read permissions' : kind === 'sensitive' ? 'Sensitive disclosure' : 'Proposal capabilities'}</h4>
      {rows.filter(r => r.kind === kind).map(row => <div className="ai-diff-row" key={row.field}><span>{row.label}</span><strong>{typeof row.before === 'boolean' ? row.before ? 'On' : 'Off' : row.before} → {typeof row.after === 'boolean' ? row.after ? 'On' : 'Off' : row.after}</strong>
        {(row.added.length > 0 || row.removed.length > 0) && <details><summary>{row.added.length} added · {row.removed.length} removed</summary>{row.added.length > 0 && <><h5>Permissions added</h5><ul>{row.added.map(item => <li key={item.id}>{item.label}<code>{item.id}</code></li>)}</ul></>}{row.removed.length > 0 && <><h5>Permissions removed</h5><ul>{row.removed.map(item => <li key={item.id}>{item.label}<code>{item.id}</code></li>)}</ul></>}</details>}
      </div>)}
    </div>)}</div>
    {temporary.length > 0 && <p className="banner banner-warning">Applying permissions revokes {temporary.length} temporary approved-batch receipt grant(s), as well as stale production approvals. Explicit recovery grants shown above are retained only if selected.</p>}
    <details className="ai-all-selected"><summary>Review all selected record IDs ({PERMISSION_FIELDS.reduce((n, { field }) => n + permissionIds(draft, field).length, 0)})</summary>
      {PERMISSION_FIELDS.filter(({ field }) => permissionIds(draft, field).length).map(({ field, label }) => <details key={field}><summary>{label} ({permissionIds(draft, field).length})</summary><ul>{permissionIds(draft, field).map(id => <li key={id}>{inventory[field].find(i => i.id === id)?.label ?? 'Unavailable record'}<code>{id}</code></li>)}</ul></details>)}
    </details>
  </section>;
}
