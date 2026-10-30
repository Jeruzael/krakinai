import type { SavedScene } from "../types/domain";

export const revisionRoot = (scene: SavedScene) =>
  scene.sceneRevision?.rootSceneId ?? scene.id;
export function getRevisionFamily(
  scene: SavedScene,
  scenes: SavedScene[],
): SavedScene[] {
  const root = revisionRoot(scene);
  return scenes
    .filter(
      (item) => item.id === root || item.sceneRevision?.rootSceneId === root,
    )
    .sort(
      (a, b) =>
        (a.sceneRevision?.sequence ?? 1) - (b.sceneRevision?.sequence ?? 1) ||
        a.id.localeCompare(b.id),
    );
}
export function getRevisionHead(
  scene: SavedScene,
  scenes: SavedScene[],
): SavedScene {
  return getRevisionFamily(scene, scenes).at(-1) ?? scene;
}
export function getRevisionLabel(scene: SavedScene): string {
  if (scene.separateTakeOfSceneId)
    return scene.sceneRevision
      ? `Alternate take · Version ${scene.sceneRevision.sequence}`
      : "Alternate take";
  return scene.sceneRevision
    ? `Version ${scene.sceneRevision.sequence}`
    : scene.separateTakeOfSceneId
      ? "Alternate take"
      : scene.versionOfSceneId
        ? "Legacy version"
        : "Original";
}
/** Validate managed metadata only; historical copy/version graphs are untouched. */
export function validateSceneRevisionGraph(
  scenes: SavedScene[],
): string | undefined {
  const byId = new Map(scenes.map((scene) => [scene.id, scene])),
    sequences = new Set<string>();
  for (const scene of scenes) {
    const revision = scene.sceneRevision;
    if (!revision) continue;
    if (
      revision.sequence === 1 &&
      (revision.rootSceneId !== scene.id ||
        revision.parentSceneId !== undefined)
    )
      return "Invalid managed revision root.";
    const key = JSON.stringify([revision.rootSceneId, revision.sequence]);
    if (sequences.has(key))
      return "Duplicate managed revision sequence or branch.";
    sequences.add(key);
    const parent = revision.parentSceneId
      ? byId.get(revision.parentSceneId)
      : undefined;
    if (
      parent &&
      (revisionRoot(parent) !== revision.rootSceneId ||
        (parent.sceneRevision?.sequence ?? 1) + 1 !== revision.sequence)
    )
      return "Inconsistent revision parent, root or sequence.";
    const root = byId.get(revision.rootSceneId);
    if (
      root?.sceneRevision &&
      (root.sceneRevision.rootSceneId !== root.id ||
        root.sceneRevision.sequence !== 1)
    )
      return "Managed revision root must be an original scene.";
    const seen = new Set<string>([scene.id]);
    let cursor = parent;
    while (cursor?.sceneRevision?.parentSceneId) {
      if (seen.has(cursor.id)) return "Cyclic managed scene revision history.";
      seen.add(cursor.id);
      cursor = byId.get(cursor.sceneRevision.parentSceneId);
    }
  }
}
export interface VersionLine {
  kind: "same" | "added" | "removed";
  text: string;
}
export function compareSceneVersions(before: SavedScene, after: SavedScene) {
  const beforeText = before.outputs.full,
    afterText = after.outputs.full;
  const left = beforeText.split("\n"),
    right = afterText.split("\n");
  const limited =
    left.length * right.length > 250_000 || left.length + right.length > 3000;
  const lines: VersionLine[] = [];
  if (!limited) {
    const table = Array.from(
      { length: left.length + 1 },
      () => new Uint16Array(right.length + 1),
    );
    for (let i = left.length - 1; i >= 0; i--)
      for (let j = right.length - 1; j >= 0; j--)
        table[i][j] =
          left[i] === right[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        lines.push({ kind: "same", text: left[i++] });
        j++;
      } else if (
        j < right.length &&
        (i === left.length || table[i][j + 1] >= table[i + 1][j])
      )
        lines.push({ kind: "added", text: right[j++] });
      else lines.push({ kind: "removed", text: left[i++] });
    }
  }
  const changes: string[] = [];
  const check = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(label);
  };
  check(
    "Aspect ratio",
    before.settings.aspectRatio,
    after.settings.aspectRatio,
  );
  check(
    "Duration",
    before.settings.durationSeconds,
    after.settings.durationSeconds,
  );
  check("Shot Type", before.shotType, after.shotType);
  check(
    "Reference associations",
    {
      pack: before.referencePack,
      direct: before.directReferences,
      references: before.references,
    },
    {
      pack: after.referencePack,
      direct: after.directReferences,
      references: after.references,
    },
  );
  check(
    "Original source media",
    before.sourceMediaLinks,
    after.sourceMediaLinks,
  );
  check(
    "Character identity snapshot",
    before.slots.character,
    after.slots.character,
  );
  check("Pending inputs", before.pendingInputs, after.pendingInputs);
  check(
    "Authoring mode",
    before.authoringMode ?? "recipe",
    after.authoringMode ?? "recipe",
  );
  return { beforeText, afterText, lines, limited, changes };
}
