import type { ChangeSetReceipt, ChangeSetState } from '../types/changeSet';
import type { McpScope } from '../types/mcp';
import { buildAiContext, projectAiContextLink, projectAiContextProject } from './aiContext';
import { changeSetDigest } from './changeSetCanonical';
import { readImportLedger } from './changeSetLedger';
import { getProjectShots } from './projectStoryboard';
import { revisionRoot } from './sceneRevisions';
import { SLOT_TO_CATEGORY } from './validation';
import { SHOT_TYPES, SHOT_TYPE_DESCRIPTIONS, SHOT_TYPE_LABELS, getShotTypeRules } from './shotTypeRules';
import { authorizedSceneIds, canReadReceipt, denyScope, requireProject, requireScene } from './mcpScope';
import { McpError, MCP_LIMITS, assertByteLimit, validateToolArgs, type McpToolName } from './mcpProtocol';

async function page<T>(items: T[], args: Record<string, unknown>, scope: McpScope, stampInput: unknown) {
  const signature = await changeSetDigest(stampInput), limit = Number(args.limit ?? 20); let offset = 0;
  if (args.cursor) {
    try { const cursor = JSON.parse(atob(String(args.cursor))); if (!Number.isSafeInteger(cursor.offset) || cursor.offset < 0 || cursor.epoch !== scope.epoch || cursor.signature !== signature) throw new Error(); offset = cursor.offset; }
    catch { throw new McpError('STALE_CURSOR', 'The selected scope or records changed. Restart this page request.'); }
  }
  return { items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? btoa(JSON.stringify({ offset: offset + limit, epoch: scope.epoch, signature })) : null };
}
export function receiptProjection(receipt: ChangeSetReceipt, state: ChangeSetState) {
  const sceneIds = Object.values(receipt.idMappings).filter(m => m.kind === 'scene').map(m => m.id);
  return { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest, approvedDigest: receipt.approvedDigest, appliedAt: receipt.appliedAt,
    idMappings: structuredClone(receipt.idMappings), operations: structuredClone(receipt.operations), projectRevisions: structuredClone(receipt.projectRevisions),
    scenes: sceneIds.map(id => { const scene = state.scenes.find(s => s.id === id); return scene ? { id, available: true, rootSceneId: revisionRoot(scene), parentSceneId: scene.sceneRevision?.parentSceneId, sequence: scene.sceneRevision?.sequence ?? 1, restoredFromSceneId: scene.sceneRevision?.restoredFromSceneId, pendingInputs: (scene.pendingInputs ?? []).map(p => ({ kind: p.kind })) } : { id, available: false }; }) };
}
/** All projections consume the browser's fresh snapshot. The caller rechecks session/epoch after awaiting. */
export async function readMcpTool(tool: McpToolName, raw: unknown, scope: McpScope, state: ChangeSetState): Promise<unknown> {
  const args = validateToolArgs(tool, raw);
  const disclosures = { includeAssetText: scope.includeAssetText, includeCharacterIdentity: scope.includeCharacterIdentity, includeNotes: scope.includeNotes, includeMediaFilenames: scope.includeMediaFilenames };
  let result: unknown;
  if (tool === 'krakinai_connection_status') result = { connected: true, state: 'connected', scopeEpoch: scope.epoch, projectIds: [...scope.projectIds], sceneIds: [...scope.sceneIds], mediaIds: [...scope.mediaIds], candidateIds: [...scope.candidateIds], receiptGrants: structuredClone(scope.receiptGrants), disclosure: { ...disclosures, fullPromptSceneIds: scope.fullPromptSceneIds.filter(id => authorizedSceneIds(scope, state).has(id)) }, allowProposals: scope.allowProposals, allowNewProjects: scope.allowNewProjects, automaticApplication: false };
  else if (tool === 'krakinai_list_projects') {
    const projects = state.collections.filter(c => scope.projectIds.includes(c.id)).map(c => { const { shots, ...metadata } = projectAiContextProject(c, [], scope.includeNotes); return { ...metadata, shotCount: getProjectShots(c, state.scenes).length }; });
    result = await page(projects, args, scope, { tool, projects });
  } else if (tool === 'krakinai_get_project' || tool === 'krakinai_get_storyboard') {
    const project = requireProject(String(args.projectId), scope, state), shots = getProjectShots(project, state.scenes);
    const { shots: projected, ...metadata } = projectAiContextProject(project, tool === 'krakinai_get_storyboard' ? shots : [], scope.includeNotes);
    result = tool === 'krakinai_get_project' ? { ...metadata, shotCount: shots.length } : { projectId: project.id, expectedRevision: project.project?.revision ?? 0, ...await page(projected as unknown[], args, scope, { tool, projectId: project.id, revision: project.project?.revision ?? 0, shots: projected }) };
  } else if (tool === 'krakinai_get_scene' || tool === 'krakinai_get_generation_prompt') {
    const scene = requireScene(String(args.sceneId), scope, state);
    if (tool === 'krakinai_get_generation_prompt') { if (!scope.fullPromptSceneIds.includes(scene.id)) denyScope(); result = { sceneId: scene.id, format: 'full', text: scene.outputs.full, trust: 'untrusted_user_content' }; }
    else { const doc = buildAiContext(state, { ...disclosures, sceneIds: [scene.id], fullPromptSceneIds: scope.fullPromptSceneIds.includes(scene.id) ? [scene.id] : [] }); const map = new Map(state.media.map(m => [m.id, m])); result = { ...doc.scenes[0], sourceMedia: (scene.sourceMediaLinks ?? []).map(l => projectAiContextLink(l, map, scope.includeNotes, scope.includeMediaFilenames)), trust: 'untrusted_user_content' }; }
  } else if (tool === 'krakinai_get_scene_history') {
    const scene = requireScene(String(args.sceneId), scope, state), root = revisionRoot(scene), authorized = authorizedSceneIds(scope, state);
    const records = state.scenes.filter(s => revisionRoot(s) === root && authorized.has(s.id)).sort((a, b) => (a.sceneRevision?.sequence ?? 1) - (b.sceneRevision?.sequence ?? 1));
    const metadata = records.map(s => ({ id: s.id, rootSceneId: root, sequence: s.sceneRevision?.sequence ?? 1, parentSceneId: s.sceneRevision?.parentSceneId, restoredFromSceneId: s.sceneRevision?.restoredFromSceneId }));
    result = await page(metadata, args, scope, { tool, sceneId: scene.id, metadata });
  } else if (tool === 'krakinai_search_assets') {
    const query = String(args.query ?? '').toLowerCase();
    const records = [
      ...state.assets.filter(a => scope.assetIds.includes(a.id)).map(a => ({ kind: 'asset', id: a.id, title: a.title, category: a.category, tags: a.tags, revision: a.revision })),
      ...(state.variants ?? []).filter(v => scope.variantIds.includes(v.id)).map(v => ({ kind: 'variant', id: v.id, title: v.title, category: SLOT_TO_CATEGORY[v.targetSlot], tags: v.tags, revision: v.revision })),
      ...state.templates.filter(t => scope.templateIds.includes(t.id)).map(t => ({ kind: 'template', id: t.id, title: t.name, category: t.category, tags: [] as string[], revision: t.revision })),
    ].filter(r => (!args.kind || r.kind === args.kind) && (!args.category || r.category === args.category) && `${r.title} ${r.tags.join(' ')}`.toLowerCase().includes(query));
    const selected = await page(records, args, scope, { tool, query, kind: args.kind, category: args.category, records });
    const doc = buildAiContext(state, { ...disclosures, assetIds: selected.items.filter(r => r.kind === 'asset').map(r => r.id), variantIds: selected.items.filter(r => r.kind === 'variant').map(r => r.id), templateIds: selected.items.filter(r => r.kind === 'template').map(r => r.id) });
    result = { ...selected, items: selected.items.map(r => ({ kind: r.kind, ...(r.kind === 'asset' ? doc.assets : r.kind === 'variant' ? doc.variants : doc.templates).find(a => a.id === r.id) })), trust: 'untrusted_user_content' };
  } else if (tool === 'krakinai_get_shot_types') result = { items: SHOT_TYPES.map(type => ({ type, label: SHOT_TYPE_LABELS[type], description: SHOT_TYPE_DESCRIPTIONS[type], rules: getShotTypeRules({ shotType: type }) })) };
  else if (tool === 'krakinai_get_import_receipt') {
    const receipt = readImportLedger(state.preferences).receipts.find(r => r.changeSetId === args.changeSetId && r.packageDigest === args.packageDigest);
    if (!receipt || !canReadReceipt(receipt, scope, state)) throw new McpError('RECEIPT_UNAVAILABLE', 'Select this exact import receipt in AI Connections before requesting its confirmed IDs.');
    result = receiptProjection(receipt, state);
  } else throw new McpError('UNKNOWN_TOOL');
  assertByteLimit(JSON.stringify(result), MCP_LIMITS.result - 256); return result;
}
