import {prepareLocalFrameImages,applyLocalFrameImages,validateLocalFrameImageChoices,type LocalFrameImageChoices,type PreparedLocalFrameImages} from '../domain/localFrameImages';
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
  type LibrarySnapshot,
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
import {prepareEnsembleSource}from'../domain/ensemblePersistence';
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
import {resolveBlockingOutputs,type BlockingOutputDecisions} from '../domain/blockingOutputReview';
import {prepareFrameAuthoring,assertPreparedFrameAuthoring,type FrameAuthoringChoices,type PreparedFrameAuthoring} from '../domain/frameAuthoring';
import {withStableLibraryMedia} from './mediaPreparationLock';

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
export interface AuthoredSaveOptions extends FrameAuthoringChoices {
  frameImageChoices?:LocalFrameImageChoices;
  blockingOutputDecisions?:BlockingOutputDecisions;
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
export interface RevisionDraftOptions {asDirect?:boolean;restoreFromSceneId?:string;target?:SceneProjectTarget;alternateTake?:boolean}
export function buildRevisionDraft(sceneId:string,snap:Pick<LibrarySnapshot,'scenes'|'collections'>,options:RevisionDraftOptions={}):Omit<SceneDraft,'id'|'inputRevision'|'updatedAt'> {
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
  if(options.asDirect&&source.blocking)throw Error('Keep this blocking recipe intact. Direct Prompt conversion does not support authored blocking.');
  if(options.asDirect&&source.keyframePlan)throw Error('Keep this keyframe Recipe intact. Direct Prompt conversion would lose frame authorship.');
  if(options.asDirect&&source.ensemble)throw Error('Ensemble Direct Prompt conversion belongs to B3. Keep this recipe and its participants unchanged.');
  const prefix = savedAvoidPrefix(source, snap.scenes);
  const editableAvoid =
    !direct &&
    prefix &&
    (source.avoidText === prefix || source.avoidText?.startsWith(`${prefix}, `))
      ? source.avoidText === prefix
        ? ""
        : source.avoidText!.slice(prefix.length + 2)
      : source.avoidText;
  return {
    ...emptyDraft(),
    title: source.title,
    slots: clone(source.slots),
    ...(source.ensemble?{ensemble:clone(source.ensemble)}:{}),
    ...(source.blocking?{blocking:clone(source.blocking)}:{}),
    ...(source.keyframePlan?{keyframePlan:clone(source.keyframePlan)}:{}),
    ...(source.imagePromptSnapshots?{imagePromptSnapshots:clone(source.imagePromptSnapshots)}:{}),
    ...(source.manualImageOutputs?{manualImageOutputs:clone(source.manualImageOutputs)}:{}),
    extraRequiredSlots: clone(source.extraRequiredSlots),
    sceneInstructions: source.sceneInstructions,
    dialogue: clone(source.dialogue),
    settings: clone(source.settings),
    sourceSceneId: source.id,
    ...(!direct&&source.conversionProvenance?{authoringMode:'recipe' as const,conversionProvenance:clone(source.conversionProvenance)}:{}),
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
  };
}


export async function createSceneRevisionDraft(sceneId:string,options:RevisionDraftOptions={}):Promise<SceneDraft>{
  return saveSceneDraft(buildRevisionDraft(sceneId,await getAllSnapshot(),options));
}

function validateAuthoredSaveOptions(options:AuthoredSaveOptions):void {
  validateLocalFrameImageChoices(options.frameImageChoices);
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
}
function prepareAuthoredOperation(draft:SceneDraft,options:AuthoredSaveOptions){
  validateAuthoredSaveOptions(options);
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
        draftId:draft.id,
        draft,
        expectedInputRevision: options.expectedInputRevision,
        target,
        selectAsPreferred: !!options.selectAsPreferred,
        allowDuplicate: !!options.allowDuplicate,
        ...(options.blockingOutputDecisions?{blockingOutputDecisions:options.blockingOutputDecisions}:{}),
        ...(options.frameOutputDecisions?{frameOutputDecisions:options.frameOutputDecisions}:{}),
        ...(options.frameVideoDecision?{frameVideoDecision:options.frameVideoDecision}:{}),
        ...(options.frameImageChoices?{frameImageChoices:options.frameImageChoices}:{}),
      }),
    );
  return {target,fingerprint};
}
/** Synchronous shared planner; no persistence or asynchronous work. */
export function planAuthoredScene(draft:SceneDraft,options:AuthoredSaveOptions,state:Pick<LibrarySnapshot,'scenes'|'collections'|'assets'|'media'>,identity:{id:string;now:string},preparedFrames?:PreparedFrameAuthoring,preparedImages?:PreparedLocalFrameImages):{scene:SavedScene;collection?:Collection}{
  const {target,fingerprint}=prepareAuthoredOperation(draft,options);
  const scenes=state.scenes;
  const sourceScene=scenes.find(s=>s.id===draft.sourceSceneId),hasFrames=!!draft.keyframePlan||!!sourceScene?.keyframePlan;
  const preserveFrozen=!!draft.blocking||!!sourceScene?.blocking||hasFrames;
  let collectionUpdate:Collection|undefined;
    if (draft.inputRevision !== options.expectedInputRevision)
      throw new Error(
        "This draft changed in another tab. Refresh and compare before saving; the stored draft is preserved.",
      );
    const metadataError = validatePhase4Record(draft);
    if (metadataError) throw new Error(metadataError);
    const cameraError = validateCameraCompositionSlots(draft.slots);
    if (cameraError) throw new Error(cameraError);
    const mediaMap = new Map(state.media.map(m=>[m.id,m]));
    if(hasFrames&&!isDirectPrompt(draft)){
      if(!preparedFrames)throw Error('Prepare the exact keyframe outputs and video decision before saving.');
      assertPreparedFrameAuthoring(preparedFrames,draft,sourceScene,mediaMap,options);
    }
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
    const {now,id}=identity;
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
    const allCollections = state.collections;
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
      ...(draft.keyframePlan?{keyframePlan:clone(draft.keyframePlan)}:{}),
      ...(draft.blocking?{blocking:clone(draft.blocking)}:{}),
      ...(draft.ensemble?{ensemble:clone(draft.ensemble)}:{}),
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
      ...(draft.conversionProvenance?{authoringMode:'recipe' as const,conversionProvenance:clone(draft.conversionProvenance)}:{}),
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
      const master = activeSlots.character ? state.assets.find(a=>a.id===activeSlots.character!.sourceId) : undefined;
      const assembled = assembleScenePrompt(draft);
      if (!assembled.valid) throw new Error(assembled.errors.join(" "));
      const generation=resolveGenerationIdentity({...draft,slots:activeSlots},master).generation;
      if(preserveFrozen&&JSON.stringify(generation)!==JSON.stringify(draft.generation))throw Error('Review the Character identity dependency before saving blocking. Its frozen generation choice cannot be refreshed silently.');
      const resolution=preparedFrames?{valid:preparedFrames.video.valid,outputs:preparedFrames.video.outputs,manualOutputs:preparedFrames.video.manualOutputs,findings:preparedFrames.video.findings}:resolveBlockingOutputs(draft,assembled.outputs,options.blockingOutputDecisions,!!scenes.find(s=>s.id===draft.sourceSceneId)?.blocking);
      if(!resolution.valid)throw Error(resolution.findings.filter(f=>f.severity==='blocking').map(f=>f.message).join(' '));
      scene = {
        ...base,
        slots: clone(activeSlots),
        generation,
        referencePack: clone(draft.conversionProvenance?draft.referencePack:pack),
        sourceMediaLinks: preserveFrozen?clone(draft.sourceMediaLinks):draft.sourceMediaLinks
          ? captureMediaNames(getActiveSourceMediaLinks(draft), mediaMap)
          : undefined,
        avoidText: assembled.avoidText,
        ...(draft.inheritedAvoidPrefix !== undefined
          ? { inheritedAvoidPrefix: getCapturedAvoidPrefix(draft) }
          : {}),
        dialogue: clone(draft.dialogue),
        outputs: resolution.outputs,
        manualOutputs: resolution.manualOutputs,
        ...(preparedFrames&&Object.keys(preparedFrames.images.imagePromptSnapshots).length?{imagePromptSnapshots:clone(preparedFrames.images.imagePromptSnapshots)}:{}),
        ...(preparedFrames&&Object.keys(preparedFrames.images.manualImageOutputs).length?{manualImageOutputs:clone(preparedFrames.images.manualImageOutputs)}:{}),
        references: preserveFrozen?clone(assembled.references):captureMediaNames(assembled.references, mediaMap),
      };
    }
    if(scene.ensemble){scene=prepareEnsembleSource(scene,state.assets,mediaMap,preserveFrozen);const error=validatePhase4Record(scene);if(error)throw Error(error);}
    if(!preserveFrozen)for (const slot of Object.values(scene.slots))
      if (slot) slot.mediaLinks = captureMediaNames(slot.mediaLinks, mediaMap);
    scene.resultMediaLinks = preserveFrozen?clone(scene.resultMediaLinks):captureMediaNames(
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
      collectionUpdate=updated;
      scene.saveProjectTarget = {
        collectionId: collection.id,
        shotId: shot.id,
      };
    }
  if(options.frameImageChoices&&(options.frameImageChoices.draftFrameIds.length||options.frameImageChoices.carryOverEventIds.length)){
    const original=state.collections.find(c=>c.id===scene.saveProjectTarget?.collectionId);
    if(!preparedImages||!preparedFrames||!collectionUpdate||!original)throw Error("Prepare the explicitly selected frame images before saving this storyboard take.");
    collectionUpdate=applyLocalFrameImages(preparedImages,original,collectionUpdate,scene,preparedFrames,mediaMap,()=>generateId("frame_event"),now);
    const error=validateProject(collectionUpdate,[...scenes,scene]);if(error)throw Error(error);
  }
  return {scene,collection:collectionUpdate};
}

/** Browser-owned atomic operation; no external client has direct DB-file access. */
export async function saveAuthoredScene(draftId:string,options:AuthoredSaveOptions):Promise<SavedScene>{
  return saveAuthoredScenePrepared(draftId,options);
}
async function saveAuthoredScenePrepared(draftId:string,options:AuthoredSaveOptions,ownsMediaLease=false):Promise<SavedScene>{
  validateAuthoredSaveOptions(options);
  const snapshot=await getAllSnapshot(),reviewedDraft=snapshot.drafts.find(d=>d.id===draftId);
  if(!reviewedDraft)throw Error('Scene draft not found.');
  const reviewedSource=snapshot.scenes.find(s=>s.id===reviewedDraft.sourceSceneId),retry=snapshot.scenes.some(s=>s.saveRequestId===options.requestId);
  if(!ownsMediaLease&&!isDirectPrompt(reviewedDraft)&&(reviewedDraft.keyframePlan||reviewedSource?.keyframePlan))return withStableLibraryMedia(()=>saveAuthoredScenePrepared(draftId,options,true),true);
  const preparedFrames=!retry&&!isDirectPrompt(reviewedDraft)&&(reviewedDraft.keyframePlan||reviewedSource?.keyframePlan)?await prepareFrameAuthoring(reviewedDraft,reviewedSource,new Map(snapshot.media.map(m=>[m.id,m])),options):undefined;
  const preparedImages=!retry&&preparedFrames&&options.frameImageChoices&&(options.frameImageChoices.draftFrameIds.length||options.frameImageChoices.carryOverEventIds.length)?await prepareLocalFrameImages(reviewedDraft,reviewedSource,snapshot.collections.find(c=>c.id===(options.target??reviewedDraft.authoredProjectTarget)?.collectionId),new Map(snapshot.media.map(m=>[m.id,m])),preparedFrames,options.frameImageChoices):undefined;
  const db=await openDatabase(),tx=db.transaction(['drafts','scenes','assets','media','collections'],'readwrite'),completion=done(tx);
  try{
    const draft=await request<SceneDraft|undefined>(tx.objectStore('drafts').get(draftId));
    if(!draft)throw new Error('Scene draft not found.');
    const {fingerprint}=prepareAuthoredOperation(draft,options);
    const scenes=await request<SavedScene[]>(tx.objectStore('scenes').getAll());
    const retry=scenes.find(s=>s.saveRequestId===options.requestId);
    if(retry){if(retry.authoredSaveFingerprint!==fingerprint)throw new Error('Save request ID was already used for a different operation.');await completion;return retry;}
    const media=await request<MediaAsset[]>(tx.objectStore('media').getAll());
    const collections=await request<Collection[]>(tx.objectStore('collections').getAll());
    const masterId=!isDirectPrompt(draft)?getActiveSceneSlots(draft).character?.sourceId:undefined;
    const master=masterId?await request<PromptAsset|undefined>(tx.objectStore('assets').get(masterId)):undefined;
    const masters=draft.ensemble?await Promise.all([...new Set(draft.ensemble.participants.filter(p=>p.character.sourceType==='asset').map(p=>p.character.sourceId))].map(id=>id===masterId?Promise.resolve(master):request<PromptAsset|undefined>(tx.objectStore('assets').get(id)))):[master];
    const assets=masters.filter((asset):asset is PromptAsset=>!!asset);
    const result=planAuthoredScene(draft,options,{scenes,media,collections,assets},{id:generateId('scene'),now:new Date().toISOString()},preparedFrames,preparedImages);
    if(result.collection)tx.objectStore('collections').put(result.collection);
    tx.objectStore('scenes').add(result.scene);
    await completion;return result.scene;
  }catch(error){try{tx.abort();}catch{}await completion.catch(()=>undefined);throw error;}
}
