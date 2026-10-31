import { describe, expect, it } from 'vitest';
import { emptyState, syntheticCamera } from './fixtures/changeSetFixture';
import { legacyScene } from './fixtures/legacyScene';
import { emptyMcpScope } from '../domain/mcpScope';
import { emptyChangeSetApproval, type ChangeSetReceipt } from '../types/changeSet';
import { buildPermissionInventory, changeSelection, normalizePermissionDraft, presetPermissionDraft, scopeDiff, selectAllRecords, clearAllRecords, validatePermissionDraft, projectPermissionContext, receiptKey } from '../domain/mcpPermissionDraft';

const ids = (n: number, prefix = 'asset') => Array.from({ length: n }, (_, i) => prefix + '_' + i);
function fixture() {
  const state = emptyState();
  state.assets = ids(80).map((id, i) => ({ ...syntheticCamera(), id, title: (i < 65 ? 'Matching ' : 'Hidden ') + i, category: i % 2 ? 'camera' as const : 'lighting' as const }));
  state.scenes = [{ ...structuredClone(legacyScene), id: 'scene_a', slots: {}, references: [] }, { ...structuredClone(legacyScene), id: 'scene_b', slots: {}, references: [] }];
  state.collections = [{ id: 'project_a', name: 'Synthetic Project', description: '', members: [], createdAt: '', updatedAt: '', project: { version: 1, revision: 1, shots: [{ id: 'shot_a', code: '01', title: 'A', order: 0, status: 'planned', takeSceneIds: ['scene_a'] }] } }];
  return state;
}
function receipt(changeSetId: string, packageDigest: string): ChangeSetReceipt {
  return { version: 1, changeSetId, packageDigest, approvedDigest: 'c'.repeat(64), source: { kind: 'codex' }, appliedAt: '', approval: emptyChangeSetApproval(), idMappings: {}, operations: [], projectRevisions: {} };
}
describe('complete-set permission edits', () => {
  it('follows exact variant parent and linked-media IDs without guessing identities or mutating records', () => {
    const state = fixture();
    state.assets[0].category = 'characters';
    state.assets[0].mediaLinks = [{ mediaId: 'missing_parent', role: 'reference', altText: '', order: 0 }];
    state.assets[2].title = state.assets[0].title;
    state.variants = [{ ...state.assets[79], id: 'variant_project', parentCharacterId: 'asset_0', type: 'Pose', targetSlot: 'action', mediaLinks: [{ mediaId: 'missing_variant', role: 'sample', altText: '', order: 0 }] }];
    state.collections[0].members = [{ type: 'variant', id: 'variant_project', addedAt: '' }];
    const before = structuredClone(state), context = projectPermissionContext('project_a', state);
    expect(context.relatedVariantIds).toEqual(['variant_project']);
    expect(context.relatedAssetIds).toEqual(['asset_0']);
    expect(context.missingMediaIds.sort()).toEqual(['missing_parent', 'missing_variant']);
    expect(context.relatedAssetIds).not.toContain('asset_2'); expect(state).toEqual(before);
  });
  it('selects every match past row 50 and retains hidden selections without duplicates', () => {
    const state = fixture(), scope = { ...emptyMcpScope(), assetIds: ['asset_79'] };
    const matches = buildPermissionInventory(state, scope).assetIds.filter(r => r.label.startsWith('Matching')).map(r => r.id);
    const selected = changeSelection(scope, 'assetIds', [...matches, 'asset_0'], true);
    expect(selected.assetIds).toHaveLength(66);
    expect(selected.assetIds).toContain('asset_64'); expect(selected.assetIds).toContain('asset_79');
    expect(scope.assetIds).toEqual(['asset_79']);
    expect(changeSelection(selected, 'assetIds', matches, false).assetIds).toEqual(['asset_79']);
  });
  it.each([
    ['projectIds', 10], ['sceneIds', 250], ['fullPromptSceneIds', 250], ['assetIds', 500],
    ['variantIds', 500], ['templateIds', 500], ['mediaIds', 2000], ['candidateIds', 250],
  ] as const)('rejects an over-limit %s action as a whole', (field, max) => {
    const before = emptyMcpScope(), selected = changeSelection(before, field, ids(max, 'id'), true);
    expect(selected[field]).toHaveLength(max);
    expect(() => changeSelection(selected, field, ['one_extra'], true)).toThrow(/limit|maximum|at most|exceed/i);
    expect(selected[field]).toHaveLength(max); expect(before[field]).toEqual([]);
  });
  it('enforces the combined reusable limit instead of three independent allowances', () => {
    const scope = { ...emptyMcpScope(), assetIds: ids(499), templateIds: ['template_one'] };
    expect(() => changeSelection(scope, 'variantIds', ['variant_one'], true)).toThrow(/501.*500|500.*501/);
    expect(scope.variantIds).toEqual([]);
  });
  it('keeps exact receipt digests distinct even when change-set IDs match', () => {
    const one = { changeSetId: 'history:one', packageDigest: 'a'.repeat(64) }, two = { ...one, packageDigest: 'b'.repeat(64) };
    const selected = changeSelection(emptyMcpScope(), 'receiptGrants', [receiptKey(one), receiptKey(two)], true);
    expect(selected.receiptGrants).toEqual([one, two]);
    expect(changeSelection(selected, 'receiptGrants', [receiptKey(one)], false).receiptGrants).toEqual([two]);
    expect(() => changeSelection(selected, 'receiptGrants', ['bad receipt'], true)).toThrow();
  });
  it('rejects receipt bulk actions beyond 1000 without discarding existing choices', () => {
    const keys = ids(1000, 'receipt').map(changeSetId => receiptKey({ changeSetId, packageDigest: 'a'.repeat(64) }));
    const selected = changeSelection(emptyMcpScope(), 'receiptGrants', keys, true);
    expect(selected.receiptGrants).toHaveLength(1000);
    expect(() => changeSelection(selected, 'receiptGrants', [receiptKey({ changeSetId: 'extra', packageDigest: 'b'.repeat(64) })], true)).toThrow();
  });
  it('ordinary Select All leaves sensitive disclosures, receipts and capabilities disabled', () => {
    const state = fixture(); state.preferences.aiImports = { version: 1, candidates: [], receipts: [receipt('receipt_one', 'a'.repeat(64))] };
    const selected = selectAllRecords(emptyMcpScope(), state);
    expect(selected.assetIds).toHaveLength(80); expect(selected.sceneIds).toEqual(['scene_a', 'scene_b']);
    expect(selected.fullPromptSceneIds).toEqual([]); expect(selected.receiptGrants).toEqual([]);
    expect(selected.includeCharacterIdentity).toBe(false); expect(selected.includeAssetText).toBe(false); expect(selected.allowProposals).toBe(false);
    state.assets.push({ ...syntheticCamera(), id: 'future_asset' }); expect(selected.assetIds).not.toContain('future_asset');
  });
  it('never silently truncates an oversized global selection', () => {
    const state = fixture(); state.assets = ids(501).map(id => ({ ...syntheticCamera(), id }));
    const before = { ...emptyMcpScope(), assetIds: ['asset_0'] };
    expect(() => selectAllRecords(before, state)).toThrow(/501/); expect(before.assetIds).toEqual(['asset_0']);
  });
  it('Clear All clears all selected IDs including sensitive grants but keeps independent toggles visible', () => {
    const scope = { ...emptyMcpScope(), assetIds: ['a'], fullPromptSceneIds: ['s'], receiptGrants: [{ changeSetId: 'x', packageDigest: 'a'.repeat(64) }], includeNotes: true, allowProposals: true };
    const cleared = clearAllRecords(scope);
    expect(cleared.assetIds).toEqual([]); expect(cleared.fullPromptSceneIds).toEqual([]); expect(cleared.receiptGrants).toEqual([]);
    expect(cleared.includeNotes).toBe(true); expect(cleared.allowProposals).toBe(true);
  });
  it('reports dependent full-prompt removals while retaining explicit-scene coverage', () => {
    const state = fixture(), before = { ...emptyMcpScope(), projectIds: ['project_a'], fullPromptSceneIds: ['scene_a'] };
    const after = normalizePermissionDraft({ ...before, projectIds: [] }, state);
    expect(after.fullPromptSceneIds).toEqual([]);
    expect(scopeDiff(before, after, buildPermissionInventory(state, before)).find(d => d.field === 'fullPromptSceneIds')?.removed).toEqual([{ id: 'scene_a', label: state.scenes[0].title }]);
    expect(normalizePermissionDraft({ ...before, projectIds: [], sceneIds: ['scene_a'] }, state).fullPromptSceneIds).toEqual(['scene_a']);
  });
  it('rejects stale selected records rather than replacing them with similar names', () => {
    const state = fixture(), scope = { ...emptyMcpScope(), assetIds: ['deleted_asset'] };
    expect(() => validatePermissionDraft(scope, state)).toThrow(/unavailable|removed|no longer/i);
    expect(scope.assetIds).toEqual(['deleted_asset']);
  });
  it('full access selects only known records and minimal/creative remain explicit draft transforms', () => {
    const state = fixture(), before = { ...emptyMcpScope(), projectIds: ['project_a'], assetIds: ['asset_79'], includeNotes: true };
    const full = presetPermissionDraft('full', before, state);
    expect(full.assetIds).toHaveLength(80); expect(full.fullPromptSceneIds).toEqual(['scene_a', 'scene_b']);
    expect(full.includeCharacterIdentity).toBe(true); expect(full.allowNewProjects).toBe(true); expect(before.includeNotes).toBe(true);
    const creative = presetPermissionDraft('creative', before, state);
    expect(creative.projectIds).toEqual(['project_a']); expect(creative.assetIds).toEqual(['asset_79']);
    expect(creative.allowProposals).toBe(true); expect(creative.includeNotes).toBe(false); expect(creative.allowNewProjects).toBe(false);
    const minimal = presetPermissionDraft('minimal', before, state);
    expect(minimal.projectIds).toEqual(['project_a']); expect(minimal.assetIds).toEqual([]); expect(minimal.allowProposals).toBe(false);
  });
  it('suggests project assets only through actual IDs and identifies missing references', () => {
    const state = fixture();
    state.collections[0].members = [{ type: 'asset', id: 'asset_79', addedAt: '' }];
    state.scenes[0].references = [{ mediaId: 'missing_media', role: 'reference', order: 0, altText: '' }];
    state.scenes[0].pendingInputs = [{ version: 1, id: 'frame', kind: 'reference_image', label: 'Future frame' }];
    const context = projectPermissionContext('project_a', state);
    expect(context).toMatchObject({ shotCount: 1, sceneCount: 1, relatedAssetIds: ['asset_79'], missingMediaIds: ['missing_media'], pendingInputs: 1 });
    expect(context.relatedAssetIds).not.toContain('asset_0');
  });
});
