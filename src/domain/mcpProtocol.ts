import { parseChangeSet } from './changeSetValidation';
import { SUPPORTED_CHANGE_SET_SCHEMA } from './changeSetSchema';

export const MCP_API_VERSION = 'krakinai.mcp.v1' as const;
export const BRIDGE_VERSION = 'krakinai.bridge.v1' as const;
export const MCP_LIMITS = Object.freeze({ package: 1048576, frame: 1310720, result: 524288, proposals: 8, requests: 16, page: 50, proposalMs: 86400000, approvalMs: 60000, challengeMs: 120000, sessionMs: 3600000, idleMs: 900000, rotateMs: 300000, staleMs: 45000, toolMs: 15000, pollMs: 20000 });
export const MCP_TOOL_NAMES = [
  'krakinai_connection_status', 'krakinai_list_projects', 'krakinai_get_project',
  'krakinai_get_storyboard', 'krakinai_get_scene', 'krakinai_get_scene_history',
  'krakinai_search_assets', 'krakinai_get_shot_types', 'krakinai_preview_change_set',
  'krakinai_submit_change_set', 'krakinai_get_proposal_status',
  'krakinai_get_import_receipt', 'krakinai_get_generation_prompt',
  // Workstream 1: Inbox & Project/Shot Staging
  'krakinai_list_proposals', 'krakinai_discard_proposal',
  'krakinai_stage_project', 'krakinai_stage_shot', 'krakinai_stage_shot_order', 'krakinai_stage_shot_status',
  // Workstream 2: Assets, Variants & Presets
  'krakinai_get_asset', 'krakinai_list_catalog_presets', 'krakinai_stage_asset_candidate', 'krakinai_stage_outfit_variant',
  // Workstream 3: Scene Recipes & Assembly
  'krakinai_stage_scene_recipe', 'krakinai_stage_scene_ensemble', 'krakinai_stage_scene_dialogue',
  'krakinai_stage_camera_composition', 'krakinai_stage_direct_to_recipe', 'krakinai_preview_scene_assembly',
  // Workstream 4: Continuity, Blocking & Keyframes
  'krakinai_get_project_continuity', 'krakinai_check_spatial_continuity',
  'krakinai_stage_scene_blocking', 'krakinai_stage_keyframe_plan', 'krakinai_stage_frame_image',
  // Workstream 5: Saved Scenes
  'krakinai_list_saved_scenes', 'krakinai_export_scene_prompts',
] as const;
export type McpToolName = typeof MCP_TOOL_NAMES[number];
export class McpError extends Error {
  constructor(public readonly code: string, message = 'The request could not be authorized or completed.', public readonly retryable = false) { super(message); this.name = 'McpError'; }
}
export type McpResult = { apiVersion: typeof MCP_API_VERSION; ok: true; data: unknown } | { apiVersion: typeof MCP_API_VERSION; ok: false; error: { code: string; message: string; retryable: boolean } };
export interface McpCommand { requestId: string; tool: McpToolName; args: Record<string, unknown> }
export function resultData(data: unknown): McpResult { const result: McpResult = { apiVersion: MCP_API_VERSION, ok: true, data }; assertByteLimit(JSON.stringify(result), MCP_LIMITS.result); return result; }
export function resultError(error: unknown): McpResult { const e = error instanceof McpError ? error : new McpError('REQUEST_FAILED'); return { apiVersion: MCP_API_VERSION, ok: false, error: { code: e.code, message: e.message, retryable: e.retryable } }; }
export function assertByteLimit(text: string, maximum: number): void { if (new TextEncoder().encode(text).length > maximum) throw new McpError('PAYLOAD_TOO_LARGE', 'This request or result exceeds the local bridge limit. Use a smaller page or manual Stage B export.'); }
export function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new McpError('INVALID_REQUEST');
}
export function exactKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = []): void {
  if (Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(value, k))) throw new McpError('INVALID_REQUEST', 'Unexpected or missing request fields. Approval and permissions belong to the browser.');
}
const idSchema = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$', maxLength: 200 };
const cursorSchema = { type: 'string', minLength: 1, maxLength: 600 };
const imageTargetSchema={type:'object',properties:{kind:{const:'image',type:'string'},keyframeId:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$',maxLength:64},mode:{type:'string',enum:['full','compact']}},required:['kind','keyframeId','mode'],additionalProperties:false};
const frameProjectionSchema={type:'object',properties:{operationId:idSchema,keyframeId:imageTargetSchema.properties.keyframeId,mode:imageTargetSchema.properties.mode},required:['operationId','keyframeId','mode'],additionalProperties:false};
const pageFields = { cursor: cursorSchema, limit: { type: 'integer', minimum: 1, maximum: 50 } };
type ToolSchema = { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
const schema = (properties: Record<string, unknown>, required: string[] = []): ToolSchema => ({ type: 'object', properties, required, additionalProperties: false });
export const MCP_INPUT_SCHEMAS: Record<McpToolName, ToolSchema> = {
  krakinai_connection_status: schema({}), krakinai_list_projects: schema(pageFields),
  krakinai_get_project: schema({ projectId: idSchema }, ['projectId']),
  krakinai_get_storyboard: schema({ projectId: idSchema, ...pageFields,projection:{type:'string',enum:['metadata','keyframes']} }, ['projectId']),
  krakinai_get_scene: schema({ sceneId: idSchema,projection:{type:'string',enum:['metadata','keyframes']} }, ['sceneId']),
  krakinai_get_scene_history: schema({ sceneId: idSchema, ...pageFields }, ['sceneId']),
  krakinai_search_assets: schema({ query: { type: 'string', maxLength: 200 }, category: { type: 'string', enum: ['characters', 'wardrobe', 'actions', 'environments', 'camera', 'lighting', 'styles'] }, kind: { type: 'string', enum: ['asset', 'variant', 'template'] }, ...pageFields }),
  krakinai_get_shot_types: schema({}),
  krakinai_preview_change_set: schema({ changeSet: SUPPORTED_CHANGE_SET_SCHEMA,projection:frameProjectionSchema }, ['changeSet']),
  krakinai_submit_change_set: schema({ changeSet: SUPPORTED_CHANGE_SET_SCHEMA }, ['changeSet']),
  krakinai_get_proposal_status: schema({ proposalId: idSchema,projection:frameProjectionSchema }, ['proposalId']),
  krakinai_get_import_receipt: schema({ changeSetId: idSchema, packageDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['changeSetId', 'packageDigest']),
  krakinai_get_generation_prompt: schema({ sceneId: idSchema,target:imageTargetSchema }, ['sceneId']),

  // Workstream 1: Inbox & Project/Shot Staging
  krakinai_list_proposals: schema(pageFields),
  krakinai_discard_proposal: schema({ proposalId: idSchema }, ['proposalId']),
  krakinai_stage_project: schema({
    changeSetId: idSchema,
    title: { type: 'string', maxLength: 200 },
    projectId: idSchema,
    clientRef: idSchema,
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    planningNotes: { type: 'string', maxLength: 4000 },
    expectedRevision: { type: 'integer', minimum: 0 },
  }, ['changeSetId', 'name']),
  krakinai_stage_shot: schema({
    changeSetId: idSchema,
    project: { type: 'object' },
    shotId: idSchema,
    clientRef: idSchema,
    code: { type: 'string', minLength: 1, maxLength: 30 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    plannedShotType: { type: 'string', maxLength: 100 },
    plannedDurationSeconds: { type: 'number', minimum: 0 },
    continuityNotes: { type: 'string', maxLength: 4000 },
    expectedRevision: { type: 'integer', minimum: 0 },
  }, ['changeSetId', 'project', 'code', 'title']),
  krakinai_stage_shot_order: schema({
    changeSetId: idSchema,
    project: { type: 'object' },
    shots: { type: 'array' },
    expectedRevision: { type: 'integer', minimum: 0 },
  }, ['changeSetId', 'project', 'shots']),
  krakinai_stage_shot_status: schema({
    changeSetId: idSchema,
    project: { type: 'object' },
    shot: { type: 'object' },
    status: { type: 'string', enum: ['draft', 'planned', 'ready', 'generated', 'approved', 'archived'] },
    expectedStatus: { type: 'string', enum: ['draft', 'planned', 'ready', 'generated', 'approved', 'archived'] },
    selectedScene: { type: 'object' },
    expectedSelectedSceneId: idSchema,
  }, ['changeSetId', 'project', 'shot']),

  // Workstream 2: Assets, Variants & Presets
  krakinai_get_asset: schema({ id: idSchema }, ['id']),
  krakinai_list_catalog_presets: schema({
    catalog: { type: 'string', enum: ['cinematography', 'performance', 'shot_types'] },
  }, ['catalog']),
  krakinai_stage_asset_candidate: schema({
    changeSetId: idSchema,
    clientRef: idSchema,
    kind: { type: 'string', enum: ['Characters', 'Wardrobe', 'Actions', 'Environments', 'Camera', 'Lighting', 'Style', 'characters', 'wardrobe', 'actions', 'environments', 'camera', 'lighting', 'styles', 'character', 'action', 'environment', 'style'] },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    promptText: { type: 'string', minLength: 1, maxLength: 4000 },
    description: { type: 'string', maxLength: 2000 },
    tags: { type: 'array' },
    notes: { type: 'string', maxLength: 4000 },
  }, ['changeSetId', 'clientRef', 'kind', 'title', 'promptText']),
  krakinai_stage_outfit_variant: schema({
    changeSetId: idSchema,
    clientRef: idSchema,
    parentCharacterId: idSchema,
    expectedParentRevision: { type: 'integer', minimum: 0 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    promptText: { type: 'string', minLength: 1, maxLength: 4000 },
    description: { type: 'string', maxLength: 2000 },
    tags: { type: 'array' },
    notes: { type: 'string', maxLength: 4000 },
  }, ['changeSetId', 'clientRef', 'parentCharacterId', 'title', 'promptText']),

  // Workstream 3: Scene Recipes & Assembly
  krakinai_stage_scene_recipe: schema({
    changeSetId: idSchema,
    clientRef: idSchema,
    project: { type: 'object' },
    shot: { type: 'object' },
    sceneId: idSchema,
    expectedHeadId: idSchema,
    mode: { type: 'string', enum: ['create', 'revise', 'take'] },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    shotType: { type: 'string', maxLength: 100 },
    settings: { type: 'object' },
    slots: { type: 'object' },
    sceneInstructions: { type: 'string', maxLength: 4000 },
    avoidText: { type: 'string', maxLength: 2000 },
    overrides: { type: 'object' },
    expectedSourceRecipeDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    expectedBlockingDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    expectedSourceRevision: { type: 'integer', minimum: 1 },
  }, ['changeSetId', 'clientRef', 'project', 'shot', 'title']),
  krakinai_stage_scene_ensemble: schema({
    changeSetId: idSchema,
    sceneClientRef: idSchema,
    participants: { type: 'array' },
    primaryParticipantId: idSchema,
    removeParticipantIds: { type: 'array' },
  }, ['changeSetId', 'sceneClientRef', 'participants']),
  krakinai_stage_scene_dialogue: schema({
    changeSetId: idSchema,
    sceneClientRef: idSchema,
    dialogue: { type: 'object' },
    dialogueCues: { type: 'array' },
  }, ['changeSetId', 'sceneClientRef']),
  krakinai_stage_camera_composition: schema({
    changeSetId: idSchema,
    sceneClientRef: idSchema,
    cameraComposition: { type: 'object' },
  }, ['changeSetId', 'sceneClientRef', 'cameraComposition']),
  krakinai_stage_direct_to_recipe: schema({
    changeSetId: idSchema,
    clientRef: idSchema,
    project: { type: 'object' },
    shot: { type: 'object' },
    sceneId: idSchema,
    expectedHeadId: idSchema,
    title: { type: 'string', minLength: 1, maxLength: 200 },
    shotType: { type: 'string', maxLength: 100 },
    settings: { type: 'object' },
    slots: { type: 'object' },
    conversion: { type: 'object' },
    sceneInstructions: { type: 'string', maxLength: 4000 },
    avoidText: { type: 'string', maxLength: 2000 },
    overrides: { type: 'object' },
    expectedSourceRecipeDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    expectedBlockingDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    expectedSourceRevision: { type: 'integer', minimum: 1 },
  }, ['changeSetId', 'clientRef', 'project', 'shot', 'sceneId', 'expectedHeadId', 'title', 'conversion']),
  krakinai_preview_scene_assembly: schema({
    sceneId: idSchema,
    changeSetId: idSchema,
    sceneClientRef: idSchema,
  }),

  // Workstream 4: Continuity, Blocking & Keyframes
  krakinai_get_project_continuity: schema({ projectId: idSchema }, ['projectId']),
  krakinai_check_spatial_continuity: schema({
    projectId: idSchema,
    changeSetId: idSchema,
  }, ['projectId']),
  krakinai_stage_scene_blocking: schema({
    changeSetId: idSchema,
    sceneClientRef: idSchema,
    blocking: { type: 'object' },
    expectedSourceTokens: { type: 'object' },
  }, ['changeSetId', 'sceneClientRef', 'blocking']),
  krakinai_stage_keyframe_plan: schema({
    changeSetId: idSchema,
    sceneClientRef: idSchema,
    keyframePlan: { type: 'object' },
    expectedSourceTokens: { type: 'object' },
  }, ['changeSetId', 'sceneClientRef', 'keyframePlan']),
  krakinai_stage_frame_image: schema({
    changeSetId: idSchema,
    project: { type: 'object' },
    shot: { type: 'object' },
    scene: { type: 'object' },
    frameId: idSchema,
    mediaId: idSchema,
    action: { type: 'string', enum: ['link', 'clear'] },
    expectedAssociationRevision: { type: 'integer', minimum: 0 },
    expectedFrameDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  }, ['changeSetId', 'project', 'shot', 'scene', 'frameId']),

  // Workstream 5: Saved Scenes
  krakinai_list_saved_scenes: schema({
    query: { type: 'string', maxLength: 200 },
    archiveFilter: { type: 'string', enum: ['active', 'archived', 'all'] },
    shotType: { type: 'string', maxLength: 100 },
    reviewStatus: { type: 'string', maxLength: 50 },
    ...pageFields,
  }),
  krakinai_export_scene_prompts: schema({
    sceneIds: { type: 'array' },
  }, ['sceneIds']),
};
export function validateToolArgs(name: McpToolName, value: unknown): Record<string, unknown> {
  if (!MCP_TOOL_NAMES.includes(name)) throw new McpError('UNKNOWN_TOOL');
  record(value); const rule = MCP_INPUT_SCHEMAS[name]; exactKeys(value, Object.keys(rule.properties), rule.required);
  assertByteLimit(JSON.stringify(value), MCP_LIMITS.frame);
  for (const [key, entry] of Object.entries(value)) {
    const field = rule.properties[key] as { type: string; pattern?: string; maxLength?: number; minLength?: number; minimum?: number; maximum?: number; enum?: string[] };
    if (field.type === 'object') { record(entry); continue; }
    if (field.type === 'array') { if (!Array.isArray(entry)) throw new McpError('INVALID_REQUEST'); continue; }
    if (field.type === 'boolean') { if (typeof entry !== 'boolean') throw new McpError('INVALID_REQUEST'); continue; }
    if (field.type === 'integer') { if (!Number.isSafeInteger(entry) || (field.minimum !== undefined && (entry as number) < field.minimum) || (field.maximum !== undefined && (entry as number) > field.maximum)) throw new McpError('INVALID_REQUEST'); }
    else if (field.type === 'number') { if (typeof entry !== 'number' || !Number.isFinite(entry) || (field.minimum !== undefined && entry < field.minimum) || (field.maximum !== undefined && entry > field.maximum)) throw new McpError('INVALID_REQUEST'); }
    else if (typeof entry !== 'string' || entry.length > (field.maxLength ?? Infinity) || entry.length < (field.minLength ?? 0) || (field.pattern && !new RegExp(field.pattern).test(entry)) || (field.enum && !field.enum.includes(entry))) throw new McpError('INVALID_REQUEST');
  }
  if('target'in value){const t=value.target;record(t);exactKeys(t,['kind','keyframeId','mode'],['kind','keyframeId','mode']);if(t.kind!=='image'||typeof t.keyframeId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(t.keyframeId)||!['full','compact'].includes(String(t.mode)))throw new McpError('INVALID_REQUEST');}
  if('projection'in value&&typeof value.projection==='object'){const t=value.projection;record(t);exactKeys(t,['operationId','keyframeId','mode'],['operationId','keyframeId','mode']);if(typeof t.operationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(t.operationId)||typeof t.keyframeId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(t.keyframeId)||!['full','compact'].includes(String(t.mode)))throw new McpError('INVALID_REQUEST');}
  if ('changeSet' in value) {
    assertByteLimit(JSON.stringify(value.changeSet), MCP_LIMITS.package);
    try { parseChangeSet(value.changeSet); } catch { throw new McpError('INVALID_PACKAGE', 'The native Stage B package is invalid. Review its schema in the manual importer.'); }
  }
  return structuredClone(value);
}
function loopbackUrl(value: string): URL {
  let url: URL; try { url = new URL(value); } catch { throw new McpError('INVALID_ADDRESS'); }
  if (url.protocol !== 'http:' || url.username || url.password || value !== url.origin || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new McpError('INVALID_ADDRESS', 'Use the exact loopback origin, including its port, without a path or credentials.');
  return url;
}
export function validateOrigin(value: string): string { return loopbackUrl(value).origin; }
export function validateRelayAddress(value: string): string { const url = loopbackUrl(value); if (url.hostname !== '127.0.0.1' || !url.port) throw new McpError('INVALID_ADDRESS', 'The bridge requires an explicit http://127.0.0.1:port address.'); return url.origin; }
