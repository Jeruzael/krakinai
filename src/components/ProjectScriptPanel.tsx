import React from 'react';
import type { Collection } from '../types/domain';
import { useLibrary } from '../context/LibraryContext';
import { formatProjectScript, getProjectDialogue,getProjectDialogueRowKey } from '../domain/projectContinuity';
import './projectCast.css';

type Props = { collection: Collection; onChanged: () => Promise<unknown> };
export const ProjectScriptPanel: React.FC<Props> = ({ collection }) => {
  const { snapshot, copyText } = useLibrary();
  const scenes = snapshot?.scenes ?? [];
  const rows = getProjectDialogue(collection, scenes);
  const script = formatProjectScript(collection, scenes);
  const download = () => {
    const blob = new Blob([script], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${collection.name.replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim() || 'project'}-script.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <section className="project-script" role="region" aria-label="Project Script">
    <div className="project-cast-heading"><div><h3>Script</h3><p className="muted-text">Selected takes in shot order. Dialogue and exported Markdown retain the exact saved text. Duration is shot or scene intent, not subtitle timing.</p></div><div className="project-cast-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText(script, 'Script copied.')}>Copy Script</button><button type="button" className="btn btn-secondary btn-sm" onClick={download}>Download Script .md</button></div></div>
    {rows.length ? <ol className="project-script-lines">{rows.map(row => <li key={getProjectDialogueRowKey(row)}>
      <div className="project-script-meta"><strong>{row.code} · {row.title}</strong><span>{row.speaker}</span><span>{row.mode ?? 'Mode unknown'} · {row.language ?? 'Language unknown'}</span><span>{row.durationSeconds == null ? 'Duration unknown' : `${row.durationSeconds} sec intended`}</span></div>
      {row.deliveryNotes && <p className="muted-text">Delivery: {row.deliveryNotes}</p>}
      <p className="project-script-exact">{row.exactLine}</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText(row.exactLine, 'Line copied.')}>Copy line {row.code}{row.cueId?` cue ${(row.cueIndex??0)+1}`:''}</button>
    </li>)}</ol> : <p className="muted-text">No selected takes contain dialogue.</p>}
    <label className="project-script-document">Script document<textarea aria-label="Script document" readOnly value={script} rows={Math.min(16, Math.max(6, script.split('\n').length + 1))} /></label>
  </section>;
};
