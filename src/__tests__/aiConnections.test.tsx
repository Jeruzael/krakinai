import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { clearAllStoresForTesting, initializeDatabase, getAllSnapshot } from '../storage/db';
let relay: { url: string; close(): Promise<void> } | undefined;
beforeEach(async () => { await clearAllStoresForTesting(); await initializeDatabase(); window.location.hash = '#/connections/ai'; });
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); await relay?.close(); relay = undefined; });
it('starts disconnected with no grants and does not write connection settings into library storage', async () => {
  const before = await getAllSnapshot(); render(<App />);
  expect(await screen.findByRole('heading', { name: 'AI Connections' })).toBeInTheDocument();
  expect(screen.getByText('Disconnected', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Connect Codex' })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('tab', { name: 'Permissions' }));
  expect(screen.getByRole('checkbox', { name: 'Allow change-set proposals' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Allow new project creation' })).not.toBeChecked();
  expect(await getAllSnapshot()).toEqual(before);
});
it('keeps identity, ordinary text, notes and filenames as separate opt-ins', async () => {
  const user = userEvent.setup(); render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  await user.click(screen.getByRole('tab', { name: 'Permissions' }));
  const identity = screen.getByRole('checkbox', { name: 'Share Character identities and approved anchors' });
  const ordinary = screen.getByRole('checkbox', { name: 'Share ordinary asset prompt text' });
  await user.click(ordinary); expect(ordinary).toBeChecked(); expect(identity).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Share private production notes' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Share media filenames' })).not.toBeChecked();
});
it('shows the current origin and leaves manual imports available when the bridge is disconnected', async () => {
  render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  expect(screen.getByText(window.location.origin, { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use manual AI Change Set import' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Apply reviewed batch' })).not.toBeInTheDocument();
});
it('keeps the browser controller alive as the pairing screen transitions to connected', async () => {
  // Keep Node-only relay types out of the browser tsconfig, as in testSetup's Node Blob import.
  const relayModulePath = '../../bridge/src/relay.ts';
  const { createRelay } = await import(/* @vite-ignore */ relayModulePath);
  let native: { secret: string } | undefined;
  relay = await createRelay({ port: 0, appOrigin: window.location.origin, bridgePath: 'C:/synthetic/test-server.mjs', verifyNative(info: { secret: string }) { native = info; return { decision: Promise.resolve(true), close() {} }; } });
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => nativeFetch(url, { ...init, headers: { ...init?.headers, origin: window.location.origin } }));
  const user = userEvent.setup(); render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  const address = screen.getByRole('textbox', { name: 'Local bridge address' }); await user.clear(address); await user.type(address, relay!.url);
  await user.click(screen.getByRole('button', { name: 'Connect Codex' }));
  const secret = await screen.findByLabelText('One-time pairing key'); await user.type(secret, native!.secret);
  await user.click(screen.getByRole('button', { name: 'Confirm pairing' }));
  expect(await screen.findByText('Connected', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Disconnect Codex' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Home' }));
  await user.click(screen.getByRole('button', { name: 'AI Connections' }));
  await screen.findByRole('heading', { name: 'AI Connections' });
  expect(screen.getByRole('textbox', { name: 'Local bridge address' })).toHaveValue(relay!.url);
}, 15000);

it('explains malformed pasted pairing keys locally without sending a proof or revealing the value', async () => {
  const relayModulePath = '../../bridge/src/relay.ts';
  const { createRelay } = await import(/* @vite-ignore */ relayModulePath);
  let syntheticKey = '', proofRequests = 0;
  relay = await createRelay({ port: 0, appOrigin: window.location.origin, bridgePath: 'C:/synthetic/pairing-feedback.mjs', verifyNative(info: { secret: string }) { syntheticKey = info.secret; return { decision: Promise.resolve(true), close() {} }; } });
  if (!relay) throw new Error('Synthetic relay failed to start');
  const relayUrl = relay.url;
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => { if (url.endsWith('/v1/pair/proof')) proofRequests++; return nativeFetch(url, { ...init, headers: { ...init?.headers, origin: window.location.origin } }); });
  const user = userEvent.setup(); render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  const address = screen.getByRole('textbox', { name: 'Local bridge address' }); await user.clear(address); await user.type(address, relayUrl);
  await user.click(screen.getByRole('button', { name: 'Connect Codex' }));
  const input = await screen.findByLabelText('One-time pairing key');
  for (const invalid of ['Hidden. Choose Show pairing key.', 'short_code12', syntheticKey + ' ', '!' + syntheticKey.slice(1), '_'.repeat(43)]) {
    await user.type(input, invalid); await user.click(screen.getByRole('button', { name: 'Confirm pairing' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('43-character one-time pairing key');
    expect(alert).toHaveTextContent('PAIRING_KEY_FORMAT');
    expect(alert.textContent).not.toContain(invalid);
    expect(proofRequests).toBe(0);
    expect(input).toHaveValue('');
  }
  await user.type(input, syntheticKey); await user.click(screen.getByRole('button', { name: 'Confirm pairing' }));
  expect(await screen.findByText('Connected', { exact: true })).toBeInTheDocument();
  expect(proofRequests).toBe(1);
}, 15000);

it('keeps rejecting a correctly formatted but wrong key and identifies the server rejection without exposing either key', async () => {
  const relayModulePath = '../../bridge/src/relay.ts';
  const { createRelay } = await import(/* @vite-ignore */ relayModulePath);
  const { randomSecret } = await import('../domain/mcpCrypto');
  let syntheticKey = '', proofRequests = 0;
  relay = await createRelay({ port: 0, appOrigin: window.location.origin, bridgePath: 'C:/synthetic/pairing-feedback.mjs', verifyNative(info: { secret: string }) { syntheticKey = info.secret; return { decision: Promise.resolve(true), close() {} }; } });
  if (!relay) throw new Error('Synthetic relay failed to start');
  const relayUrl = relay.url;
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => { if (url.endsWith('/v1/pair/proof')) proofRequests++; return nativeFetch(url, { ...init, headers: { ...init?.headers, origin: window.location.origin } }); });
  const user = userEvent.setup(); render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  const address = screen.getByRole('textbox', { name: 'Local bridge address' }); await user.clear(address); await user.type(address, relayUrl);
  await user.click(screen.getByRole('button', { name: 'Connect Codex' }));
  const input = await screen.findByLabelText('One-time pairing key'), wrongKey = randomSecret();
  await user.type(input, wrongKey); await user.click(screen.getByRole('button', { name: 'Confirm pairing' }));
  const alert = await screen.findByRole('alert'); expect(alert).toHaveTextContent('[DISCONNECTED]');
  expect(alert.textContent).not.toContain(wrongKey); expect(alert.textContent).not.toContain(syntheticKey);
  expect(proofRequests).toBe(1); expect(screen.queryByText('Connected', { exact: true })).not.toBeInTheDocument();
}, 15000);

it('locks permission edits for the entire delayed connection startup and connects only the applied scope', async () => {
  const modulePath = '../../bridge/src/relay.ts';
  const { createRelay } = await import(/* @vite-ignore */ modulePath);
  let syntheticKey = '', releaseStart!: () => void;
  const startGate = new Promise<void>(resolve => { releaseStart = resolve; });
  relay = await createRelay({ port: 0, appOrigin: window.location.origin, bridgePath: 'C:/synthetic/delayed-start.mjs', verifyNative(info: { secret: string }) { syntheticKey = info.secret; return { decision: Promise.resolve(true), close() {} }; } });
  if (!relay) throw new Error('Synthetic relay failed to start');
  const delayedRelayUrl = relay.url;
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/pair/start')) await startGate;
    return nativeFetch(url, { ...init, headers: { ...init?.headers, origin: window.location.origin } });
  });
  try {
    const before = await getAllSnapshot(), user = userEvent.setup(); render(<App/>);
    await screen.findByRole('heading', { name: 'AI Connections' });
    await user.click(screen.getByRole('tab', { name: 'Permissions' }));
    await user.click(screen.getByLabelText('Allow change-set proposals', { exact: true }));
    await user.click(screen.getByRole('button', { name: 'Apply Permissions' }));
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    const address = screen.getByLabelText('Local bridge address'); await user.clear(address); await user.type(address, delayedRelayUrl);
    await user.click(screen.getByRole('button', { name: 'Connect Codex' }));
    await user.click(screen.getByRole('tab', { name: 'Permissions' }));
    const proposal = screen.getByLabelText('Allow change-set proposals', { exact: true });
    expect(proposal).toBeDisabled(); await user.click(proposal); expect(proposal).toBeChecked();
    expect(screen.getByRole('button', { name: 'Minimal Access' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply Permissions' })).toBeDisabled();
    releaseStart(); await user.click(screen.getByRole('tab', { name: 'Connection' }));
    await user.type(await screen.findByLabelText('One-time pairing key'), syntheticKey);
    await user.click(screen.getByRole('button', { name: 'Confirm pairing' }));
    expect(await screen.findByText('Connected', { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Permissions' }));
    expect(screen.getByLabelText('Allow change-set proposals', { exact: true })).toBeChecked();
    expect(await getAllSnapshot()).toEqual(before);
  } finally { releaseStart(); }
}, 15000);
