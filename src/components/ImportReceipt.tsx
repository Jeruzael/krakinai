import React from "react";
import type { ChangeSetReceipt } from "../types/changeSet";
import { useLibrary } from "../context/LibraryContext";
export function ImportReceipt({
  receipt,
  replay,
  onNew,
  newLabel = 'Import another package',
}: {
  receipt: ChangeSetReceipt;
  replay: boolean;
  onNew: () => void;
  newLabel?: string;
}) {
  const { snapshot, navigate } = useLibrary();
  return (
    <section className="card import-receipt">
      <h2>Import receipt</h2>
      <p role="status">
        {replay
          ? "This change set was already applied. The stored receipt was returned; no records were created again."
          : "Approved changes saved together."}
      </p>
      <p>
        <strong>{receipt.title ?? receipt.changeSetId}</strong> ·{" "}
        {receipt.source.kind} · {receipt.appliedAt}
      </p>
      <p>
        {receipt.operations.length} operation results. IDs below are historical;
        replay does not recreate deleted records.
      </p>
      <div className="import-buttons">
        {Object.keys(receipt.projectRevisions).map((id) => (
          <button
            type="button"
            key={id}
            className="btn btn-secondary"
            disabled={!snapshot?.collections.some((c) => c.id === id)}
            onClick={() =>
              navigate(`/collections/${encodeURIComponent(id)}?tab=storyboard`)
            }
          >
            Open{" "}
            {snapshot?.collections.find((c) => c.id === id)?.name ??
              "removed project"}
          </button>
        ))}
        <button type="button" className="btn btn-primary" onClick={onNew}>
          {newLabel}
        </button>
      </div>
      <details className="import-group">
        <summary>
          Scene results and operation outcomes ({receipt.operations.length})
        </summary>
        <div className="import-receipt-results">
          {receipt.operations.map((result) => (
            <div className="import-operation" key={result.operationId}>
              <div>
                <strong>{result.operationId}</strong>
                <small>
                  {result.type} · {result.status}
                </small>
                <code>{result.recordId}</code>
              </div>
              {result.type.startsWith("scene.") && result.recordId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={
                    !snapshot?.scenes.some((s) => s.id === result.recordId)
                  }
                  onClick={() =>
                    navigate(`/output/${encodeURIComponent(result.recordId!)}`)
                  }
                >
                  Open scene
                </button>
              )}
            </div>
          ))}
        </div>
      </details>
      <details className="import-group">
        <summary>Created ID mappings and approval record</summary>
        <pre>
          {JSON.stringify(
            {
              changeSetId: receipt.changeSetId,
              packageDigest: receipt.packageDigest,
              approvedDigest: receipt.approvedDigest,
              idMappings: receipt.idMappings,
              approval: receipt.approval,
              projectRevisions: receipt.projectRevisions,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
