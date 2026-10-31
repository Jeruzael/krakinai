import { beforeEach, expect, it } from 'vitest';
import { ProposalBroker } from '../connections/proposalBroker';
import { emptyMcpScope } from '../domain/mcpScope';
import { clearAllStoresForTesting, initializeDatabase, getAllSnapshot, openDatabase } from '../storage/db';
import { midoriChangeSet, syntheticCamera, emptyState } from './fixtures/changeSetFixture';
import type { McpCommand } from '../domain/mcpProtocol';
import { previewChangeSet } from '../storage/changeSets';
import { allContentApproval } from './fixtures/changeSetFixture';
beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); const db = await openDatabase(); await new Promise<void>(resolve => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put(syntheticCamera()); tx.oncomplete = () => resolve(); }); });
const allowed = () => ({ ...emptyMcpScope(), assetIds: ['asset_synthetic_camera'], allowNewProjects: true, allowProposals: true });
const submit = (): McpCommand => ({ requestId: 'request_1', tool: 'krakinai_submit_change_set', args: { changeSet: midoriChangeSet() } });
it('keeps explicit receipt recovery separate from temporary browser-approved receipt authority', () => {
  const broker = new ProposalBroker();
  broker.connect('session_1', { ...allowed(), receiptGrants: [{ changeSetId: 'synthetic_receipt', packageDigest: 'a'.repeat(64) }] });
  expect(broker.getState().approvedReceiptGrants).toEqual([]);
  expect(broker.getState().scope.receiptGrants).toHaveLength(1);
  broker.disconnect();
  expect(broker.getState().approvedReceiptGrants).toEqual([]);
  expect(broker.getState().scope.receiptGrants).toEqual([]);
});
it('registers and previews the native package without saving any application records', async () => {
  const broker = new ProposalBroker(); broker.connect('session_1', allowed()); const before = await getAllSnapshot();
  const result = await broker.handle(submit(), 'session_1');
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true, data: { status: 'review_required', changeSetId: 'synthetic-midori-60s-v1' } });
  expect(broker.getState().proposals).toHaveLength(1);
  expect(broker.getState().proposals[0].preview!.changeSet).toEqual(midoriChangeSet());
  expect(await getAllSnapshot()).toEqual(before);
});
it('deduplicates repeated submissions and rejects altered contents under the same ID', async () => {
  const broker = new ProposalBroker(); broker.connect('session_1', allowed());
  const first = await broker.handle(submit(), 'session_1'), second = await broker.handle(submit(), 'session_1');
  expect(second).toEqual(first); expect(broker.getState().proposals).toHaveLength(1);
  const changed = submit(); (changed.args.changeSet as ReturnType<typeof midoriChangeSet>).title = 'Different';
  expect(await broker.handle(changed, 'session_1')).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
});
it('rejects tool-supplied approval and synthetic DOM approval events', async () => {
  const broker = new ProposalBroker(); broker.connect('session_1', allowed()); const before = await getAllSnapshot();
  expect(await broker.handle({ ...submit(), args: { ...submit().args, approved: true } }, 'session_1')).toMatchObject({ ok: false });
  await broker.handle(submit(), 'session_1'); const id = broker.getState().proposals[0].id;
  expect(() => broker.confirmReview(id, true, new Event('change'))).toThrow();
  await expect(broker.applyFromUserEvent(id, new Event('click'))).rejects.toThrow();
  await expect(broker.applyFromUserEvent(id, { isTrusted: true } as Event)).rejects.toThrow();
  expect(await getAllSnapshot()).toEqual(before);
});
it('revokes an in-flight scoped read before its data can be returned', async () => {
  let release!: (value: ReturnType<typeof emptyState>) => void;
  const state = emptyState(), broker = new ProposalBroker({ readState: () => new Promise(resolve => { release = resolve; }) });
  broker.connect('session_1', allowed());
  const pending = broker.handle({ requestId: 'r', tool: 'krakinai_get_shot_types', args: {} }, 'session_1');
  broker.disconnect(); release(state);
  expect(await pending).toMatchObject({ ok: false, error: { code: 'DISCONNECTED' } });
});
it('does not let a scope change preserve a pending disclosure', async () => {
  let release!: (value: ReturnType<typeof emptyState>) => void;
  const broker = new ProposalBroker({ readState: () => new Promise(resolve => { release = resolve; }) }); broker.connect('session_1', allowed());
  const pending = broker.handle({ requestId: 'r', tool: 'krakinai_get_shot_types', args: {} }, 'session_1');
  broker.setScope(emptyMcpScope()); release(emptyState());
  expect(await pending).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
});
it('rejects and expires proposals without writing records', async () => {
  let now = Date.now(); const broker = new ProposalBroker({ now: () => now }); broker.connect('session_1', allowed()); const before = await getAllSnapshot();
  await broker.handle(submit(), 'session_1'); const id = broker.getState().proposals[0].id;
  now += 600001; broker.expire(); expect(broker.getState().proposals[0].status).toBe('expired');
  expect(await getAllSnapshot()).toEqual(before);
  expect(await broker.handle({ requestId: 's', tool: 'krakinai_get_proposal_status', args: { proposalId: id } }, 'session_1')).toMatchObject({ ok: true, data: { status: 'expired' } });
});
it('does not leak local preview details through the MCP preview response', async () => {
  const broker = new ProposalBroker(); broker.connect('session_1', allowed());
  const result = await broker.handle({ ...submit(), tool: 'krakinai_preview_change_set' }, 'session_1');
  expect(result).toMatchObject({ ok: true, data: { reviewRequired: true, operationCount: 33 } });
  const text = JSON.stringify(result); expect(text).not.toContain('proposedPrompt'); expect(text).not.toContain('idMappings');
  expect(broker.getState().proposals).toHaveLength(0);
});
it('does not let an older asynchronous review replace the latest decisions', async () => {
  let release!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const broker = new ProposalBroker({ preview: async (input, approval) => { if (approval?.storyboard && !approval.scenes) { started(); await waiting; } return previewChangeSet(input, approval); } });
  broker.connect('session_1', allowed()); await broker.handle(submit(), 'session_1'); const id = broker.getState().proposals[0].id;
  const older = broker.review(id, { ...allContentApproval(), scenes: false }); await ready;
  await broker.review(id, allContentApproval()); release(); await older;
  expect(broker.getState().proposals[0]).toMatchObject({ status: 'review_required', preview: { approval: { scenes: true } } });
});
it('bounds local scope selections before granting them', () => {
  const broker = new ProposalBroker();
  expect(() => broker.connect('session_1', { ...allowed(), projectIds: Array.from({ length: 11 }, (_, i) => `p${i}`) })).toThrow();
  broker.connect('session_1', allowed());
  expect(() => broker.setScope({ ...allowed(), assetIds: ['duplicate', 'duplicate'] })).toThrow();
  expect(broker.getState().scope.assetIds).toEqual(['asset_synthetic_camera']);
});
it('expires an unresolved conflict so its bounded queue slot can be recovered', async () => {
  let now = 1000; const broker = new ProposalBroker({ now: () => now });
  broker.connect('session_1', allowed()); await broker.handle(submit(), 'session_1');
  broker.setScope(allowed()); expect(broker.getState().proposals[0].status).toBe('conflict');
  now += 600001; broker.expire(); expect(broker.getState().proposals[0].status).toBe('expired');
});
it('shows the selected review choices immediately while the new digest is computed', async () => {
  const broker = new ProposalBroker(); broker.connect('session_1', allowed()); await broker.handle(submit(), 'session_1');
  const id = broker.getState().proposals[0].id, reviewing = broker.review(id, allContentApproval());
  expect(broker.getState().proposals[0]).toMatchObject({ status: 'received', preview: { approval: { scenes: true } } });
  await reviewing;
});
