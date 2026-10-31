import type { ChangeSet, ChangeSetReceipt, ChangeSetState } from '../types/changeSet';
import type { McpScope } from '../types/mcp';
import { getProjectShots } from './projectStoryboard';
import { readImportLedger } from './changeSetLedger';
import { McpError, record, exactKeys } from './mcpProtocol';

export const MCP_SCOPE_ID_LIMITS = Object.freeze({ projectIds: 10, sceneIds: 250, assetIds: 500, variantIds: 500, templateIds: 500, fullPromptSceneIds: 250, mediaIds: 2000, candidateIds: 250 });
export const MCP_SCOPE_LIMITS = Object.freeze({ ...MCP_SCOPE_ID_LIMITS, reusableRecords: 500, receiptGrants: 1000 });
export function emptyMcpScope(): McpScope { return { version: 1, epoch: 0, projectIds: [], sceneIds: [], assetIds: [], variantIds: [], templateIds: [], fullPromptSceneIds: [], mediaIds: [], candidateIds: [], receiptGrants: [], includeAssetText: false, includeCharacterIdentity: false, includeNotes: false, includeMediaFilenames: false, allowNewProjects: false, allowProposals: false }; }
export function validateMcpScope(scope: McpScope): McpScope {
  record(scope); exactKeys(scope, Object.keys(emptyMcpScope()), Object.keys(emptyMcpScope()));
  const invalid = () => { throw new McpError('INVALID_SCOPE', 'Select at most 10 projects, 250 explicit scenes and 500 reusable records, using unique native record IDs.'); };
  if (scope.version !== 1 || !Number.isSafeInteger(scope.epoch) || scope.epoch < 0) invalid();
  const fields = MCP_SCOPE_ID_LIMITS;
  for (const [field, maximum] of Object.entries(fields)) { const values = scope[field as keyof typeof fields]; if (!Array.isArray(values) || values.length > maximum || new Set(values).size !== values.length || values.some(id => typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id))) invalid(); }
  if (scope.assetIds.length + scope.variantIds.length + scope.templateIds.length > MCP_SCOPE_LIMITS.reusableRecords) invalid();
  for (const field of ['includeAssetText', 'includeCharacterIdentity', 'includeNotes', 'includeMediaFilenames', 'allowNewProjects', 'allowProposals'] as const) if (typeof scope[field] !== 'boolean') invalid();
  if (!Array.isArray(scope.receiptGrants) || scope.receiptGrants.length > MCP_SCOPE_LIMITS.receiptGrants || new Set(scope.receiptGrants.map(g => `${g.changeSetId}:${g.packageDigest}`)).size !== scope.receiptGrants.length) invalid();
  for (const grant of scope.receiptGrants) if (!grant || Object.keys(grant).length !== 2 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(grant.changeSetId) || !/^[a-f0-9]{64}$/.test(grant.packageDigest)) invalid();
  return structuredClone(scope);
}
export function denyScope(): never { throw new McpError('PERMISSION_DENIED', 'This record or operation is outside the permissions selected in AI Connections.'); }
export function authorizedSceneIds(scope: McpScope, state: ChangeSetState): Set<string> { return new Set([...scope.sceneIds, ...state.collections.filter(c => scope.projectIds.includes(c.id)).flatMap(c => getProjectShots(c, state.scenes).flatMap(s => s.takeSceneIds))]); }
export function requireScene(id: string, scope: McpScope, state: ChangeSetState) { const scene = state.scenes.find(s => s.id === id); if (!scene || !authorizedSceneIds(scope, state).has(id)) denyScope(); return scene; }
export function requireProject(id: string, scope: McpScope, state: ChangeSetState) { const project = state.collections.find(p => p.id === id); if (!project || !scope.projectIds.includes(id)) denyScope(); return project; }
export function hasReceiptGrant(receipt: Pick<ChangeSetReceipt, 'changeSetId' | 'packageDigest'>, scope: McpScope) { return scope.receiptGrants.some(g => g.changeSetId === receipt.changeSetId && g.packageDigest === receipt.packageDigest); }
export function canReadReceipt(receipt: ChangeSetReceipt, scope: McpScope, state: ChangeSetState): boolean {
  if (hasReceiptGrant(receipt, scope)) return true;
  const scenes = authorizedSceneIds(scope, state), mappings = Object.values(receipt.idMappings), projectIds = Object.keys(receipt.projectRevisions);
  const projects = state.collections.filter(p => scope.projectIds.includes(p.id));
  const shots = new Set(projects.flatMap(p => getProjectShots(p, state.scenes).map(s => s.id)));
  let storedCandidates: Set<string> | undefined;
  const projectAllowed = (id: string) => projects.some(p => p.id === id);
  const shotAllowed = (id: string) => shots.has(id);
  const sceneAllowed = (id: string) => scenes.has(id) && state.scenes.some(s => s.id === id);
  const candidateAllowed = (id: string) => scope.candidateIds.includes(id) && (storedCandidates ??= new Set(readImportLedger(state.preferences).candidates.map(c => c.id))).has(id);
  if (!mappings.length && !projectIds.length && !receipt.operations.some(op => op.recordId)) return false;
  if (!projectIds.every(projectAllowed)) return false;
  // Operations without a clientRef have no idMapping. Every disclosed target
  // still needs its own grant; removed/unknown targets require the exact receipt.
  if (!receipt.operations.every(op => {
    if (!op.recordId) return false;
    if (op.type.startsWith('project.') || op.type === 'shot.reorder') return projectAllowed(op.recordId);
    if (op.type.startsWith('shot.')) return shotAllowed(op.recordId);
    if (op.type.startsWith('scene.')) return sceneAllowed(op.recordId);
    if (op.type.startsWith('asset.')) return candidateAllowed(op.recordId);
    return false;
  })) return false;
  return mappings.every(m => {
    if (m.kind === 'project') return projectAllowed(m.id);
    if (m.kind === 'scene') return sceneAllowed(m.id);
    if (m.kind === 'shot') return shotAllowed(m.id);
    return candidateAllowed(m.id) && (!m.assetId || (scope.assetIds.includes(m.assetId) && state.assets.some(a => a.id === m.assetId)) || (scope.templateIds.includes(m.assetId) && state.templates.some(t => t.id === m.assetId)));
  });
}
function availableMedia(scope: McpScope, state: ChangeSetState): Set<string> {
  const ids = new Set(scope.mediaIds), scenes = authorizedSceneIds(scope, state);
  for (const scene of state.scenes.filter(s => scenes.has(s.id))) for (const link of [...scene.references, ...(scene.referencePack?.entries ?? []), ...(scene.sourceMediaLinks ?? [])]) ids.add(link.mediaId);
  for (const asset of state.assets.filter(a => scope.assetIds.includes(a.id))) for (const link of asset.mediaLinks) ids.add(link.mediaId);
  for (const variant of (state.variants ?? []).filter(v => scope.variantIds.includes(v.id))) for (const link of variant.mediaLinks) ids.add(link.mediaId);
  return ids;
}
export function assertProposalScope(changeSet: ChangeSet, scope: McpScope, state: ChangeSetState, localReuseGrants: ReadonlySet<string> = new Set()): void {
  if (!scope.allowProposals) denyScope(); const scenes = authorizedSceneIds(scope, state), media = availableMedia(scope, state);
  const requireExistingScene = (id: string) => { if (!scenes.has(id) || !state.scenes.some(s => s.id === id)) denyScope(); };
  for (const op of changeSet.operations) {
    if (op.type === 'project.create' && !scope.allowNewProjects) denyScope();
    let targetProject: ReturnType<typeof requireProject> | undefined;
    if ('project' in op && op.project && 'id' in op.project) targetProject = requireProject(op.project.id, scope, state);
    if (targetProject) {
      const shots = getProjectShots(targetProject, state.scenes);
      const shotId = 'shot' in op && op.shot && 'id' in op.shot ? op.shot.id : undefined;
      if (shotId && !shots.some(s => s.id === shotId)) denyScope();
      if ('shots' in op) for (const shot of op.shots) if ('id' in shot && !shots.some(s => s.id === shot.id)) denyScope();
      if ('sceneId' in op) {
        if (!shots.some(s => s.takeSceneIds.includes(op.sceneId))) denyScope();
        if (shotId && !shots.find(s => s.id === shotId)?.takeSceneIds.includes(op.sceneId)) denyScope();
      }
    }
    if ('sceneId' in op) requireExistingScene(op.sceneId);
    // expectedHeadId is an opaque concurrency token, not a grant to read that head.
    if ('restoreFromSceneId' in op && op.restoreFromSceneId) requireExistingScene(op.restoreFromSceneId);
    if ('scene' in op && 'id' in op.scene) requireExistingScene(op.scene.id);
    if ('sourceScene' in op && op.sourceScene && 'id' in op.sourceScene) requireExistingScene(op.sourceScene.id);
    if (op.type === 'scene.create_direct_prompt' && !op.project) denyScope();
    if ('assetRefs' in op) for (const ref of op.assetRefs ?? []) if ('id' in ref.asset && !scope.assetIds.includes(ref.asset.id) && !localReuseGrants.has(ref.asset.id)) denyScope();
    if ('variantRefs' in op) for (const ref of op.variantRefs ?? []) if (!scope.variantIds.includes(ref.variantId)) denyScope();
    if ('references' in op || 'sourceMedia' in op) for (const link of [...(op.references ?? []), ...(op.sourceMedia ?? [])]) if (!media.has(link.mediaId)) denyScope();
    if (op.type === 'asset.review_candidate') {
      const ledger = readImportLedger(state.preferences), candidate = ledger.candidates.find(c => c.id === op.candidateId);
      const receipt = candidate && ledger.receipts.find(r => r.changeSetId === candidate.changeSetId);
      if (!candidate || (!scope.candidateIds.includes(candidate.id) && (!receipt || !hasReceiptGrant(receipt, scope)))) denyScope();
    }
  }
}
