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
  expect(screen.getByRole('checkbox', { name: 'Allow change-set proposals' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Allow new project creation' })).not.toBeChecked();
  expect(await getAllSnapshot()).toEqual(before);
});
it('keeps identity, ordinary text, notes and filenames as separate opt-ins', async () => {
  const user = userEvent.setup(); render(<App />); await screen.findByRole('heading', { name: 'AI Connections' });
  await user.click(screen.getByText('Text and privacy permissions', { selector: 'summary' }));
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
}, 15000);
