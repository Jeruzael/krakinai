import React, { useEffect, useRef, useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import { createDirectPromptDraft } from "../storage/sceneAuthoring";
import {
  getProjectSaveTarget,
  carryProjectTarget,
} from "../domain/projectRoutes";
import { DirectPromptWorkspace } from "../components/DirectPromptWorkspace";

export const DirectPromptScreen: React.FC<{
  id?: string;
  preview?: boolean;
}> = ({ id, preview }) => {
  const { snapshot, hashPath, navigate, refreshSnapshot } = useLibrary();
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (id || !snapshot || started.current) return;
    started.current = true;
    const context = getProjectSaveTarget(hashPath, snapshot.collections);
    if (context.error) {
      setError(context.error);
      return;
    }
    const target = context.target
      ? {
          ...context.target,
          expectedProjectRevision: snapshot.collections.find(
            (c) => c.id === context.target!.collectionId,
          )!.project!.revision,
        }
      : undefined;
    void createDirectPromptDraft(target)
      .then(async (draft) => {
        await refreshSnapshot();
        navigate(carryProjectTarget(`/builder/${draft.id}`, hashPath), true);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create a direct prompt draft.",
        ),
      );
  }, [id, snapshot, hashPath, navigate, refreshSnapshot]);
  if (error)
    return (
      <div className="card" role="alert">
        {error}
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/scenes")}
        >
          Back to Saved Scenes
        </button>
      </div>
    );
  return id ? (
    <DirectPromptWorkspace key={id} id={id} preview={preview} />
  ) : (
    <div className="card" role="status">
      Creating a fresh Direct Prompt draft…
    </div>
  );
};
