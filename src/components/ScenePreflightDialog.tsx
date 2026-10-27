import React, { useState } from 'react';
import { StudioDialog } from './StudioDialog';
import type { PreflightComponent, PreflightFinding } from '../domain/scenePreflight';
export interface ScenePreflightDialogProps {
  findings: PreflightFinding[];
  onClose: () => void;
  onViewSource: (component: PreflightComponent) => void;
  onEditComponent: (component: PreflightComponent) => void;
  readOnly?: boolean;
  intentionalIds?: readonly string[];
  onIntentionalIdsChange?: (ids: string[]) => void;
}
export const ScenePreflightDialog: React.FC<ScenePreflightDialogProps> = ({findings,onClose,onViewSource,onEditComponent,readOnly=false,intentionalIds,onIntentionalIdsChange}) => {
  const [localIds,setLocalIds]=useState<string[]>([...(intentionalIds??[])]);
  const acknowledged=intentionalIds??localIds;
  const severityOrder = {blocking:0,review:1,information:2};
  const orderedFindings=[...findings].sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);
  return <StudioDialog title="Scene Preflight" onClose={onClose} footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}>
    <p>These conservative checks need human review. No common conflicts detected does not guarantee consistency.</p>
    {findings.length===0&&<p>No common conflicts detected.</p>}
    {orderedFindings.map((f,index)=><section key={f.id} style={{borderBottom:'1px solid var(--border-color)',padding:'16px 0'}}>
      {(index===0||orderedFindings[index-1].severity!==f.severity)&&<h2>{f.severity==='blocking'?'Blocking':f.severity==='review'?'Review':'Information'}</h2>}
      <h3>{f.ruleId} · {f.title}</h3><p>{f.severity === 'information' ? 'Information' : f.severity === 'blocking' ? 'Blocking' : 'Review'}</p>
      <p>{f.explanation}</p>
      {f.evidence.map((e,i)=><div key={i}><strong>{e.component}</strong><blockquote style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{e.text || '(empty source)'}</blockquote></div>)}
      <ul>{f.suggestedActions.map(action=><li key={action}>{action}</li>)}</ul>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{f.components.map(component=><React.Fragment key={component}><button className="btn btn-secondary" onClick={()=>onViewSource(component)} aria-label={`View source: ${component}`}>View source: {component}</button><button className="btn btn-secondary" onClick={()=>onEditComponent(component)} aria-label={`${readOnly?'Edit a Copy':'Edit component'}: ${component}`}>{readOnly?'Edit a Copy':'Edit component'}: {component}</button></React.Fragment>)}</div>
      {f.severity!=='blocking'&&<label style={{display:'block',marginTop:12}}><input type="checkbox" checked={acknowledged.includes(f.id)} onChange={event=>{const next=event.target.checked?[...acknowledged,f.id]:acknowledged.filter(id=>id!==f.id);setLocalIds(next);onIntentionalIdsChange?.(next);}}/> Intentional creative choice (local acknowledgement)</label>}
    </section>)}
  </StudioDialog>;
};
