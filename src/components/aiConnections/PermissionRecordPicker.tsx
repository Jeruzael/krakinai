import React, { useEffect, useRef, useState } from 'react';
import type { PermissionField, PermissionRecord } from '../../domain/mcpPermissionDraft';

export function PermissionRecordPicker({ field, title, items, selected, onSelect, disabled }: {
  field: PermissionField; title: string; items: PermissionRecord[]; selected: string[];
  onSelect(ids: string[], selected: boolean): void; disabled: boolean;
}) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [page, setPage] = useState(0), [selectedOnly, setSelectedOnly] = useState(false);
  const headerCheck = useRef<HTMLInputElement>(null);
  const categories = [...new Set(items.flatMap(i => i.category ? [i.category] : []))].sort();
  const categoryItems = items.filter(i => category === 'all' || i.category === category);
  const matches = categoryItems.filter(i => (!selectedOnly || selected.includes(i.id)) && (i.label + ' ' + i.id).toLowerCase().includes(query.toLowerCase()));
  const selectedMatches = matches.filter(i => selected.includes(i.id)).length;
  const pages = Math.max(1, Math.ceil(matches.length / 12)), currentPage = Math.min(page, pages - 1);
  const rows = matches.slice(currentPage * 12, currentPage * 12 + 12);
  const missing = selected.filter(id => !items.some(i => i.id === id));
  useEffect(() => {
    if (category !== 'all' && !items.some(item => item.category === category)) { setCategory('all'); setPage(0); }
  }, [items, category]);
  useEffect(() => { if (headerCheck.current) headerCheck.current.indeterminate = selectedMatches > 0 && selectedMatches < matches.length; }, [selectedMatches, matches.length]);
  const changeQuery = (value: string) => { setQuery(value); setPage(0); };
  return <section className="ai-record-picker" aria-label={title + ' record selection'}>
    <div className="ai-section-heading"><div><h3>{title}</h3><p className="ai-selection-count">{selected.length} of {items.length} selected</p></div>
      <label className="ai-inline-check"><input type="checkbox" checked={selectedOnly} onChange={e => { setSelectedOnly(e.target.checked); setPage(0); }}/>Selected only</label>
    </div>
    {field === 'fullPromptSceneIds' && <p className="banner banner-warning">Full prompt text may contain character identity or private production details. Only metadata-authorized scenes are selectable; their complete text is shared separately.</p>}
    {field === 'receiptGrants' && <p className="muted-text">An exact receipt shares historical IDs and outcomes, including removed records. It does not grant full scene text.</p>}
    {field === 'mediaIds' && <p className="muted-text">Authorize metadata and use of selected media IDs in proposals. Original media bytes are never shared.</p>}
    <div className="ai-picker-search"><label>Search {title}<input aria-label={'Search ' + title} value={query} onChange={e => changeQuery(e.target.value)} placeholder="Search names or IDs…"/></label>
      {categories.length > 1 && <label>Category<select aria-label={title + ' category filter'} value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>}
    </div>
    <div className="ai-bulk-actions">
      <button className="btn btn-secondary btn-sm" disabled={disabled || !categoryItems.length} onClick={() => onSelect(categoryItems.map(i => i.id), true)}>Select All {category === 'all' ? title : category} ({categoryItems.length})</button>
      <button className="btn btn-secondary btn-sm" disabled={disabled || !matches.length} onClick={() => onSelect(matches.map(i => i.id), true)}>Select {matches.length} Matching</button>
      <button className="btn btn-ghost btn-sm" disabled={disabled || !categoryItems.some(i => selected.includes(i.id))} onClick={() => onSelect(categoryItems.map(i => i.id), false)}>Clear All {category === 'all' ? title : category}</button>
      <button className="btn btn-ghost btn-sm" disabled={disabled || !selectedMatches} onClick={() => onSelect(matches.map(i => i.id), false)}>Clear Matching Selection</button>
    </div>
    <label className="ai-inline-check ai-match-heading"><input ref={headerCheck} type="checkbox" aria-label={'Select all matching ' + title} checked={matches.length > 0 && selectedMatches === matches.length} disabled={disabled || !matches.length} onChange={e => onSelect(matches.map(i => i.id), e.target.checked)}/>{selectedMatches} of {matches.length} matching selected</label>
    <div className="ai-record-rows" role="group" aria-label={title}>
      {rows.map(item => <label className="ai-record-row" key={item.id}><input type="checkbox" disabled={disabled} checked={selected.includes(item.id)} aria-label={'Allow ' + title + ': ' + item.label + (field === 'assetIds' && item.category ? ' · ' + item.category : '')} onChange={e => onSelect([item.id], e.target.checked)}/><span><strong>{item.label}</strong><small>{item.id}</small></span>{item.category && <span className="ai-record-tag">{item.category}</span>}</label>)}
      {!matches.length && <p className="ai-empty">No matching records. Change the search or category; existing hidden selections are retained.</p>}
    </div>
    {missing.length > 0 && <div className="banner banner-warning"><p>Unavailable or no longer authorized selections need removal before Apply.</p>{missing.map(id => <button className="btn btn-secondary btn-sm ai-break" key={id} disabled={disabled} onClick={() => onSelect([id], false)}>Remove {id}</button>)}</div>}
    <nav className="ai-picker-pagination" aria-label={title + ' result pages'}><span>{matches.length ? currentPage * 12 + 1 : 0}–{Math.min((currentPage + 1) * 12, matches.length)} of {matches.length} matching records</span><div><button className="btn btn-secondary btn-sm" aria-label={'Previous ' + title + ' page'} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="btn btn-secondary btn-sm" aria-label={'Next ' + title + ' page'} disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>
  </section>;
}
