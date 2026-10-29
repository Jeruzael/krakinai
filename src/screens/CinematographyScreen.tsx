import React, { useId, useState } from "react";
import { LibraryScreen } from "./LibraryScreen";
import { useLibrary } from "../context/LibraryContext";
import { CinematographyExplorer } from "../components/CinematographyExplorer";
import { CameraComposer } from "../components/CameraComposer";
import { CinematographyTabs } from "../components/CinematographyTabs";
import { CinematographyPackDialog } from "../components/CinematographyPackDialog";
import { installCinematographyCorePresets } from "../storage/cinematographyPresets";
import { saveSceneDraft } from "../storage/db";
import { carryProjectTarget } from "../domain/projectRoutes";
import type { SceneDraft } from "../types/domain";
export const CinematographyScreen: React.FC = () => {
  const {
      snapshot,
      hashPath,
      navigate,
      getOrCreateActiveDraft,
      refreshSnapshot,
      showToast,
    } = useLibrary(),
    id = useId();
  const view =
    new URLSearchParams(hashPath.split("?")[1] ?? "").get("view") ===
    "techniques"
      ? "techniques"
      : "presets";
  const [composer, setComposer] = useState<{
    initialTechniqueId?: string;
    draft?: SceneDraft;
  } | null>(null);
  const [showPack, setShowPack] = useState(false);
  if (!snapshot) return null;
  const active = snapshot.preferences.activeDraftId
    ? snapshot.drafts.find((d) => d.id === snapshot.preferences.activeDraftId)
    : snapshot.drafts[0];
  return (
    <div className="cinema-library">
      <div className="cinema-library-toolbar">
        <CinematographyTabs
          id={id}
          label="Camera library view"
          value={view}
          onChange={(value) => navigate(`/library/camera?view=${value}`)}
          tabs={[
            { value: "presets", label: "My Camera presets" },
            { value: "techniques", label: "Technique explorer" },
          ]}
        />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowPack(true)}
        >
          Review core preset pack
        </button>
      </div>
      <section
        role="tabpanel"
        id={`${id}-${view}-panel`}
        aria-labelledby={`${id}-${view}`}
      >
        {view === "presets" ? (
          <LibraryScreen mode="category" category="camera" />
        ) : (
          <CinematographyExplorer
            initialShotType={active?.shotType}
            onCompose={(initialTechniqueId) =>
              setComposer({ initialTechniqueId, draft: active })
            }
            onBrowseOwner={(owner) =>
              navigate(
                owner === "storyboard" ? "/collections" : `/library/${owner}`,
              )
            }
          />
        )}
      </section>
      {composer && (
        <CameraComposer
          snapshot={composer.draft?.slots.camera}
          assets={snapshot.assets}
          shotType={composer.draft?.shotType}
          durationSeconds={composer.draft?.settings.durationSeconds}
          sceneInstructions={composer.draft?.sceneInstructions}
          initialTechniqueId={composer.initialTechniqueId}
          onClose={() => setComposer(null)}
          onApply={async (camera) => {
            if (!composer.draft && !camera) {
              setComposer(null);
              return;
            }
            const draft = composer.draft ?? (await getOrCreateActiveDraft());
            if (JSON.stringify(draft.slots.camera) === JSON.stringify(camera)) {
              setComposer(null);
              return;
            }
            const slots = { ...draft.slots };
            if (camera) slots.camera = camera;
            else delete slots.camera;
            const saved = await saveSceneDraft({
              ...draft,
              inputRevision: undefined,
              slots,
            });
            await refreshSnapshot();
            setComposer(null);
            showToast("Camera directions applied to this scene.", "success");
            navigate(carryProjectTarget(`/builder/${saved.id}`, hashPath));
          }}
        />
      )}{" "}
      {showPack && (
        <CinematographyPackDialog
          assets={snapshot.assets}
          onClose={() => setShowPack(false)}
          onInstall={async (ids) => {
            const result = await installCinematographyCorePresets(ids);
            try {
              await refreshSnapshot();
            } catch {
              showToast(
                "Preset installation completed. Reload to refresh the library view.",
                "warning",
              );
            }
            return result;
          }}
        />
      )}
    </div>
  );
};
