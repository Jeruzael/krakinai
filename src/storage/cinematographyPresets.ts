import type { PromptAsset } from "../types/domain";
import {
  CINEMATOGRAPHY_CORE_PRESETS,
  CINEMATOGRAPHY_CORE_PACK_VERSION,
  previewCinematographyCorePresets,
  type CinematographyPresetPreview,
} from "../domain/cinematographyPresets";
import { validatePromptAssetInput } from "../domain/validation";
import { openDatabase } from "./db";
export interface CinematographyInstallResult {
  added: PromptAsset[];
  skipped: CinematographyPresetPreview[];
  beforeCount: number;
  afterCount: number;
}
export async function installCinematographyCorePresets(
  techniqueIds: string[],
): Promise<CinematographyInstallResult> {
  if (
    !Array.isArray(techniqueIds) ||
    !techniqueIds.length ||
    techniqueIds.length > 8 ||
    new Set(techniqueIds).size !== techniqueIds.length ||
    techniqueIds.some(
      (id) => !CINEMATOGRAPHY_CORE_PRESETS.some((p) => p.techniqueId === id),
    )
  )
    throw new Error(
      "Choose one or more valid, unique core presets to install.",
    );
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["assets"], "readwrite"),
      store = tx.objectStore("assets");
    let result: CinematographyInstallResult, failure: Error | undefined;
    const abort = (error: unknown) => {
      failure =
        error instanceof Error
          ? error
          : new Error("Camera preset installation failed.");
      try {
        tx.abort();
      } catch {
        reject(failure);
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        failure ??
          tx.error ??
          new Error("Camera preset installation was rolled back."),
      );
    tx.onerror = () => {};
    const read = store.getAll();
    read.onsuccess = () => {
      try {
        const before = read.result as PromptAsset[],
          rows = previewCinematographyCorePresets(before).filter((r) =>
            techniqueIds.includes(r.preset.techniqueId),
          ),
          added: PromptAsset[] = [],
          skipped = rows.filter((r) => r.state !== "available"),
          now = new Date().toISOString();
        for (const row of rows.filter((r) => r.state === "available")) {
          const p = row.preset,
            record: PromptAsset = {
              id: p.assetId,
              title: p.title,
              category: "camera",
              description:
                "Optional Camera & Cinematography core technique. Configure independently for each scene.",
              promptText: p.promptText,
              compactText: p.promptText,
              tags: ["cinematography", "core pack v1", ...p.aliases].slice(
                0,
                20,
              ),
              mediaLinks: [],
              favorite: false,
              reviewStatus: "unreviewed",
              provenance: { toolName: "KRAKINAI technique registry" },
              notes: `Pack: krakinai.cinematography-core@${CINEMATOGRAPHY_CORE_PACK_VERSION}\nTechnique ID: ${p.techniqueId}\nCamera-only planning descriptor. Untested in external generators; no provider capability is guaranteed.`,
              revision: 1,
              createdAt: now,
              updatedAt: now,
            };
          const validation = validatePromptAssetInput(record);
          if (!validation.valid)
            throw new Error(Object.values(validation.errors).join(" "));
          store.add(record);
          added.push(record);
        }
        const check = store.getAll();
        check.onsuccess = () => {
          try {
            const after = check.result as PromptAsset[],
              newIds = new Set(added.map((a) => a.id));
            if (
              after.length !== before.length + added.length ||
              JSON.stringify(after.filter((a) => !newIds.has(a.id))) !==
                JSON.stringify(before)
            )
              throw new Error(
                "Existing Camera assets changed unexpectedly; installation rolled back.",
              );
            result = {
              added,
              skipped,
              beforeCount: before.length,
              afterCount: after.length,
            };
          } catch (error) {
            abort(error);
          }
        };
      } catch (error) {
        abort(error);
      }
    };
  });
}
