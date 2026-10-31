// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyState, midoriChangeSet, allContentApproval, allocationFor } from './fixtures/changeSetFixture';
import { planChangeSet } from '../domain/changeSetPlanner';
import { changeSetDigest } from '../domain/changeSetCanonical';
import { legacyScene } from './fixtures/legacyScene';
import { emptyMcpScope, assertProposalScope, canReadReceipt } from '../domain/mcpScope';
import { readMcpTool } from '../domain/mcpReads';
import { emptyChangeSetApproval, type ChangeSetReceipt, type ChangeSet } from '../types/changeSet';
import type { Collection } from '../types/domain';

function fixture() {
  const state = emptyState();
  state.assets.push({ ...state.assets[0], id: 'identity_1', category: 'characters', title: 'Allowed Character', promptText: 'IDENTITY_SECRET', identityAnchor: { text: 'ANCHOR_SECRET' }, notes: 'NOTE_SECRET' });
  state.assets.push({ ...state.assets[0], id: 'private_asset', title: 'UNSELECTED_SECRET', promptText: 'PRIVATE_ASSET_SECRET' });
  const scene = { ...structuredClone(legacyScene), authoringMode: 'direct_prompt' as const, directPrompt: { version: 1 as const, text: '  FULL_PROMPT_SECRET\r\n😊  ' }, id: 'scene_1', title: 'Allowed scene', slots: {}, referencePack: undefined, outputs: { full: '  FULL_PROMPT_SECRET\r\n😊  ' }, references: [{ mediaId: 'media_1', role: 'reference' as const, order: 0, altText: 'ALT_SECRET', filename: 'FILENAME_SECRET.png' }], reviewNotes: 'REVIEW_SECRET', sceneRevision: undefined };
  state.scenes = [scene, { ...scene, id: 'scene_private', title: 'PRIVATE_SCENE_SECRET', outputs: { full: 'OTHER_FULL_SECRET' } }];
  const project: Collection = { id: 'project_1', name: 'Allowed project', description: 'PROJECT_NOTE_SECRET', planningNotes: 'PLAN_SECRET', members: [], createdAt: '2026-10-30', updatedAt: '2026-10-30', project: { version: 1, revision: 3, shots: [{ id: 'shot_1', code: '01', title: 'First', order: 0, status: 'planned', plannedDurationSeconds: 4, takeSceneIds: ['scene_1'], selectedSceneId: 'scene_1', continuityNotes: 'CONTINUITY_SECRET' }] } };
  state.collections = [project, { ...project, id: 'project_private', name: 'OTHER_PROJECT_SECRET', project: { ...project.project!, shots: [{ ...project.project!.shots[0], id: 'shot_private', takeSceneIds: ['scene_private'], selectedSceneId: 'scene_private' }] } }];
  state.media = [{ id: 'media_1', filename: 'FILENAME_SECRET.png', safeFilename: 'safe.png', mimeType: 'image/png', byteSize: 17, blob: new Blob(['OPAQUE_BYTE_SECRET']), createdAt: '2026-10-30' }];
  const scope = { ...emptyMcpScope(), projectIds: ['project_1'], assetIds: ['identity_1', state.assets[0].id], allowProposals: true };
  return { state, scope };
}
describe('browser scoped MCP reads', () => {
  it('discloses only selected metadata and no text, filenames, notes or blobs by default', async () => {
    const { state, scope } = fixture();
    const projects = await readMcpTool('krakinai_list_projects', {}, scope, state);
    const scene = await readMcpTool('krakinai_get_scene', { sceneId: 'scene_1' }, scope, state);
    const assets = await readMcpTool('krakinai_search_assets', {}, scope, state);
    const serialized = JSON.stringify({ projects, scene, assets });
    expect(serialized).toContain('project_1'); expect(serialized).toContain('scene_1');
    expect(serialized).not.toContain('SECRET'); expect(serialized).not.toContain('blob');
    expect(JSON.stringify(state.scenes[0].outputs)).toContain('FULL_PROMPT_SECRET');
  });
  it('denies unknown and unrelated project/scene targets with the same public error', async () => {
    const { state, scope } = fixture();
    for (const projectId of ['project_private', 'missing']) await expect(readMcpTool('krakinai_get_project', { projectId }, scope, state)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    for (const sceneId of ['scene_private', 'missing']) await expect(readMcpTool('krakinai_get_scene', { sceneId }, scope, state)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('makes explicitly granted standalone targets discoverable without exposing ungranted prompt IDs', async () => {
    const { state, scope } = fixture(); scope.projectIds = []; scope.sceneIds = ['scene_1']; scope.mediaIds = ['media_1']; scope.fullPromptSceneIds = ['scene_private'];
    const status = await readMcpTool('krakinai_connection_status', {}, scope, state) as any;
    expect(status.sceneIds).toEqual(['scene_1']); expect(status.mediaIds).toEqual(['media_1']);
    expect(JSON.stringify(status)).not.toContain('scene_private');
    expect(await readMcpTool('krakinai_get_scene', { sceneId: status.sceneIds[0] }, scope, state)).toMatchObject({ id: 'scene_1' });
  });
  it('keeps identity access independent from ordinary asset text', async () => {
    const { state, scope } = fixture(); scope.includeAssetText = true;
    expect(JSON.stringify(await readMcpTool('krakinai_search_assets', {}, scope, state))).not.toContain('IDENTITY_SECRET');
    scope.includeCharacterIdentity = true;
    const data = JSON.stringify(await readMcpTool('krakinai_search_assets', {}, scope, state));
    expect(data).toContain('IDENTITY_SECRET'); expect(data).toContain('ANCHOR_SECRET'); expect(data).not.toContain('NOTE_SECRET');
  });
  it('requires an explicit scene-prompt grant and returns exact bytes when granted', async () => {
    const { state, scope } = fixture();
    await expect(readMcpTool('krakinai_get_generation_prompt', { sceneId: 'scene_1' }, scope, state)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    scope.fullPromptSceneIds = ['scene_1'];
    expect(await readMcpTool('krakinai_get_generation_prompt', { sceneId: 'scene_1' }, scope, state)).toMatchObject({ text: '  FULL_PROMPT_SECRET\r\n😊  ' });
    scope.includeNotes = true; scope.includeMediaFilenames = true;
    const text = JSON.stringify(await readMcpTool('krakinai_get_scene', { sceneId: 'scene_1' }, scope, state));
    expect(text).toContain('REVIEW_SECRET'); expect(text).toContain('FILENAME_SECRET'); expect(text).not.toContain('OPAQUE_BYTE_SECRET');
  });
  it('paginates large storyboard metadata without expanding takes or full prompts', async () => {
    const { state, scope } = fixture();
    const shot = state.collections[0].project!.shots[0];
    state.collections[0].project!.shots = Array.from({ length: 75 }, (_, i) => ({ ...shot, id: `shot_${i}`, code: String(i), order: i, takeSceneIds: Array.from({ length: 80 }, (_, j) => `take_${i}_${j}`), selectedSceneId: undefined }));
    const first = await readMcpTool('krakinai_get_storyboard', { projectId: 'project_1', limit: 50 }, scope, state) as any;
    expect(first.items).toHaveLength(50); expect(first.items[0].takeSceneIds).toHaveLength(80); expect(first.nextCursor).toBeTruthy();
    const second = await readMcpTool('krakinai_get_storyboard', { projectId: 'project_1', cursor: first.nextCursor, limit: 50 }, scope, state) as any;
    expect(second.items).toHaveLength(25); expect(second.items[0].order).toBe(50); expect(second.nextCursor).toBeNull();
    scope.epoch++; await expect(readMcpTool('krakinai_get_storyboard', { projectId: 'project_1', cursor: first.nextCursor }, scope, state)).rejects.toMatchObject({ code: 'STALE_CURSOR' });
  });
  it('does not search hidden text to reveal it through a matching oracle', async () => {
    const { state, scope } = fixture();
    expect(await readMcpTool('krakinai_search_assets', { query: 'IDENTITY_SECRET' }, scope, state)).toMatchObject({ items: [] });
  });
  it('maps variant slots to the existing category taxonomy when searching', async () => {
    const { state, scope } = fixture();
    state.variants = [{ ...state.assets[0], id: 'variant_1', parentCharacterId: 'identity_1', type: 'Pose', targetSlot: 'action' }];
    scope.variantIds = ['variant_1'];
    const result = await readMcpTool('krakinai_search_assets', { kind: 'variant', category: 'actions' }, scope, state) as any;
    expect(result.items.map((v: { id: string }) => v.id)).toEqual(['variant_1']);
  });
});
describe('proposal and receipt permission checks', () => {
  it('authorizes every operation target in a real mixed receipt without client-reference mappings', async () => {
    const initial = emptyState(), input = midoriChangeSet(), approval = allContentApproval();
    const first = planChangeSet(input, approval, initial, allocationFor(input));
    expect(first.findings.filter(f => f.severity === 'blocking')).toEqual([]);
    const receiptFor = async (pkg: ChangeSet, plan: typeof first): Promise<ChangeSetReceipt> => ({ version: 1, changeSetId: pkg.changeSetId, packageDigest: await changeSetDigest(pkg), approvedDigest: 'b'.repeat(64), source: pkg.source, appliedAt: '2026-10-30T00:00:00.000Z', approval, idMappings: plan.idMappings, operations: plan.results, projectRevisions: plan.projectRevisions });
    const originalReceipt = await receiptFor(input, first), candidate = first.candidates[0], project = first.collections[0];
    const state = { ...initial, collections: first.collections, scenes: first.scenes, preferences: { ...initial.preferences, aiImports: { version: 1 as const, receipts: [originalReceipt], candidates: first.candidates } } };
    const mixed: ChangeSet = { ...input, changeSetId: 'mixed_receipt', operations: [{ operationId: 'project-update', type: 'project.update', project: { id: project.id, expectedRevision: project.project!.revision }, name: 'Updated synthetic project' }, { operationId: 'private-review', type: 'asset.review_candidate', candidateId: candidate.id, expectedRevision: candidate.revision }] };
    const planned = planChangeSet(mixed, approval, state, allocationFor(mixed));
    expect(planned.findings.filter(f => f.severity === 'blocking')).toEqual([]); expect(planned.idMappings).toEqual({});
    const receipt = await receiptFor(mixed, planned); state.collections = planned.collections; state.preferences.aiImports.receipts.push(receipt);
    const scope = { ...emptyMcpScope(), projectIds: [project.id] };
    expect(canReadReceipt(receipt, scope, state)).toBe(false);
    await expect(readMcpTool('krakinai_get_import_receipt', { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest }, scope, state)).rejects.toMatchObject({ code: 'RECEIPT_UNAVAILABLE' });
    scope.candidateIds = [candidate.id]; expect(canReadReceipt(receipt, scope, state)).toBe(true);
    scope.candidateIds = []; scope.receiptGrants = [{ changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest }];
    expect(await readMcpTool('krakinai_get_import_receipt', { changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest }, scope, state)).toMatchObject({ operations: expect.arrayContaining([expect.objectContaining({ recordId: candidate.id })]) });
  });
  it('requires an exact historical receipt grant when a disclosed shot target no longer exists', () => {
    const { state, scope } = fixture();
    const receipt: ChangeSetReceipt = { version: 1, changeSetId: 'removed_shot', packageDigest: 'a'.repeat(64), approvedDigest: 'b'.repeat(64), source: midoriChangeSet().source, appliedAt: '2026-10-30T00:00:00Z', approval: allContentApproval(), idMappings: {}, operations: [{ operationId: 'update', type: 'shot.update', recordId: 'removed_private_shot', status: 'updated' }], projectRevisions: { project_1: { before: 2, after: 3 } } };
    expect(canReadReceipt(receipt, scope, state)).toBe(false);
    scope.receiptGrants = [{ changeSetId: receipt.changeSetId, packageDigest: receipt.packageDigest }]; expect(canReadReceipt(receipt, scope, state)).toBe(true);
  });
  it('does not infer new-project creation permission from proposal permission', () => {
    const { state, scope } = fixture(); const batch = midoriChangeSet();
    expect(() => assertProposalScope(batch, scope, state)).toThrow();
    scope.allowNewProjects = true; expect(() => assertProposalScope(batch, scope, state)).not.toThrow();
    scope.allowProposals = false; expect(() => assertProposalScope(batch, scope, state)).toThrow();
  });
  it('rejects an unrelated existing scene even if the project is authorized', () => {
    const { state, scope } = fixture();
    const batch = { ...midoriChangeSet(), operations: [{ type: 'scene.revise' as const, operationId: 'r', clientRef: 'r', sceneId: 'scene_private', expectedHeadId: 'scene_private', project: { id: 'project_1', expectedRevision: 3 }, shot: { id: 'shot_1' }, prompt: { version: 1 as const, text: 'new' } }] };
    expect(() => assertProposalScope(batch, scope, state)).toThrow();
    batch.operations[0].sceneId = 'scene_1'; batch.operations[0].expectedHeadId = 'scene_1';
    expect(() => assertProposalScope(batch, scope, state)).not.toThrow();
  });
  it('checks original-media permission even when no reference images field is present', () => {
    const { state, scope } = fixture();
    state.media.push({ ...state.media[0], id: 'unselected_media' });
    const batch = { ...midoriChangeSet(), operations: [{ type: 'scene.create_direct_prompt' as const, operationId: 'new', clientRef: 'new', title: 'Synthetic graphic', shotType: 'graphic_motion' as const, project: { id: 'project_1', expectedRevision: 3 }, shot: { id: 'shot_1' }, prompt: { version: 1 as const, text: 'Animate the original faithfully.' }, sourceMedia: [{ mediaId: 'unselected_media' }] }] };
    expect(() => assertProposalScope(batch, scope, state)).toThrow();
    scope.mediaIds = ['unselected_media']; expect(() => assertProposalScope(batch, scope, state)).not.toThrow();
  });
  it('does not grant receipt access vacuously to asset-only imports or by guessed digest', () => {
    const { state, scope } = fixture();
    const receipt: ChangeSetReceipt = { version: 1, changeSetId: 'old_import', packageDigest: 'a'.repeat(64), approvedDigest: 'b'.repeat(64), source: midoriChangeSet().source, appliedAt: '2026-10-30T00:00:00Z', approval: emptyChangeSetApproval(), idMappings: { camera: { kind: 'candidate', id: 'private_candidate', assetId: 'private_asset' } }, operations: [], projectRevisions: {} };
    expect(canReadReceipt(receipt, scope, state)).toBe(false);
    scope.receiptGrants = [{ changeSetId: 'old_import', packageDigest: 'f'.repeat(64) }]; expect(canReadReceipt(receipt, scope, state)).toBe(false);
    scope.receiptGrants = [{ changeSetId: 'old_import', packageDigest: 'a'.repeat(64) }]; expect(canReadReceipt(receipt, scope, state)).toBe(true);
  });
});
