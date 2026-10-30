import React from "react";
import { useLibrary } from "../context/LibraryContext";
import "./aiPlanningActions.css";
export function AiPlanningActions({ projectId }: { projectId?: string }) {
  const { navigate } = useLibrary();
  return (
    <details className="cw-import-tools">
      <summary>AI planning tools</summary>
      <div className="ai-planning-buttons">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/imports/ai")}
        >
          Import AI Change Set
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            navigate(
              `/context/ai${projectId ? "?project=" + encodeURIComponent(projectId) : ""}`,
            )
          }
        >
          Export Context for AI
        </button>
      </div>
    </details>
  );
}
