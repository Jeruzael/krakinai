import {
  clearAllStoresForTesting,
  initializeDatabase,
  openDatabase,
  saveMediaAsset,
} from "../../storage/db";
import { ensembleDraft } from "./ensembleFixture";
import { recipeState } from "./recipeChangeSetFixture";
import { syncEnsemblePrimary } from "../../domain/ensemble";
export const ENSEMBLE_TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPwd3v6HwAE3AJ6zM4FjgAAAABJRU5ErkJggg==";
export async function writeRecord(store: string, value: unknown) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
export async function ensembleStorageFixture(withMedia = false) {
  await clearAllStoresForTesting();
  await initializeDatabase();
  const state = recipeState(),
    s = ensembleDraft();
  for (const a of state.assets) await writeRecord("assets", a);
  for (const c of state.collections) await writeRecord("collections", c);
  const base = state.assets.find((a) => a.category === "characters")!;
  for (const p of s.ensemble!.participants)
    await writeRecord("assets", {
      ...base,
      id: p.character.sourceId,
      title: p.character.sourceTitle,
      promptText: p.character.promptText,
      revision: p.character.sourceRevision,
    });
  if (withMedia) {
    // New CRC-correct 1x1 RGBA PNG; independently decoded in B2 browser acceptance.
    // The inherited B1 byte fixture is retained separately and is not decodable.
    const bytes = Uint8Array.from(atob(ENSEMBLE_TEST_PNG_BASE64), (c) =>
      c.charCodeAt(0),
    );
    const media = await saveMediaAsset({
      filename: "synthetic-one-pixel.png",
      mimeType: "image/png",
      blob: new Blob([bytes], { type: "image/png" }),
    });
    for (const p of s.ensemble!.participants)
      p.character.mediaLinks = [
        {
          mediaId: media.id,
          role: "reference",
          altText: "Shared synthetic guide, separate participant association.",
          order: 0,
        },
      ];
  }
  return syncEnsemblePrimary(s);
}
