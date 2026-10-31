import type { ChangeSet, ChangeOperation } from "../types/changeSet";
import {
  CHANGE_SET_SCHEMA,
  CHANGE_SET_V2_SCHEMA,
  type JsonRule,
} from "./changeSetSchema";
import { isRecipeOperation } from "../types/changeSet";
import { validatePerformanceDirection } from "./dialoguePerformance";
import { validateCameraComposition } from "./cameraCompositionValidation";
export const MAX_CHANGE_SET_BYTES = 20 * 1024 * 1024;
export function validateJsonRule(
  rule: JsonRule,
  value: unknown,
  path = "change-set",
): void {
  if (rule.oneOf) {
    const discriminated =
      value && typeof value === "object" && "type" in value
        ? rule.oneOf.find(
            (r) =>
              r.properties?.type?.const === (value as { type: unknown }).type,
          )
        : undefined;
    if (discriminated) {
      validateJsonRule(discriminated, value, path);
      return;
    }
    const errors: string[] = [];
    let matches = 0;
    for (const choice of rule.oneOf)
      try {
        validateJsonRule(choice, value, path);
        matches++;
      } catch (e) {
        errors.push((e as Error).message);
      }
    if (matches !== 1)
      throw Error(
        `Invalid change-set operation/target at ${path}: ${errors.slice(0, 2).join("; ")}`,
      );
    return;
  }
  if ("const" in rule && value !== rule.const)
    throw Error(`Unsupported schema/type/value at ${path}.`);
  if (rule.enum && !rule.enum.includes(value))
    throw Error(`Invalid change-set field ${path}.`);
  const actual =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (
      !types.some(
        (t) =>
          t === actual ||
          (t === "integer" &&
            typeof value === "number" &&
            Number.isSafeInteger(value)),
      )
    )
      throw Error(`Invalid change-set type at ${path}.`);
  }
  if (typeof value === "string") {
    if (
      value.length < (rule.minLength ?? 0) ||
      value.length > (rule.maxLength ?? Infinity)
    )
      throw Error(
        `Change-set length limit ${rule.maxLength ?? "minimum"} at ${path}.`,
      );
    if (
      typeof rule.pattern === "string" &&
      !new RegExp(rule.pattern).test(value)
    )
      throw Error(`Invalid change-set identifier at ${path}.`);
  }
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      value < (rule.minimum ?? -Infinity) ||
      value > (rule.maximum ?? Infinity))
  )
    throw Error(`Invalid change-set numeric limit at ${path}.`);
  if (Array.isArray(value)) {
    if (
      value.length < (rule.minItems ?? 0) ||
      value.length > (rule.maxItems ?? Infinity)
    )
      throw Error(`Change-set operation/array limit at ${path}.`);
    if (rule.items)
      value.forEach((item, i) =>
        validateJsonRule(rule.items!, item, `${path}[${i}]`),
      );
  } else if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of rule.required ?? [])
      if (!Object.hasOwn(object, key))
        throw Error(`Required change-set field ${path}.${key}.`);
    for (const [key, item] of Object.entries(object)) {
      if (
        rule.additionalProperties === false &&
        !Object.hasOwn(rule.properties ?? {}, key)
      )
        throw Error(`Unsupported change-set field ${path}.${key}.`);
      if (rule.properties?.[key])
        validateJsonRule(rule.properties[key], item, `${path}.${key}`);
    }
  }
}
function inspect(value: unknown, depth = 0, path = "change-set"): void {
  if (depth > 32) throw Error("Change-set nesting limit is 32.");
  if (
    typeof value === "string" &&
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      value,
    )
  )
    throw Error(`Malformed Unicode at ${path}.`);
  if (typeof value === "number" && !Number.isFinite(value))
    throw Error("Nonfinite change-set number.");
  if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw Error(`Forbidden change-set key ${key}.`);
      inspect(key, depth + 1, path);
      inspect(item, depth + 1, `${path}.${key}`);
    }
}
const createdKind = (o: ChangeOperation) =>
  o.type === "project.create"
    ? "project"
    : o.type === "shot.create"
      ? "shot"
      : o.type === "asset.propose"
        ? "candidate"
        : o.type.startsWith("scene.")
          ? "scene"
          : undefined;
export function parseChangeSet(input: string | unknown): ChangeSet {
  const raw = typeof input === "string" ? input : JSON.stringify(input);
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > MAX_CHANGE_SET_BYTES
  )
    throw Error("Change-set size exceeds 20 MiB.");
  let value: unknown;
  try {
    value =
      typeof input === "string" ? JSON.parse(input) : structuredClone(input);
  } catch {
    throw Error("Change-set must contain valid JSON.");
  }
  inspect(value);
  validateJsonRule(
    value &&
      typeof value === "object" &&
      "schema" in value &&
      value.schema === "krakinai.change-set.v2"
      ? CHANGE_SET_V2_SCHEMA
      : CHANGE_SET_SCHEMA,
    value,
  );
  const data = value as ChangeSet,
    ids = new Set<string>(),
    refs = new Map<string, { kind: string; index: number }>();
  let projects = 0,
    shots = 0,
    scenes = 0,
    candidates = 0,
    pending = 0;
  data.operations.forEach((operation, index) => {
    if (ids.has(operation.operationId))
      throw Error("Duplicate change-set operation ID.");
    ids.add(operation.operationId);
    if (operation.clientRef) {
      if (refs.has(operation.clientRef))
        throw Error("Duplicate client reference.");
      refs.set(operation.clientRef, { kind: createdKind(operation)!, index });
    }
    projects += Number(operation.type === "project.create");
    shots += Number(operation.type === "shot.create");
    scenes += Number(operation.type.startsWith("scene."));
    candidates += Number(operation.type.startsWith("asset."));
    if ("pendingInputs" in operation)
      pending += operation.pendingInputs?.length ?? 0;
  });
  if (
    projects > 10 ||
    shots > 250 ||
    scenes > 100 ||
    candidates > 50 ||
    pending > 500
  )
    throw Error("Change-set record or pending-input limit exceeded.");
  const targetedProjects = new Set(
    data.operations.flatMap((op) =>
      op.type === "project.create"
        ? ["ref:" + op.clientRef]
        : "project" in op && op.project
          ? [
              "id" in op.project
                ? "id:" + op.project.id
                : "ref:" + op.project.ref,
            ]
          : [],
    ),
  );
  if (targetedProjects.size > 10)
    throw Error("Change-set project limit is 10 distinct targeted projects.");
  const edges: number[][] = data.operations.map(() => []);
  const use = (target: unknown, kind: string, index: number) => {
    if (!target || typeof target !== "object" || !("ref" in target)) return;
    const reference = refs.get((target as { ref: string }).ref);
    if (!reference) throw Error("Unknown client reference.");
    if (
      reference.kind !== kind &&
      !(kind === "asset" && reference.kind === "candidate")
    )
      throw Error("Wrong client reference type.");
    edges[index].push(reference.index);
  };
  data.operations.forEach((o, i) => {
    if (isRecipeOperation(o)) {
      const cleared = o.clearSlots ?? [],
        bound = [...(o.assetRefs ?? []), ...(o.variantRefs ?? [])].map(
          (r) => r.slot,
        );
      if (
        new Set(cleared).size !== cleared.length ||
        cleared.some(
          (slot) =>
            bound.includes(slot) ||
            slot in (o.overrides ?? {}) ||
            (slot === "camera" &&
              o.cameraComposition !== undefined &&
              o.cameraComposition !== null),
        )
      )
        throw Error(
          "Conflicting or duplicate recipe clear/replace instructions.",
        );
      if (
        o.overrides &&
        (!Object.keys(o.overrides).length ||
          Object.values(o.overrides).some((v) => !v || !Object.keys(v).length))
      )
        throw Error("Empty recipe component override.");
      const error =
        validatePerformanceDirection(o.dialogue?.performanceDirection) ??
        (o.cameraComposition === null
          ? undefined
          : validateCameraComposition(o.cameraComposition));
      if (error) throw Error(error);
      if (
        o.type === "scene.revise_recipe" &&
        ![
          "title",
          "shotType",
          "settings",
          "references",
          "sourceMedia",
          "assetRefs",
          "variantRefs",
          "pendingInputs",
          "claimNotes",
          "claims",
          "sceneInstructions",
          "avoidText",
          "clearSlots",
          "overrides",
          "dialogue",
          "cameraComposition",
          "identitySource",
        ].some(
          (k) =>
            k in o &&
            (["assetRefs", "variantRefs", "clearSlots", "settings"].includes(k)
              ? Object.keys((o as unknown as Record<string, object>)[k])
                  .length > 0
              : true),
        )
      )
        throw Error("Recipe revision patch is empty.");
    }
    if ("project" in o) use(o.project, "project", i);
    if ("shot" in o) use(o.shot, "shot", i);
    if ("shots" in o) o.shots.forEach((s) => use(s, "shot", i));
    if ("scene" in o) use(o.scene, "scene", i);
    if ("sourceScene" in o) use(o.sourceScene, "scene", i);
    if ("assetRefs" in o) o.assetRefs?.forEach((a) => use(a.asset, "asset", i));
    if (
      o.type.startsWith("scene.") &&
      Boolean("project" in o && o.project) !== Boolean("shot" in o && o.shot)
    )
      throw Error("Scene operation requires both project and shot targets.");
    for (const field of ["name", "title", "code"])
      if (
        field in o &&
        !String((o as unknown as Record<string, unknown>)[field]).trim()
      )
        throw Error(`A nonblank ${field} is required.`);
    if ("prompt" in o && o.prompt && !o.prompt.text.trim())
      throw Error("A nonblank direct prompt is required.");
    if (
      o.type === "asset.propose" &&
      (!o.promptText.trim() || o.tags.some((t) => !t.trim()))
    )
      throw Error("Invalid candidate prompt/tags.");
    if (
      o.type === "project.update" &&
      o.name === undefined &&
      o.description === undefined &&
      o.planningNotes === undefined
    )
      throw Error("Project metadata update is empty.");
    if (
      o.type === "shot.update" &&
      [
        "code",
        "title",
        "plannedShotType",
        "plannedDurationSeconds",
        "continuityNotes",
      ].every((k) => !(k in o))
    )
      throw Error("Shot metadata update is empty.");
    if ("assetRefs" in o && o.assetRefs) {
      if (new Set(o.assetRefs.map((a) => a.slot)).size !== o.assetRefs.length)
        throw Error("Duplicate asset slot reference.");
      for (const a of o.assetRefs)
        if ("id" in a.asset && a.expectedRevision === undefined)
          throw Error("Existing asset reference requires expectedRevision.");
    }
    if ("variantRefs" in o && o.variantRefs) {
      const slots = [
        ...("assetRefs" in o ? (o.assetRefs ?? []) : []),
        ...o.variantRefs,
      ].map((v) => v.slot);
      if (new Set(slots).size !== slots.length)
        throw Error("Duplicate asset/variant slot reference.");
    }
    if (
      "pendingInputs" in o &&
      o.pendingInputs &&
      new Set(o.pendingInputs.map((p) => p.id)).size !== o.pendingInputs.length
    )
      throw Error("Duplicate pending-input ID.");
  });
  const colors = new Uint8Array(edges.length),
    depths = new Array<number>(edges.length);
  const visit = (index: number): number => {
    if (colors[index] === 1) throw Error("Cyclic change-set dependency.");
    if (colors[index] === 2) return depths[index];
    colors[index] = 1;
    let depth = 0;
    for (const dep of edges[index]) depth = Math.max(depth, visit(dep) + 1);
    if (depth > 16) throw Error("Dependency depth limit 16 exceeded.");
    depths[index] = depth;
    colors[index] = 2;
    return depth;
  };
  edges.forEach((dependencies, i) => {
    visit(i);
    if (dependencies.some((j) => j >= i))
      throw Error(
        "Forward client reference: dependencies must appear before their operation.",
      );
  });
  return data;
}
