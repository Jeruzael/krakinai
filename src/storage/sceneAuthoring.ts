import type {
  Collection,
  MediaAsset,
  PromptAsset,
  SavedScene,
  SceneDraft,
} from "../types/domain";
import type {
  SceneProjectTarget,
  SceneRevision,
} from "../types/sceneAuthoring";
import {
  generateId,
  getAllSnapshot,
  openDatabase,
  saveSceneDraft,
  savedAvoidPrefix,
} from "./db";
import {
  getDirectReferenceLinks,
  reconcileDirectReferencePack,
} from "../domain/directPromptReferences";
import {
  isDirectPrompt,
  validateDirectAttachments,
  validateSceneAuthoring,
  validateSceneProjectTarget,
} from "../domain/directPrompt";
import { getRevisionHead, revisionRoot } from "../domain/sceneRevisions";
import { assembleScenePrompt } from "../domain/promptAssembler";
import {
  getActiveReferencePack,
  getActiveSceneSlots,
  getActiveSourceMediaLinks,
  getCapturedAvoidPrefix,
  validateShotSourceMedia,
} from "../domain/shotTypeRules";
import { resolveGenerationIdentity } from "../domain/identityAnchors";
import { captureMediaNames } from "../domain/mediaNaming";
import { validatePhase4Record } from "../domain/phase4Validation";
import {
  findSimilarScenes,
  SimilarSceneError,
} from "../domain/sceneDuplicates";
import {
  getProjectShots,
  projectMembersFromShots,
} from "../domain/projectStoryboard";
import { validateProject } from "../domain/phase5ProjectValidation";
import { validateCameraCompositionSlots } from "../domain/cameraCompositionValidation";

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error("Scene save transaction aborted."));
  });
const clone = <T>(value: T): T => structuredClone(value);
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            item !== undefined && !["updatedAt", "inputRevision"].includes(key),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}
export interface AuthoredSaveOptions {
  requestId: string;
  expectedInputRevision: number;
  target?: SceneProjectTarget;
  selectAsPreferred?: boolean;
  allowDuplicate?: boolean;
}
const emptyDraft = () => ({
  title: "",
  slots: {},
  extraRequiredSlots: [],
  sceneInstructions: "",
  settings: {},
  manualOutputs: {},
  resultMediaLinks: [],
  reviewNotes: "",
  reviewStatus: "unreviewed" as const,
});
export async function createDirectPromptDraft(
  target?: SceneProjectTarget,
): Promise<SceneDraft> {
  if (target) {
    const error = validateSceneProjectTarget(target);
    if (error) throw new Error(error);
  }
  const snapshot = target ? await getAllSnapshot() : undefined;
  const collection = snapshot?.collections.find(
    (c) => c.id === target?.collectionId,
  );
  const shot = collection?.project?.shots.find((s) => s.id === target?.shotId);
  if (
    target &&
    (!collection ||
      (target.shotId && !shot) ||
      (collection.project?.revision ?? 0) !== target.expectedProjectRevision)
  )
    throw new Error(
      "The target project or shot changed. Refresh before importing a prompt.",
    );
  return saveSceneDraft({
    ...emptyDraft(),
    title: shot ? `${shot.code} — ${shot.title}`.slice(0, 100) : "",
    authoringMode: "direct_prompt",
    directPrompt: {
      version: 1,
      text: "",
      origin: "manual",
      importedAt: new Date().toISOString(),
    },
    ...(target ? { authoredProjectTarget: clone(target) } : {}),
    ...(shot?.plannedShotType ? { shotType: shot.plannedShotType } : {}),
    settings: {
      ...(shot?.plannedDurationSeconds && shot.plannedDurationSeconds <= 60
        ? { durationSeconds: shot.plannedDurationSeconds }
        : {}),
    },
  });
}
export async function createSceneRevisionDraft(
  sceneId: string,
  options: {
    asDirect?: boolean;
    restoreFromSceneId?: string;
    target?: SceneProjectTarget;
    alternateTake?: boolean;
  } = {},
): Promise<SceneDraft> {
  const snap = await getAllSnapshot();
  const parent = snap.scenes.find((s) => s.id === sceneId);
  if (!parent) throw new Error("Saved scene not found.");
  const root = revisionRoot(parent),
    head = getRevisionHead(parent, snap.scenes);
  const source = options.restoreFromSceneId
    ? snap.scenes.find((s) => s.id === options.restoreFromSceneId)
    : parent;
  if (!source || revisionRoot(source) !== root)
    throw new Error(
      "Restore source must belong to this scene revision history.",
    );
  if (options.target) {
    const error = validateSceneProjectTarget(options.target);
    if (error) throw new Error(error);
    const collection = snap.collections.find(
        (c) => c.id === options.target!.collectionId,
      ),
      shot = collection?.project?.shots.find(
        (s) => s.id === options.target!.shotId,
      );
    if (!shot || !shot.takeSceneIds.includes(parent.id))
      throw new Error(
        "The source scene does not belong to the explicit target project shot.",
      );
    if (
      collection!.project!.revision !== options.target.expectedProjectRevision
    )
      throw new Error(
        "Project revision changed. Refresh and review before editing.",
      );
  } else if (
    snap.collections.filter((c) =>
      c.project?.shots.some((s) => s.takeSceneIds.includes(parent.id)),
    ).length > 1
  )
    throw new Error(
      "This scene belongs to multiple projects. Choose an explicit project and shot before revising.",
    );
  const direct = options.asDirect || isDirectPrompt(source);
  const prefix = savedAvoidPrefix(source, snap.scenes);
  const editableAvoid =
    !direct &&
    prefix &&
    (source.avoidText === prefix || source.avoidText?.startsWith(`${prefix}, `))
      ? source.avoidText === prefix
        ? ""
        : source.avoidText!.slice(prefix.length + 2)
      : source.avoidText;
  return saveSceneDraft({
    ...emptyDraft(),
    title: source.title,
    slots: clone(source.slots),
    extraRequiredSlots: clone(source.extraRequiredSlots),
    sceneInstructions: source.sceneInstructions,
    dialogue: clone(source.dialogue),
    settings: clone(source.settings),
    sourceSceneId: source.id,
    shotType: source.shotType,
    sourceMediaLinks: clone(source.sourceMediaLinks),
    referencePack: clone(source.referencePack),
    generation: clone(source.generation),
    avoidText: editableAvoid,
    inheritedAvoidPrefix: direct ? source.inheritedAvoidPrefix : "",
    ...(direct
      ? {
          authoringMode: "direct_prompt" as const,
          directPrompt: isDirectPrompt(source)
            ? clone(source.directPrompt)
            : {
                version: 1 as const,
                text: source.outputs.full,
                origin: "manual" as const,
                originLabel: "Frozen Full output",
              },
          directReferences: getDirectReferenceLinks(source),
        }
      : { manualOutputs: clone(source.manualOutputs) }),
    pendingInputs: clone(source.pendingInputs),
    claimNotes: source.claimNotes,
    revisionIntent: {
      version: 1,
      kind: options.alternateTake ? "take" : "revision",
      parentSceneId: head.id,
      rootSceneId: root,
      expectedHeadId: head.id,
      contextSceneId: parent.id,
      ...(options.restoreFromSceneId ? { restoredFromSceneId: source.id } : {}),
    },
    ...(options.target ? { authoredProjectTarget: clone(options.target) } : {}),
  });
}

/** Browser-owned atomic operation; no external client has direct DB-file access. */
export async function saveAuthoredScene(
  draftId: string,
  options: AuthoredSaveOptions,
): Promise<SavedScene> {
  if (
    typeof options.requestId !== "string" ||
    !options.requestId.trim() ||
    options.requestId.length > 1000
  )
    throw new Error("A bounded save request ID is required.");
  if (
    !Number.isSafeInteger(options.expectedInputRevision) ||
    options.expectedInputRevision < 1
  )
    throw new Error("An expected draft input revision is required.");
  const db = await openDatabase(),
    tx = db.transaction(
      ["drafts", "scenes", "assets", "media", "collections"],
      "readwrite",
    ),
    completion = done(tx);
  try {
    const drafts = tx.objectStore("drafts"),
      sceneStore = tx.objectStore("scenes"),
      collections = tx.objectStore("collections");
    const draft = await request<SceneDraft | undefined>(drafts.get(draftId));
    if (!draft) throw new Error("Scene draft not found.");
    const target = options.target ?? draft.authoredProjectTarget;
    if (target) {
      const error = validateSceneProjectTarget(target);
      if (error) throw new Error(error);
    }
    if (
      draft.authoredProjectTarget &&
      JSON.stringify(stable(target)) !==
        JSON.stringify(stable(draft.authoredProjectTarget))
    )
      throw new Error(
        "Explicit project target differs from the reviewed draft. Return to the intended storyboard.",
      );
    const fingerprint = JSON.stringify(
      stable({
        draftId,
        draft,
        expectedInputRevision: options.expectedInputRevision,
        target,
        selectAsPreferred: !!options.selectAsPreferred,
        allowDuplicate: !!options.allowDuplicate,
      }),
    );
    const scenes = await request<SavedScene[]>(sceneStore.getAll());
    const retry = scenes.find((s) => s.saveRequestId === options.requestId);
    if (retry) {
      if (retry.authoredSaveFingerprint !== fingerprint)
        throw new Error(
          "Save request ID was already used for a different operation.",
        );
      await completion;
      return retry;
    }
    if (draft.inputRevision !== options.expectedInputRevision)
      throw new Error(
        "This draft changed in another tab. Refresh and compare before saving; the stored draft is preserved.",
      );
    const metadataError = validatePhase4Record(draft);
    if (metadataError) throw new Error(metadataError);
    const cameraError = validateCameraCompositionSlots(draft.slots);
    if (cameraError) throw new Error(cameraError);
    const mediaMap = new Map(
      (await request<MediaAsset[]>(tx.objectStore("media").getAll())).map(
        (m) => [m.id, m],
      ),
    );
    const capture = <T extends import("../types/domain").MediaLink>(
      links: T[],
    ) =>
      captureMediaNames(
        links.map((link) => ({
          ...link,
          filename: link.filename ?? mediaMap.get(link.mediaId)?.filename,
          mimeType: link.mimeType ?? mediaMap.get(link.mediaId)?.mimeType,
        })),
        mediaMap,
      );
    const now = new Date().toISOString(),
      id = generateId("scene");
    const intent = draft.revisionIntent;
    let parent: SavedScene | undefined;
    if (intent) {
      parent = scenes.find((s) => s.id === intent.parentSceneId);
      if (!parent)
        throw new Error(
          "Revision parent is unavailable. Preserve the draft and select an existing source.",
        );
      if (
        revisionRoot(parent) !== intent.rootSceneId ||
        getRevisionHead(parent, scenes).id !== intent.expectedHeadId ||
        parent.id !== intent.expectedHeadId
      )
        throw new Error(
          "A newer revision exists. Compare the current head, then explicitly rebase or create an alternate take.",
        );
      if (
        intent.restoredFromSceneId &&
        !scenes.some(
          (s) =>
            s.id === intent.restoredFromSceneId &&
            revisionRoot(s) === intent.rootSceneId,
        )
      )
        throw new Error("Restore source is outside this revision history.");
    }
    const allCollections = await request<Collection[]>(collections.getAll());
    if (intent) {
      const contextScene = scenes.find(
        (scene) =>
          scene.id ===
          (intent.contextSceneId ?? draft.sourceSceneId ?? parent!.id),
      );
      if (!contextScene || revisionRoot(contextScene) !== intent.rootSceneId)
        throw new Error(
          "The explicit revision context belongs to a different scene history.",
        );
      const memberships = allCollections.flatMap((c) =>
        (c.project?.shots ?? [])
          .filter((s) => s.takeSceneIds.includes(contextScene.id))
          .map((s) => ({ collectionId: c.id, shotId: s.id })),
      );
      if (target) {
        if (
          !memberships.some(
            (m) =>
              m.collectionId === target.collectionId &&
              m.shotId === target.shotId,
          )
        )
          throw new Error(
            "Revision source does not belong to the target project shot.",
          );
      } else if (memberships.length > 1)
        throw new Error(
          "Choose an explicit project and shot for this revision.",
        );
    }
    const revision: SceneRevision = {
      version: 1,
      rootSceneId: intent?.kind === "revision" ? intent.rootSceneId : id,
      sequence:
        intent?.kind === "revision"
          ? (parent?.sceneRevision?.sequence ?? 1) + 1
          : 1,
      createdAt: now,
      ...(intent?.kind === "revision" ? { parentSceneId: parent!.id } : {}),
      ...(intent?.reason ? { reason: intent.reason } : {}),
      ...(intent?.restoredFromSceneId
        ? { restoredFromSceneId: intent.restoredFromSceneId }
        : {}),
      ...(draft.directPrompt?.origin
        ? { origin: draft.directPrompt.origin }
        : {}),
      ...(draft.directPrompt?.originLabel
        ? { originLabel: draft.directPrompt.originLabel }
        : {}),
    };
    const base = {
      id,
      title: draft.title.trim(),
      slots: clone(draft.slots),
      extraRequiredSlots: clone(draft.extraRequiredSlots),
      sceneInstructions: draft.sceneInstructions,
      settings: clone(draft.settings),
      manualOutputs: clone(draft.manualOutputs),
      references: [] as SavedScene["references"],
      resultMediaLinks: clone(draft.resultMediaLinks),
      reviewNotes: draft.reviewNotes,
      reviewStatus: draft.reviewStatus,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      sourceSceneId: draft.sourceSceneId,
      sourceDraftId: draft.id,
      sourceDraftInputRevision: draft.inputRevision,
      saveRequestId: options.requestId,
      authoredSaveFingerprint: fingerprint,
      sceneRevision: revision,
      ...(draft.shotType !== undefined ? { shotType: draft.shotType } : {}),
      ...(draft.pendingInputs !== undefined
        ? { pendingInputs: clone(draft.pendingInputs) }
        : {}),
      ...(draft.claimNotes !== undefined
        ? { claimNotes: draft.claimNotes }
        : {}),
      ...(intent
        ? {
            saveDecision:
              intent.kind === "revision"
                ? ("version" as const)
                : ("take" as const),
            ...(intent.kind === "revision"
              ? { versionOfSceneId: parent!.id }
              : { separateTakeOfSceneId: parent!.id }),
          }
        : {}),
    };
    let scene: SavedScene;
    if (isDirectPrompt(draft)) {
      const pack = reconcileDirectReferencePack(
        draft,
        scenes.find((scene) => scene.id === draft.sourceSceneId),
      );
      const errors = validateDirectAttachments(draft, mediaMap);
      if (errors.length) throw new Error(errors.join(" "));
      const refs = [
        ...(draft.directReferences ?? []),
        ...(draft.sourceMediaLinks ?? []),
      ];
      // Keep pack-only associations, with roles and names, even with empty component slots.
      for (const entry of pack?.entries ?? [])
        if (
          !refs.some(
            (l) =>
              l.mediaId === entry.mediaId &&
              l.role === entry.role &&
              l.altText === entry.altText,
          )
        )
          refs.push({ ...entry });
      scene = {
        ...base,
        authoringMode: "direct_prompt",
        directPrompt: clone(draft.directPrompt),
        outputs: { full: draft.directPrompt.text },
        manualOutputs: {},
        references: capture(refs),
        ...(draft.directReferences
          ? { directReferences: capture(draft.directReferences) }
          : {}),
        ...(draft.sourceMediaLinks
          ? { sourceMediaLinks: capture(draft.sourceMediaLinks) }
          : {}),
        ...(pack
          ? {
              referencePack: {
                ...clone(pack),
                entries: capture(pack.entries),
              },
            }
          : {}),
        ...(draft.generation ? { generation: clone(draft.generation) } : {}),
        ...(draft.avoidText !== undefined
          ? { avoidText: draft.avoidText }
          : {}),
      };
      const error = validatePhase4Record(scene);
      if (error) throw new Error(error);
    } else {
      const sourceErrors = validateShotSourceMedia(draft, mediaMap);
      if (sourceErrors.length) throw new Error(sourceErrors.join(" "));
      const activeSlots = getActiveSceneSlots(draft),
        pack = getActiveReferencePack(draft);
      const master = activeSlots.character
        ? await request<PromptAsset | undefined>(
            tx.objectStore("assets").get(activeSlots.character.sourceId),
          )
        : undefined;
      const assembled = assembleScenePrompt(draft);
      if (!assembled.valid) throw new Error(assembled.errors.join(" "));
      scene = {
        ...base,
        slots: clone(activeSlots),
        generation: resolveGenerationIdentity(
          { ...draft, slots: activeSlots },
          master,
        ).generation,
        referencePack: clone(pack),
        sourceMediaLinks: draft.sourceMediaLinks
          ? captureMediaNames(getActiveSourceMediaLinks(draft), mediaMap)
          : undefined,
        avoidText: assembled.avoidText,
        ...(draft.inheritedAvoidPrefix !== undefined
          ? { inheritedAvoidPrefix: getCapturedAvoidPrefix(draft) }
          : {}),
        dialogue: clone(draft.dialogue),
        outputs: {
          full: draft.manualOutputs.full?.text ?? assembled.outputs.full,
          structured:
            draft.manualOutputs.structured?.text ??
            assembled.outputs.structured,
          compact:
            draft.manualOutputs.compact?.text ?? assembled.outputs.compact,
        },
        references: captureMediaNames(assembled.references, mediaMap),
      };
    }
    for (const slot of Object.values(scene.slots))
      if (slot) slot.mediaLinks = captureMediaNames(slot.mediaLinks, mediaMap);
    scene.resultMediaLinks = captureMediaNames(
      scene.resultMediaLinks,
      mediaMap,
    );
    if (!intent && !options.allowDuplicate) {
      const matches = findSimilarScenes(scene, scenes);
      if (matches.length) throw new SimilarSceneError(matches);
    }
    if (target) {
      const collection = allCollections.find(
        (c) => c.id === target.collectionId,
      );
      if (!collection) throw new Error("Target project not found.");
      if (
        (collection.project?.revision ?? 0) !== target.expectedProjectRevision
      )
        throw new Error(
          "Project revision changed. Refresh and review the target before saving.",
        );
      const shots = clone(getProjectShots(collection, scenes));
      let shot = target.shotId
        ? shots.find((s) => s.id === target.shotId)
        : undefined;
      if (target.newShot) {
        shot = {
          id: generateId("shot"),
          order: shots.length,
          code: String(shots.length + 1).padStart(2, "0"),
          title: target.newShot.title,
          takeSceneIds: [],
          status: "planned",
          ...(target.newShot.plannedShotType
            ? { plannedShotType: target.newShot.plannedShotType }
            : {}),
        };
        shots.push(shot);
      }
      if (!shot) throw new Error("Target storyboard shot is unavailable.");
      shot.takeSceneIds.push(scene.id);
      if (options.selectAsPreferred) shot.selectedSceneId = scene.id;
      const updated = {
        ...collection,
        updatedAt: now,
        project: {
          ...collection.project,
          version: 1 as const,
          revision: (collection.project?.revision ?? 0) + 1,
          shots,
        },
        members: projectMembersFromShots(
          { ...collection, updatedAt: now },
          shots,
        ),
      };
      const error = validateProject(updated, [...scenes, scene]);
      if (error) throw new Error(error);
      collections.put(updated);
      scene.saveProjectTarget = {
        collectionId: collection.id,
        shotId: shot.id,
      };
    }
    sceneStore.add(scene);
    await completion;
    return scene;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await completion.catch(() => undefined);
    throw error;
  }
}
