import type {
  ChangeSetPlan,
  ChangeSetState,
  ImportLedger,
} from "../types/changeSet";
import { MAX_MANIFEST_BYTES } from "./validation";
import { buildBackupManifest } from "../storage/backup";

/** Retain the existing full-backup metadata bound; imported records must remain restorable. */
export function validateChangeSetBackupCapacity(
  state: ChangeSetState,
  plan: ChangeSetPlan,
  ledger: ImportLedger,
  appliedAt: string,
): number {
  const projects = new Map(plan.collections.map((c) => [c.id, c]));
  const snapshot = {
    ...state,
    variants: [...(state.variants ?? []),...(plan.variants??[])],
    drafts: state.drafts ?? [],
    collections: [
      ...state.collections.map((c) => projects.get(c.id) ?? c),
      ...plan.collections.filter(
        (c) => !state.collections.some((before) => before.id === c.id),
      ),
    ],
    scenes: [...state.scenes, ...plan.scenes],
    assets: [...state.assets, ...plan.assets],
    templates: [...state.templates, ...plan.templates],
    preferences: {
      ...state.preferences,
      aiImports: ledger,
      updatedAt: appliedAt,
    },
  };
  const bytes = new TextEncoder().encode(
    JSON.stringify(buildBackupManifest(snapshot, appliedAt), null, 2),
  ).length;
  if (bytes > MAX_MANIFEST_BYTES)
    throw Error(
      `Resulting full-backup metadata would be ${bytes.toLocaleString()} bytes, exceeding the existing 20 MiB backup metadata allowance. Use a smaller batch; no records were changed.`,
    );
  return bytes;
}
