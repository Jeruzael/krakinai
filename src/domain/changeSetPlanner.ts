import { requiresStoryboardApproval } from "./changeSetLedger";
import { isRecipeOperation } from "../types/changeSet";
import {
  buildRecipeChangeDraft,
  recipeDraftPreview,
  recipeWarnings,
  finishRecipeScene,
  recipeAdvisories,
} from "./changeSetRecipe";
import { recipeReviewedProjection,ensembleReviewedProjection } from "./changeSetRecipeContent";
import{planOutfitCandidate}from'./changeSetVariants';
import { canonicalStringify } from "./changeSetCanonical";
import { validatePhase4Record } from "./phase4Validation";
import { applyImportedContexts } from "./changeSetReferences";
import type {
  Collection,
  PromptAsset,
  SavedScene,
  SceneDraft,
  Template,
} from "../types/domain";
import type {
  ChangeOperation,
  ChangeSet,
  ChangeSetAllocation,
  ChangeSetApproval,
  ChangeSetPlan,
  ChangeSetState,
  ImportCandidate,
  ImportVariantCandidate,
  ImportMapping,
  ProjectTarget,
  RecordTarget,
} from "../types/changeSet";
import {
  buildRevisionDraft,
  planAuthoredScene,
} from "../storage/sceneAuthoring";
import { getProjectShots, projectMembersFromShots } from "./projectStoryboard";
import { validateProject } from "./phase5ProjectValidation";
import { getRevisionHead } from "./sceneRevisions";
import {
  validateCollectionInput,
  validatePromptAssetInput,
} from "./validation";
import { SimilarSceneError } from "./sceneDuplicates";
import {
  findCandidateMatches,
  CANDIDATE_CATEGORY,
} from "./changeSetCandidates";
import { changeSetStateSignature } from "./changeSetState";
import { getDirectPromptReadiness } from "./directPrompt";
import{conversionReviewFindings,type ConversionSourceProofs}from'./recipeConversion';
const copy = <T>(v: T): T => structuredClone(v);
class PlanningError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(code: string, message: string): never {
  throw new PlanningError(code, message);
}
export function planChangeSet(
  input: ChangeSet,
  approval: ChangeSetApproval,
  initial: ChangeSetState,
  allocation: ChangeSetAllocation,
  conversionProofs:ConversionSourceProofs=new Map(),
): ChangeSetPlan {
  const state: ChangeSetState = {
    ...initial,
    collections: copy(initial.collections),
    scenes: [...initial.scenes],
    assets: [...initial.assets],
    variants:[...(initial.variants??[])],
    templates: [...initial.templates],
  };
  const mappings: Record<string, ImportMapping> = {},
    dirtyProjects = new Set<string>(),
    newSceneIds = new Set<string>(),
    newAssetIds = new Set<string>(),
    newTemplateIds = new Set<string>(),newVariantIds=new Set<string>();
  const initialRevisions = new Map(
    initial.collections.map((c) => [c.id, c.project?.revision ?? 0]),
  );
  const candidates = copy(initial.preferences.aiImports?.candidates ?? []),
    changedCandidates = new Set<string>(),
    duplicateScenes = new Set<string>();
  const variantCandidates=copy(initial.preferences.aiImports?.variantCandidates??[]),changedVariantCandidates=new Set<string>();
  const plan: ChangeSetPlan = {
    findings: [],
    operations: [],
    idMappings: mappings,
    results: [],
    collections: [],
    scenes: [],
    assets: [],
    templates: [],
    candidates: [],
    projectRevisions: {},
    stateSignature: "",
    summary: {
      projects: 0,
      shots: 0,
      scenes: 0,
      candidates: 0,
      pendingInputs: 0,
      plannedSeconds: 0,
    },
  };
  const finding = (
    operationId: string | undefined,
    code: string,
    message: string,
    severity: "blocking" | "advisory" = "blocking",
  ) => plan.findings.push({ operationId, code, message, severity });
  const resolve = (
    target: RecordTarget,
    kind: ImportMapping["kind"],
  ): string => {
    if ("id" in target) return target.id;
    const mapped = mappings[target.ref];
    if (!mapped || mapped.kind !== kind)
      fail(
        "DEPENDENCY_BLOCKED",
        `Reference ${target.ref} has no approved ${kind} result.`,
      );
    return mapped.id;
  };
  const project = (target: ProjectTarget): Collection => {
    const id = resolve(target, "project"),
      c = state.collections.find((c) => c.id === id);
    if (!c)
      fail(
        "PROJECT_MISSING",
        `Project ${id} is unavailable; use an exact existing ID or create a project.`,
      );
    if ("id" in target && initialRevisions.get(id) !== target.expectedRevision)
      fail(
        "PROJECT_STALE",
        `Project ${id} revision changed; export context and preview again.`,
      );
    if (!c.project)
      c.project = {
        version: 1,
        revision: initialRevisions.get(id) ?? 0,
        shots: copy(getProjectShots(c, state.scenes)),
      };
    else c.project.shots = [...getProjectShots(c, state.scenes)];
    return c;
  };
  const shot = (c: Collection, t: RecordTarget) => {
    const id = resolve(t, "shot"),
      s = c.project!.shots.find((s) => s.id === id);
    if (!s)
      fail("SHOT_TARGET", `Shot ${id} does not belong to project ${c.id}.`);
    return s;
  };
  const bind = (
    op: ChangeOperation,
    kind: ImportMapping["kind"],
    id: string,
    assetId?: string,
  ) => {
    if (op.clientRef)
      mappings[op.clientRef] = { kind, id, ...(assetId ? { assetId } : {}) };
  };
  const mutation = (c: Collection) => {
    dirtyProjects.add(c.id);
    c.updatedAt = allocation.preparedAt;
    c.members = projectMembersFromShots(c, c.project!.shots);
  };
  const record = (
    operation: ChangeOperation,
    recordId: string | undefined,
    status: ChangeSetPlan["results"][number]["status"],
  ) =>
    plan.results.push({
      operationId: operation.operationId,
      type: operation.type,
      recordId,
      status,
    });
  const mediaMap = new Map(initial.media.map((m) => [m.id, m]));
  for (const op of input.operations) {
    const row: ChangeSetPlan["operations"][number] = {
      operationId: op.operationId,
      type: op.type,
      summary: op.type,
      details: copy(op),
    };
    plan.operations.push(row);
    try {
      if('sceneId'in op&&!['krakinai.change-set.v3','krakinai.change-set.v4'].includes(input.schema)&&state.scenes.some(s=>s.id===op.sceneId&&s.ensemble))fail('ENSEMBLE_VERSION','This parent contains ensemble participants. Use change-set v3 or v4 to reconstruct it; the old scene is unchanged.');
      if (requiresStoryboardApproval(op) && !approval.storyboard)
        finding(
          op.operationId,
          "APPROVAL_STORYBOARD",
          "Explicit storyboard approval is required.",
        );
      if (op.type.startsWith("scene.") && !approval.scenes)
        finding(
          op.operationId,
          "APPROVAL_SCENES",
          "Explicit approval to save new immutable scenes is required.",
        );
      if (op.type === "project.create") {
        const valid = validateCollectionInput(op);
        if (!valid.valid)
          fail("PROJECT_FIELDS", Object.values(valid.errors).join(" "));
        const id = allocation.ids[op.operationId];
        if (state.collections.some((c) => c.id === id))
          fail("ID_COLLISION", "Allocated project ID already exists.");
        const c: Collection = {
          id,
          name: op.name.trim(),
          description: op.description ?? "",
          ...(op.planningNotes !== undefined
            ? { planningNotes: op.planningNotes }
            : {}),
          members: [],
          project: { version: 1, revision: 0, shots: [] },
          createdAt: allocation.preparedAt,
          updatedAt: allocation.preparedAt,
        };
        if (
          initial.collections.some(
            (c) =>
              c.name.normalize("NFKC").toLowerCase() ===
              op.name.normalize("NFKC").toLowerCase(),
          )
        )
          finding(
            op.operationId,
            "PROJECT_NAME",
            "A project with this name exists; this operation creates a separate project.",
            "advisory",
          );
        state.collections.push(c);
        bind(op, "project", id);
        dirtyProjects.add(id);
        row.projectId = id;
        row.summary = `Create project: ${c.name}`;
        plan.summary.projects++;
        record(op, id, "created");
      } else if (op.type === "project.update") {
        const c = project(op.project),
          valid = validateCollectionInput({
            name: op.name ?? c.name,
            description: op.description ?? c.description,
          });
        if (!valid.valid)
          fail("PROJECT_FIELDS", Object.values(valid.errors).join(" "));
        if (op.name !== undefined) c.name = op.name.trim();
        if (op.description !== undefined) c.description = op.description;
        if (op.planningNotes !== undefined) c.planningNotes = op.planningNotes;
        mutation(c);
        row.projectId = c.id;
        row.summary = `Update project metadata: ${c.name}`;
        record(op, c.id, "updated");
      } else if (op.type === "shot.create") {
        const c = project(op.project);
        if (c.project!.shots.some((s) => s.code === op.code))
          fail(
            "SHOT_CODE",
            "Duplicate/conflicting shot code. Choose an explicit unique code.",
          );
        const id = allocation.ids[op.operationId];
        if (
          state.collections.some((p) =>
            p.project?.shots.some((s) => s.id === id),
          )
        )
          fail("ID_COLLISION", "Allocated shot ID already exists.");
        c.project!.shots.push({
          id,
          order: c.project!.shots.length,
          code: op.code,
          title: op.title,
          takeSceneIds: [],
          status: "planned",
          ...(op.plannedShotType
            ? { plannedShotType: op.plannedShotType }
            : {}),
          ...(op.plannedDurationSeconds !== undefined
            ? { plannedDurationSeconds: op.plannedDurationSeconds }
            : {}),
          ...(op.continuityNotes !== undefined
            ? { continuityNotes: op.continuityNotes }
            : {}),
        });
        mutation(c);
        bind(op, "shot", id);
        row.projectId = c.id;
        row.shotId = id;
        row.summary = `Create planned shot ${op.code}: ${op.title}`;
        plan.summary.shots++;
        record(op, id, "created");
      } else if (op.type === "shot.update") {
        const c = project(op.project),
          s = shot(c, op.shot);
        if (
          op.code !== undefined &&
          c.project!.shots.some((x) => x.id !== s.id && x.code === op.code)
        )
          fail("SHOT_CODE", "Duplicate/conflicting shot code.");
        for (const key of [
          "code",
          "title",
          "plannedShotType",
          "plannedDurationSeconds",
          "continuityNotes",
        ] as const)
          if (op[key] !== undefined) Object.assign(s, { [key]: op[key] });
        mutation(c);
        row.projectId = c.id;
        row.shotId = s.id;
        row.summary = `Update metadata for shot ${s.code}`;
        record(op, s.id, "updated");
      } else if (op.type === "shot.reorder") {
        const c = project(op.project),
          ids = op.shots.map((t) => resolve(t, "shot"));
        if (
          ids.length !== c.project!.shots.length ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !c.project!.shots.some((s) => s.id === id))
        )
          fail(
            "SHOT_ORDER",
            "Explicit reorder must contain every current shot exactly once.",
          );
        c.project!.shots = ids.map((id, order) => ({
          ...c.project!.shots.find((s) => s.id === id)!,
          order,
        }));
        mutation(c);
        row.projectId = c.id;
        row.summary = "Explicitly reorder complete storyboard";
        record(op, c.id, "updated");
      } else if (
        op.type === "asset.propose" ||
        op.type === "asset.review_candidate"
      ) {
        let candidate: ImportCandidate;
        if (op.type === "asset.propose") {
          candidate = {
            id: allocation.ids[op.operationId],
            revision: 1,
            kind: op.kind,
            title: op.title,
            promptText: op.promptText,
            description: op.description ?? "",
            tags: copy(op.tags),
            notes: op.notes ?? "",
            source: copy(input.source),
            changeSetId: input.changeSetId,
            operationId: op.operationId,
            status: "pending",
            createdAt: allocation.preparedAt,
            updatedAt: allocation.preparedAt,
            ...(op.sourceScene
              ? { sourceSceneId: resolve(op.sourceScene, "scene") }
              : {}),
          };
          if (
            candidate.sourceSceneId &&
            !state.scenes.some((s) => s.id === candidate.sourceSceneId)
          )
            fail("SCENE_MISSING", "Candidate source scene is unavailable.");
          if (candidates.some((c) => c.id === candidate.id))
            fail("ID_COLLISION", "Allocated candidate ID already exists.");
          candidates.push(candidate);
          plan.summary.candidates++;
        } else {
          const existing = candidates.find((c) => c.id === op.candidateId);
          if (
            !existing ||
            existing.revision !== op.expectedRevision ||
            existing.status !== "pending"
          )
            fail(
              "CANDIDATE_STALE",
              "Candidate is missing, already resolved, or changed; preview its current state.",
            );
          candidate = existing;
        }
        changedCandidates.add(candidate.id);
        const matches = findCandidateMatches(candidate, state),
          decision = approval.assetDecisions[op.operationId] ?? {
            action: "defer",
          };
        row.matches = matches;
        row.proposedPrompt = candidate.promptText;
        const proposedCandidate = copy(candidate);
        row.resolved = {
          candidate: proposedCandidate,
          decision: copy(decision),
        };
        row.summary = `${candidate.kind} candidate: ${candidate.title}`;
        if (matches.length)
          finding(
            op.operationId,
            "CANDIDATE_MATCH",
            `${matches.length} possible existing asset match(es); review before creating.`,
            "advisory",
          );
        let assetId: string | undefined;
        if (decision.action === "create") {
          if (matches.length && !decision.acknowledgeDuplicate)
            fail(
              "DUPLICATE_ASSET",
              "Possible duplicate asset: reuse an exact match or explicitly acknowledge separate unreviewed creation.",
            );
          assetId =
            (candidate.kind === "template" ? "template_" : "asset_") +
            allocation.ids[op.operationId];
          if (
            state.assets.some((a) => a.id === assetId) ||
            state.templates.some((a) => a.id === assetId)
          )
            fail("ID_COLLISION", "Allocated asset ID already exists.");
          if (candidate.kind === "template") {
            const t: Template = {
              id: assetId,
              name: candidate.title,
              description: candidate.description,
              category: "Custom",
              requiredSlots: [],
              defaults: {},
              sceneInstructionsDefault: candidate.promptText,
              isStarter: false,
              revision: 1,
              createdAt: allocation.preparedAt,
              updatedAt: allocation.preparedAt,
            };
            state.templates.push(t);
            newTemplateIds.add(t.id);
          } else {
            const category = CANDIDATE_CATEGORY[candidate.kind],
              valid = validatePromptAssetInput({ ...candidate, category });
            if (!valid.valid)
              fail("ASSET_FIELDS", Object.values(valid.errors).join(" "));
            const a: PromptAsset = {
              id: assetId,
              title: candidate.title.trim(),
              category,
              description: candidate.description,
              promptText: candidate.promptText,
              tags: copy(candidate.tags),
              notes: candidate.notes,
              mediaLinks: [],
              favorite: false,
              reviewStatus: "unreviewed",
              provenance: {
                toolName: `Change-set proposal (${candidate.source.kind})`,
              },
              revision: 1,
              ...(category === "characters" ? { identityRevision: 1 } : {}),
              createdAt: allocation.preparedAt,
              updatedAt: allocation.preparedAt,
            };
            state.assets.push(a);
            newAssetIds.add(a.id);
          }
          candidate.status = "created";
          candidate.assetId = assetId;
          candidate.revision++;
          candidate.updatedAt = allocation.preparedAt;
        } else if (decision.action === "reuse") {
          const existing =
            candidate.kind === "template"
              ? state.templates.find((t) => t.id === decision.assetId)
              : state.assets.find(
                  (a) =>
                    a.id === decision.assetId &&
                    a.category ===
                      CANDIDATE_CATEGORY[
                        candidate.kind as Exclude<
                          typeof candidate.kind,
                          "template"
                        >
                      ],
                );
          if (!existing || existing.revision !== decision.expectedRevision)
            fail(
              "ASSET_STALE",
              "Choose an exact current asset ID and revision of the correct category.",
            );
          assetId = existing.id;
          candidate.status = "reused";
          candidate.assetId = assetId;
          candidate.revision++;
          candidate.updatedAt = allocation.preparedAt;
        }
        row.resolved = {
          candidate: copy(
            (row.resolved as { candidate: ImportCandidate }).candidate,
          ),
          decision: copy(decision),
          outcome: {
            status: candidate.status,
            assetId,
            record: assetId
              ? copy(
                  candidate.kind === "template"
                    ? state.templates.find((t) => t.id === assetId)
                    : state.assets.find((a) => a.id === assetId),
                )
              : undefined,
          },
        };
        bind(op, "candidate", candidate.id, assetId);
        record(
          op,
          candidate.id,
          candidate.status === "pending"
            ? "candidate_pending"
            : candidate.status === "created"
              ? "asset_created"
              : "asset_reused",
        );
      } else if(op.type==='variant.propose'||op.type==='variant.review_candidate'){
        const outcome=planOutfitCandidate(op,input,approval,state,initial.assets,allocation,variantCandidates,target=>resolve(target,'scene'));
        const index=variantCandidates.findIndex(c=>c.id===outcome.candidate.id);if(index<0)variantCandidates.push(outcome.candidate);else variantCandidates[index]=outcome.candidate;
        changedVariantCandidates.add(outcome.candidate.id);
        if(outcome.variant){state.variants!.push(outcome.variant);newVariantIds.add(outcome.variant.id)}
        if(op.type==='variant.propose')plan.summary.candidates++;
        row.summary=`Outfit candidate: ${outcome.candidate.title}`;row.matches=outcome.matches;row.proposedPrompt=outcome.candidate.promptText;
        row.resolved={variantCandidate:outcome.proposed,decision:outcome.decision,outcome:{status:outcome.candidate.status,variantId:outcome.variantId,record:outcome.variantId?copy(state.variants!.find(v=>v.id===outcome.variantId)):undefined}};
        if(outcome.matches.length)finding(op.operationId,'CANDIDATE_MATCH',`${outcome.matches.length} possible same-parent Outfit match(es); review before creating.`,'advisory');
        if(op.clientRef)mappings[op.clientRef]={kind:'variant_candidate',id:outcome.candidate.id,...(outcome.variantId?{variantId:outcome.variantId}:{})};
        record(op,outcome.candidate.id,outcome.status);
      } else if (isRecipeOperation(op)) {
        const c = project(op.project),
          s = shot(c, op.shot),
          parent =
            "sceneId" in op
              ? state.scenes.find((scene) => scene.id === op.sceneId)
              : undefined;
        const target = {
          collectionId: c.id,
          shotId: s.id,
          expectedProjectRevision: c.project!.revision,
        };
        row.projectId = c.id;
        row.shotId = s.id;
        row.currentPrompt = parent?.outputs.full;
        row.summary = `${op.type === 'scene.convert_direct_to_recipe'?'Direct Prompt → recipe alternate take':op.type === "scene.create_recipe" ? "New recipe" : op.type === "scene.revise_recipe" ? "New recipe revision" : "Alternate recipe take"}: ${op.title ?? parent?.title ?? op.clientRef}`;
        const draft = buildRecipeChangeDraft(
          op,
          state,
          allocation,
          target,
          (target) => {
            if ("id" in target) return target.id;
            const mapped = mappings[target.ref];
            if (!mapped?.assetId)
              fail(
                "DEPENDENCY_BLOCKED",
                "A recipe depends on a deferred asset candidate. Approve creation/reuse or remove that binding. Download this package to complete it later.",
              );
            return mapped.assetId;
          },
          target=>{if('id'in target)return target.id;const mapped=mappings[target.ref];if(mapped?.kind!=='variant_candidate'||!mapped.variantId)fail('DEPENDENCY_BLOCKED','A recipe depends on a deferred Outfit candidate. Approve creation/reuse or remove that binding. Download this package to complete it later.');return mapped.variantId;},
          conversionProofs,
        );
        const resolved = recipeDraftPreview(draft, parent);
        row.resolved = { recipe: resolved };
        const conversionFindings=op.type==='scene.convert_direct_to_recipe'?conversionReviewFindings(op,approval,parent!,draft):[];
        plan.findings.push(...conversionFindings);
        const advice = recipeAdvisories(op.operationId, draft, state);
        plan.findings.push(...advice);
        const manualConsent =
          op.type!=='scene.convert_direct_to_recipe'&&resolved.manualOutputsDiscarded &&
          !approval.discardManualOutputOperations?.includes(op.operationId);
        if (manualConsent)
          finding(
            op.operationId,
            "RECIPE_MANUAL_OUTPUTS",
            "The parent has manual output overrides. Explicitly acknowledge discarding them and reassembling all three outputs before applying.",
          );
        const result = planAuthoredScene(
          draft,
          {
            requestId: `import:${input.changeSetId}:${op.operationId}`,
            expectedInputRevision: 1,
            target,
            allowDuplicate: approval.allowDuplicateSceneOperations.includes(
              op.operationId,
            ),
          },
          state,
          { id: allocation.ids[op.operationId], now: allocation.preparedAt },
        );
        finishRecipeScene(result.scene, input);
        if(op.type==='scene.convert_direct_to_recipe')Object.assign(result.scene,{saveDecision:'take',separateTakeOfSceneId:op.sceneId});
        const error = validatePhase4Record(result.scene);
        if (error) throw Error(error);
        if (state.scenes.some((s) => s.id === result.scene.id))
          fail("ID_COLLISION", "Allocated scene ID already exists.");
        const warnings = recipeWarnings(draft);
        if(result.scene.ensemble){for(const p of result.scene.ensemble.participants)if(p.generation?.fallbackReason)finding(op.operationId,'GENERATION_IDENTITY_REVIEW',`${p.character.sourceTitle}: ${p.generation.fallbackReason}`,'advisory');}
        else if (result.scene.generation?.fallbackReason)
          finding(
            op.operationId,
            "GENERATION_IDENTITY_REVIEW",
            result.scene.generation.fallbackReason,
            "advisory",
          );
        for (const message of warnings)
          finding(
            op.operationId,
            "RECIPE_GENERATION_PENDING",
            message,
            "advisory",
          );
        Object.assign(resolved, {
          readiness: manualConsent||conversionFindings.length
            ? "blocked"
            : warnings.length ||
                advice.some((f) => f.code === "RECIPE_PREFLIGHT_P008")
              ? "assembled_pending"
              : "ready",
          outputs: copy(result.scene.outputs),
          generation: copy(result.scene.generation),
          referencePack: copy(result.scene.referencePack),
        });
        row.proposedPrompt = result.scene.outputs.full;
        state.scenes.push(result.scene);
        newSceneIds.add(result.scene.id);
        bind(op, "scene", result.scene.id);
        record(op, result.scene.id, "created");
        if (result.collection) {
          state.collections[
            state.collections.findIndex((c) => c.id === result.collection!.id)
          ] = result.collection;
          mutation(result.collection);
        }
        plan.summary.scenes++;
        plan.summary.pendingInputs += result.scene.pendingInputs?.length ?? 0;
      } else if (op.type.startsWith("scene.")) {
        const operation = op as Extract<
          ChangeOperation,
          {
            type:
              | "scene.create_direct_prompt"
              | "scene.revise"
              | "scene.create_take"
              | "scene.restore";
          }
        >;
        const c = operation.project ? project(operation.project) : undefined,
          s = c && operation.shot ? shot(c, operation.shot) : undefined;
        const target =
          c && s
            ? {
                collectionId: c.id,
                shotId: s.id,
                expectedProjectRevision: c.project!.revision,
              }
            : undefined;
        let draft: SceneDraft;
        if (operation.type === "scene.create_direct_prompt") {
          draft = {
            id: `draft_${allocation.ids[op.operationId]}`,
            title: operation.title,
            slots: {},
            extraRequiredSlots: [],
            sceneInstructions: "",
            settings: {},
            manualOutputs: {},
            resultMediaLinks: [],
            reviewNotes: "",
            reviewStatus: "unreviewed",
            inputRevision: 1,
            updatedAt: allocation.preparedAt,
            authoringMode: "direct_prompt",
            directPrompt: copy(operation.prompt),
          };
        } else {
          const parent = state.scenes.find((s) => s.id === operation.sceneId);
          if (!parent)
            fail("SCENE_MISSING", "Explicit source scene is unavailable.");
          if (
            getRevisionHead(parent, state.scenes).id !==
            operation.expectedHeadId
          )
            fail(
              "SCENE_HEAD_STALE",
              "Scene revision head changed; export context and preview again.",
            );
          const content =
            operation.type === "scene.restore"
              ? state.scenes.find((s) => s.id === operation.restoreFromSceneId)
              : parent;
          row.currentPrompt = parent.outputs.full;
          row.proposedPrompt =
            operation.type === "scene.restore"
              ? content?.outputs.full
              : operation.prompt?.text;
          draft = {
            ...buildRevisionDraft(parent.id, state, {
              asDirect: operation.type !== "scene.restore",
              restoreFromSceneId: operation.restoreFromSceneId,
              alternateTake: operation.type === "scene.create_take",
              target,
            }),
            id: `draft_${allocation.ids[op.operationId]}`,
            inputRevision: 1,
            updatedAt: allocation.preparedAt,
          };
          if (operation.reason && draft.revisionIntent)
            draft.revisionIntent.reason = operation.reason;
        }
        if (operation.type !== "scene.restore") {
          if (operation.title !== undefined) draft.title = operation.title;
          draft.authoringMode = "direct_prompt";
          draft.directPrompt = {
            ...copy(operation.prompt!),
            origin: operation.prompt?.origin ?? input.source.kind,
            originLabel: operation.prompt?.originLabel ?? input.source.label,
            importedAt: allocation.preparedAt,
          };
          draft.manualOutputs = {};
          if (operation.shotType) draft.shotType = operation.shotType;
          else if (!draft.shotType && s?.plannedShotType)
            draft.shotType = s.plannedShotType;
          if (operation.settings) draft.settings = copy(operation.settings);
          if (operation.pendingInputs)
            draft.pendingInputs = copy(operation.pendingInputs);
          if (operation.claimNotes !== undefined)
            draft.claimNotes = operation.claimNotes;
          if (operation.claims?.length)
            draft.claimNotes = [
              draft.claimNotes ?? "",
              ...operation.claims.map((c) => `UNVERIFIED ${c.kind}: ${c.text}`),
            ]
              .filter(Boolean)
              .join("\n");
          if (operation.references)
            draft.directReferences = operation.references.map((l, order) => ({
              ...l,
              role: l.role ?? "reference",
              altText: l.altText ?? "",
              order,
            }));
          if (operation.sourceMedia)
            draft.sourceMediaLinks = operation.sourceMedia.map((l, order) => ({
              ...l,
              role: "reference",
              altText: l.altText ?? "",
              order,
            }));
          applyImportedContexts(draft, operation, state, (target) => {
            if ("id" in target) return target.id;
            const mapped = mappings[target.ref];
            if (!mapped?.assetId)
              fail(
                "DEPENDENCY_BLOCKED",
                "A scene depends on a deferred asset candidate. Approve creation/reuse or remove that dependency.",
              );
            return mapped.assetId;
          });
        }
        const options = {
          requestId: `import:${input.changeSetId}:${op.operationId}`,
          expectedInputRevision: 1,
          target,
          allowDuplicate: approval.allowDuplicateSceneOperations.includes(
            op.operationId,
          ),
        };
        const result = planAuthoredScene(draft, options, state, {
          id: allocation.ids[op.operationId],
          now: allocation.preparedAt,
        });
        // Batch provenance and retries live in the receipt; no fictitious stored draft is claimed.
        delete result.scene.sourceDraftId;
        delete result.scene.sourceDraftInputRevision;
        delete result.scene.saveRequestId;
        delete result.scene.authoredSaveFingerprint;
        if (state.scenes.some((s) => s.id === result.scene.id))
          fail("ID_COLLISION", "Allocated scene ID already exists.");
        state.scenes.push(result.scene);
        newSceneIds.add(result.scene.id);
        bind(op, "scene", result.scene.id);
        record(op, result.scene.id, "created");
        if (result.collection) {
          const idx = state.collections.findIndex(
            (c) => c.id === result.collection!.id,
          );
          state.collections[idx] = result.collection;
          mutation(result.collection);
          row.projectId = result.collection.id;
          row.shotId = s?.id;
        }
        row.resolved = {
          settings: result.scene.settings,
          shotType: result.scene.shotType,
          sourceContextSnapshots: result.scene.slots,
          references: result.scene.references,
          referencePack: result.scene.referencePack,
          sourceMediaLinks: result.scene.sourceMediaLinks,
          pendingInputs: result.scene.pendingInputs,
          claimNotes: result.scene.claimNotes,
          generation: result.scene.generation,
        };
        if (result.scene.generation?.fallbackReason)
          finding(
            op.operationId,
            "GENERATION_IDENTITY_REVIEW",
            `Generation identity falls back to the master prompt: ${result.scene.generation.fallbackReason}. Review the resolved generation metadata.`,
            "advisory",
          );
        row.proposedPrompt = result.scene.outputs.full;
        row.summary = `${operation.type === "scene.restore" ? "Restore as new version" : operation.type === "scene.revise" ? "New immutable version" : operation.type === "scene.create_take" ? "Alternate take" : "New Direct Prompt"}: ${result.scene.title}`;
        plan.summary.scenes++;
        plan.summary.pendingInputs += result.scene.pendingInputs?.length ?? 0;
        if (result.scene.authoringMode === "direct_prompt")
          for (const issue of getDirectPromptReadiness(result.scene, mediaMap))
            finding(op.operationId, "GENERATION_PENDING", issue, "advisory");
      } else if (
        op.type === "shot.attach_take" ||
        op.type === "shot.select_take" ||
        op.type === "shot.set_status"
      ) {
        const c = project(op.project),
          s = shot(c, op.shot);
        row.projectId = c.id;
        row.shotId = s.id;
        if (op.type === "shot.set_status") {
          if (!approval.statuses)
            finding(
              op.operationId,
              "APPROVAL_STATUS",
              "Explicit production-status approval is required.",
            );
          if (s.status !== op.expectedStatus)
            fail(
              "STATUS_STALE",
              "Production status changed since preparation.",
            );
          s.status = op.status;
          row.summary = `Set shot ${s.code} status: ${op.status}`;
        } else {
          const id = resolve(op.scene, "scene");
          if (!state.scenes.some((scene) => scene.id === id))
            fail("SCENE_MISSING", "Explicit saved take is unavailable.");
          if (op.type === "shot.attach_take") {
            if (!s.takeSceneIds.includes(id)) s.takeSceneIds.push(id);
            row.summary = `Attach existing take to shot ${s.code}`;
          } else {
            if (!approval.preferred)
              finding(
                op.operationId,
                "APPROVAL_PREFERRED",
                "Explicit preferred-take approval is required.",
              );
            if ((s.selectedSceneId ?? null) !== op.expectedSelectedSceneId)
              fail(
                "PREFERRED_STALE",
                "Preferred take changed since preparation.",
              );
            if (!s.takeSceneIds.includes(id))
              fail(
                "TAKE_TARGET",
                "Preferred scene must already belong to the explicit shot.",
              );
            s.selectedSceneId = id;
            row.summary = `Explicitly select preferred take for shot ${s.code}`;
          }
        }
        mutation(c);
        record(op, s.id, "updated");
      }
    } catch (error) {
      if (error instanceof SimilarSceneError) {
        error.matches.forEach((s) => duplicateScenes.add(s.id));
        finding(
          op.operationId,
          "DUPLICATE_SCENE",
          "An identical saved scene exists. Explicitly acknowledge separate scene creation or reuse the existing take.",
        );
      } else
        finding(
          op.operationId,
          error instanceof PlanningError ? error.code : "DOMAIN_RULE",
          (error as Error).message,
        );
    }
  }
  for (const id of dirtyProjects) {
    const c = state.collections.find((c) => c.id === id)!;
    c.project!.revision = (initialRevisions.get(id) ?? 0) + 1;
    c.project!.shots.forEach((s, order) => (s.order = order));
    c.members = projectMembersFromShots(c, c.project!.shots);
    const error = validateProject(c, state.scenes, true, {
      assets: state.assets,
      variants: state.variants ?? [],
      media: state.media,
      allowMissingCastSources: true,
    });
    if (error) finding(undefined, "PROJECT_VALIDATION", error);
    plan.projectRevisions[id] = {
      before: initialRevisions.get(id) ?? 0,
      after: c.project!.revision,
    };
    plan.summary.plannedSeconds += c.project!.shots.reduce(
      (n, s) => n + (s.plannedDurationSeconds ?? 0),
      0,
    );
  }
  plan.collections = state.collections.filter((c) => dirtyProjects.has(c.id));
  plan.scenes = state.scenes.filter((s) => newSceneIds.has(s.id));
  plan.assets = state.assets.filter((a) => newAssetIds.has(a.id));
  plan.templates = state.templates.filter((t) => newTemplateIds.has(t.id));
  if(newVariantIds.size)plan.variants=state.variants!.filter(v=>newVariantIds.has(v.id));
  if(changedVariantCandidates.size)plan.variantCandidates=variantCandidates.filter(c=>changedVariantCandidates.has(c.id));
  plan.candidates = candidates.filter((c) => changedCandidates.has(c.id));
  plan.stateSignature = changeSetStateSignature(input, approval, initial, [
    ...duplicateScenes,
  ]);
  if(input.schema==='krakinai.change-set.v4')plan.stateSignature=canonicalStringify({state:plan.stateSignature,v4Review:ensembleReviewedProjection(plan)});
  else if(input.schema==='krakinai.change-set.v3')plan.stateSignature=canonicalStringify({state:plan.stateSignature,v3Review:ensembleReviewedProjection(plan)});
  else if (
    input.schema === "krakinai.change-set.v2" &&
    input.operations.some(isRecipeOperation)
  )
    plan.stateSignature = canonicalStringify({
      state: plan.stateSignature,
      recipes: recipeReviewedProjection(plan),
    });
  return plan;
}
