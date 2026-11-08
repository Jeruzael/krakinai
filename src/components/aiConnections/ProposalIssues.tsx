import React from 'react';
import type {ProposalReadiness,ProposalReviewIssue,CandidateDependencyAnalysis} from '../../domain/proposalReadiness';

export function ProposalIssues({
  readiness,
  onGoTo,
  candidateAnalysis,
  disabled,
  onBulkCreateCandidates,
}: {
  readiness: ProposalReadiness;
  onGoTo(issue: ProposalReviewIssue): void;
  candidateAnalysis?: CandidateDependencyAnalysis;
  disabled?: boolean;
  onBulkCreateCandidates?(): void;
}) {
  const dependencyConflicts = readiness.conflicts.filter(c => c.code === 'DEPENDENCY_BLOCKED');
  const otherConflicts = readiness.conflicts.filter(c => c.code !== 'DEPENDENCY_BLOCKED');
  const uniqueDependencyConflicts = Array.from(
    new Map(dependencyConflicts.map(c => [c.target.operationId ?? c.id, c])).values()
  );
  const blockedCount = uniqueDependencyConflicts.length;

  const renderIssue = (issue: ProposalReviewIssue) => (
    <article key={issue.id} className={'pr-issue ' + (issue.kind === 'conflict' ? 'pr-issue-conflict' : '')}>
      <code>{issue.code} · {issue.target.operationId ?? 'Batch'}</code>
      <p>{issue.message}</p>
      {issue.projectId && <p className="muted-text">Project: {issue.projectId}</p>}
      {issue.shotId && <p className="muted-text">Shot: {issue.shotId}</p>}
      <details>
        <summary>What to do</summary>
        <p>{issue.remedy}</p>
      </details>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label={`Go to ${issue.code} (${issue.target.operationId ?? 'Batch'})`}
        onClick={() => onGoTo(issue)}
      >
        Go to {issue.target.operationId ?? 'Batch'} →
      </button>
    </article>
  );

  const renderConflicts = () => {
    if (!readiness.conflicts.length) return null;
    return (
      <section className="pr-issue-group" aria-label="Data conflicts">
        <h4>Data conflicts</h4>
        {candidateAnalysis && candidateAnalysis.bulkCreatableCandidates.length > 0 && onBulkCreateCandidates && (
          <section className="card pr-bulk-card" aria-label="Bulk candidate actions">
            <h4>Fast-track candidates</h4>
            <p className="muted-text">
              {candidateAnalysis.bulkCreatableCandidates.length} candidate proposal(s) have no conflicts and can be created immediately as library items.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={onBulkCreateCandidates}
            >
              Create all new candidates ({candidateAnalysis.bulkCreatableCandidates.length})
            </button>
          </section>
        )}
        {otherConflicts.map(renderIssue)}
        {dependencyConflicts.length === 1 && renderIssue(dependencyConflicts[0])}
        {dependencyConflicts.length > 1 && (
          <article className="pr-issue pr-issue-conflict pr-issue-grouped">
            <code>DEPENDENCY_BLOCKED · {blockedCount} scene{blockedCount === 1 ? '' : 's'} blocked</code>
            <p>
              {blockedCount} scene{blockedCount === 1 ? '' : 's'} depend on deferred candidate proposals. Approve or reuse them to unblock assembly.
            </p>
            {candidateAnalysis && candidateAnalysis.blockingCandidates.length > 0 && (
              <ul className="pr-blocking-candidates-list">
                {candidateAnalysis.blockingCandidates.map(c => (
                  <li key={c.operationId}>
                    <strong>{c.title}</strong> ({c.candidateKind}{c.clientRef ? ` · ref:${c.clientRef}` : ''}) — blocks {c.dependentSceneIds.length} scene(s)
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary>What to do</summary>
              <p>{uniqueDependencyConflicts[0].remedy}</p>
            </details>
            <div className="pr-grouped-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label={`Go to ${uniqueDependencyConflicts[0].code} (${uniqueDependencyConflicts[0].target.operationId ?? 'Batch'})`}
                onClick={() => onGoTo(uniqueDependencyConflicts[0])}
              >
                Go to {uniqueDependencyConflicts[0].target.operationId ?? 'Batch'} →
              </button>
              <details className="pr-grouped-scenes">
                <summary>View all {blockedCount} blocked scenes</summary>
                <div className="pr-grouped-scene-buttons">
                  {uniqueDependencyConflicts.slice(1).map(issue => (
                    <button
                      key={issue.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-label={`Go to ${issue.code} (${issue.target.operationId ?? 'Batch'})`}
                      onClick={() => onGoTo(issue)}
                    >
                      Go to {issue.target.operationId ?? 'Batch'} →
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </article>
        )}
      </section>
    );
  };

  const group = (name: string, items: ProposalReviewIssue[]) =>
    items.length ? (
      <section className="pr-issue-group" aria-label={name}>
        <h4>{name}</h4>
        {items.map(renderIssue)}
      </section>
    ) : null;

  return (
    <div className="pr-issues">
      {renderConflicts()}
      {group('Connection and review requirements', readiness.lifecycle)}
      {readiness.approvals.length > 0 && (
        <details className="pr-approval-issues">
          <summary>{readiness.approvalCount} approval category/categories still required</summary>
          {group('Pending explicit approvals', readiness.approvals)}
        </details>
      )}
      {readiness.confirmationRequired && (
        <p className="muted-text">Final confirmation is also required: “I reviewed this exact proposal.”</p>
      )}
      {readiness.advisories.length > 0 && (
        <details>
          <summary>Advisories ({readiness.advisories.length})</summary>
          {group('Advisory findings', readiness.advisories)}
        </details>
      )}
      {!readiness.conflicts.length && !readiness.lifecycle.length && (
        <p className="pr-clear">No blocking data or connection conflicts.</p>
      )}
      {readiness.warnings.map((message, i) => (
        <p key={i} className="banner banner-warning">
          Not saved for later: {message}
        </p>
      ))}
    </div>
  );
}
