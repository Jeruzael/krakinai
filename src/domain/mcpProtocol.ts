import { parseChangeSet } from './changeSetValidation';
import { SUPPORTED_CHANGE_SET_SCHEMA } from './changeSetSchema';

export const MCP_API_VERSION = 'krakinai.mcp.v1' as const;
export const BRIDGE_VERSION = 'krakinai.bridge.v1' as const;
export const MCP_LIMITS = Object.freeze({ package: 1048576, frame: 1310720, result: 524288, proposals: 8, requests: 16, page: 50, proposalMs: 600000, approvalMs: 60000, challengeMs: 120000, sessionMs: 3600000, idleMs: 900000, rotateMs: 300000, staleMs: 45000, toolMs: 15000, pollMs: 20000 });
export const MCP_TOOL_NAMES = [
  'krakinai_connection_status', 'krakinai_list_projects', 'krakinai_get_project',
  'krakinai_get_storyboard', 'krakinai_get_scene', 'krakinai_get_scene_history',
  'krakinai_search_assets', 'krakinai_get_shot_types', 'krakinai_preview_change_set',
  'krakinai_submit_change_set', 'krakinai_get_proposal_status',
  'krakinai_get_import_receipt', 'krakinai_get_generation_prompt',
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
const pageFields = { cursor: cursorSchema, limit: { type: 'integer', minimum: 1, maximum: 50 } };
type ToolSchema = { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
const schema = (properties: Record<string, unknown>, required: string[] = []): ToolSchema => ({ type: 'object', properties, required, additionalProperties: false });
export const MCP_INPUT_SCHEMAS: Record<McpToolName, ToolSchema> = {
  krakinai_connection_status: schema({}), krakinai_list_projects: schema(pageFields),
  krakinai_get_project: schema({ projectId: idSchema }, ['projectId']),
  krakinai_get_storyboard: schema({ projectId: idSchema, ...pageFields }, ['projectId']),
  krakinai_get_scene: schema({ sceneId: idSchema }, ['sceneId']),
  krakinai_get_scene_history: schema({ sceneId: idSchema, ...pageFields }, ['sceneId']),
  krakinai_search_assets: schema({ query: { type: 'string', maxLength: 200 }, category: { type: 'string', enum: ['characters', 'wardrobe', 'actions', 'environments', 'camera', 'lighting', 'styles'] }, kind: { type: 'string', enum: ['asset', 'variant', 'template'] }, ...pageFields }),
  krakinai_get_shot_types: schema({}),
  krakinai_preview_change_set: schema({ changeSet: SUPPORTED_CHANGE_SET_SCHEMA }, ['changeSet']),
  krakinai_submit_change_set: schema({ changeSet: SUPPORTED_CHANGE_SET_SCHEMA }, ['changeSet']),
  krakinai_get_proposal_status: schema({ proposalId: idSchema }, ['proposalId']),
  krakinai_get_import_receipt: schema({ changeSetId: idSchema, packageDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['changeSetId', 'packageDigest']),
  krakinai_get_generation_prompt: schema({ sceneId: idSchema }, ['sceneId']),
};
export function validateToolArgs(name: McpToolName, value: unknown): Record<string, unknown> {
  if (!MCP_TOOL_NAMES.includes(name)) throw new McpError('UNKNOWN_TOOL');
  record(value); const rule = MCP_INPUT_SCHEMAS[name]; exactKeys(value, Object.keys(rule.properties), rule.required);
  assertByteLimit(JSON.stringify(value), MCP_LIMITS.frame);
  for (const [key, entry] of Object.entries(value)) {
    const field = rule.properties[key] as { type: string; pattern?: string; maxLength?: number; minLength?: number; minimum?: number; maximum?: number; enum?: string[] };
    if (field.type === 'object') { record(entry); continue; }
    if (field.type === 'integer') { if (!Number.isSafeInteger(entry) || (entry as number) < field.minimum! || (entry as number) > field.maximum!) throw new McpError('INVALID_REQUEST'); }
    else if (typeof entry !== 'string' || entry.length > (field.maxLength ?? Infinity) || entry.length < (field.minLength ?? 0) || (field.pattern && !new RegExp(field.pattern).test(entry)) || (field.enum && !field.enum.includes(entry))) throw new McpError('INVALID_REQUEST');
  }
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
