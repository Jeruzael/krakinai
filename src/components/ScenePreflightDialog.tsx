import React, { useId, useState } from 'react';
import { StudioDialog } from './StudioDialog';
import type {
  PreflightComponent,
  PreflightFinding,
} from '../domain/scenePreflight';
import './scenePreflight.css';
export interface ScenePreflightDialogProps {
  findings: PreflightFinding[];
  onClose: () => void;
  onViewSource: (component: PreflightComponent) => void;
  onEditComponent: (component: PreflightComponent) => void;
  readOnly?: boolean;
  intentionalIds?: readonly string[];
  onIntentionalIdsChange?: (ids: string[]) => void;
}
const severities = ['blocking', 'review', 'information'] as const;
const labels = {
  blocking: 'Blocking',
  review: 'Review',
  information: 'Information',
};

export const ScenePreflightDialog: React.FC<ScenePreflightDialogProps> = ({
  findings,
  onClose,
  onViewSource,
  onEditComponent,
  readOnly = false,
  intentionalIds,
  onIntentionalIdsChange,
}) => {
  const [localIds, setLocalIds] = useState<string[]>([
    ...(intentionalIds ?? []),
  ]);
  const acknowledged = intentionalIds ?? localIds;
  const acknowledge = (id: string, checked: boolean) => {
    const next = checked
      ? [...acknowledged, id]
      : acknowledged.filter((value) => value !== id);
    setLocalIds(next);
    onIntentionalIdsChange?.(next);
  };
  return (
    <StudioDialog
      title="Scene Preflight"
      className="preflight-dialog"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="preflight-intro">
        These conservative checks need human review. No common conflicts
        detected does not guarantee consistency.
      </p>
      {findings.length === 0 && <p>No common conflicts detected.</p>}
      {severities.map((severity) => {
        const group = findings.filter((f) => f.severity === severity);
        return (
          group.length > 0 && (
            <section
              key={severity}
              className="preflight-group"
              aria-label={`${labels[severity]} findings`}
            >
              <h2>
                {labels[severity]} <span>({group.length})</span>
              </h2>
              {group.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  readOnly={readOnly}
                  checked={acknowledged.includes(finding.id)}
                  onAcknowledge={(checked) => acknowledge(finding.id, checked)}
                  onViewSource={onViewSource}
                  onEditComponent={onEditComponent}
                />
              ))}
            </section>
          )
        );
      })}
    </StudioDialog>
  );
};

function FindingCard({
  finding: f,
  readOnly,
  checked,
  onAcknowledge,
  onViewSource,
  onEditComponent,
}: {
  finding: PreflightFinding;
  readOnly: boolean;
  checked: boolean;
  onAcknowledge: (checked: boolean) => void;
  onViewSource: ScenePreflightDialogProps['onViewSource'];
  onEditComponent: ScenePreflightDialogProps['onEditComponent'];
}) {
  const [selected, setSelected] = useState(f.components[0]);
  const component = f.components.includes(selected)
    ? selected
    : f.components[0];
  const sourceId = useId();
  return (
    <article className={`preflight-finding preflight-${f.severity}`}>
      <h3>
        <span
          className="preflight-severity"
          role="img"
          aria-label={labels[f.severity]}
        />
        <span className="preflight-rule">{f.ruleId}</span> {f.title}
      </h3>
      <p>{f.explanation}</p>
      <details className="preflight-evidence">
        <summary>Show Evidence</summary>
        {f.evidence.map((e, index) => (
          <div key={index}>
            <strong>{e.component}</strong>
            <blockquote>{e.text || '(empty source)'}</blockquote>
          </div>
        ))}
        {f.suggestedActions.length > 0 && (
          <>
            <strong>Suggested review</strong>
            <ul>
              {f.suggestedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </>
        )}
      </details>
      {component && (
        <div className="preflight-actions">
          {f.components.length > 1 && (
            <label htmlFor={sourceId}>
              Source
              <select
                id={sourceId}
                aria-label={`Source for ${f.ruleId}: ${f.title}`}
                value={component}
                onChange={(event) =>
                  setSelected(event.target.value as PreflightComponent)
                }
              >
                {f.components.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onViewSource(component)}
            aria-label={`View source: ${component}`}
          >
            View Source
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onEditComponent(component)}
            aria-label={`${readOnly ? 'Edit a Copy' : 'Edit component'}: ${component}`}
          >
            {readOnly ? 'Edit a Copy' : 'Edit Component'}
          </button>
        </div>
      )}
      {f.severity !== 'blocking' && (
        <label className="preflight-acknowledge">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onAcknowledge(event.target.checked)}
          />
          <span>
            Mark as intentional <small>(local acknowledgement)</small>
          </span>
        </label>
      )}
    </article>
  );
}
