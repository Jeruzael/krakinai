import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FullLibraryBackupPanel } from '../components/FullLibraryBackupPanel';

const api = vi.hoisted(() => ({
  commitPreparedBackupRestore: vi.fn(), discardPreparedBackupRestore: vi.fn(), exportFullBackupToStream: vi.fn(), exportFullBackupZip: vi.fn(),
  prepareFullBackupRestore: vi.fn(), resumeFullBackupRestore: vi.fn(), verifyFullBackupFile: vi.fn(), listRestoreStages: vi.fn(), openRestoreStage: vi.fn(),
}));
vi.mock('../storage/backup', () => api);
vi.mock('../storage/restoreStaging', () => api);
const report = { summary: { assetsCount: 2, variantsCount: 1, scenesCount: 3, draftsCount: 4, collectionsCount: 1, templatesCount: 4, mediaCount: 0, totalMediaBytes: 0, exportedAt: '2026-10-26T00:00:00Z' }, compressedBytes: 500, uncompressedBytes: 1000, entries: 1, warnings: [] };
const staged = { ...report, stageId: 'synthetic-stage', baseline: {} };
beforeEach(() => {
  vi.resetAllMocks(); api.listRestoreStages.mockResolvedValue([]);
  api.prepareFullBackupRestore.mockResolvedValue(staged); api.verifyFullBackupFile.mockResolvedValue(report);
  api.commitPreparedBackupRestore.mockResolvedValue(report.summary);
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
});
afterEach(() => cleanup());
const select = (label: string) => fireEvent.change(screen.getByLabelText(label), { target: { files: [new File(['synthetic'], 'backup.zip', { type: 'application/zip' })] } });

it('distinguishes compressed, expanded, media, verified restore and project limits', async () => {
  await act(async () => { render(<FullLibraryBackupPanel />); });
  expect(screen.getByText('Compressed ZIP ceiling')).toBeVisible();
  expect(screen.getByText('Uncompressed backup ceiling')).toBeVisible();
  expect(screen.getByText('Stored media ceiling')).toBeVisible();
  expect(screen.getByText('Currently verified restore ceiling')).toBeVisible();
  expect(screen.getByText(/existing 128 MiB cap/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Export Full Library (ZIP64)' })).toBeDisabled();
  expect(screen.getByText(/Large export is unavailable/)).toBeVisible();
});
it('opens the save picker from the click, streams output, and reports Saved separately from Verified', async () => {
  const writable = { abort: vi.fn() };
  const picker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });
  api.exportFullBackupToStream.mockResolvedValue({ compressedBytes: 123, uncompressedBytes: 100, entries: [] });
  render(<FullLibraryBackupPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Export Full Library (ZIP64)' }));
  expect(picker).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(api.exportFullBackupToStream).toHaveBeenCalledWith(writable, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  expect(await screen.findByText(/Saved 123 bytes/)).toHaveTextContent('Saved does not mean Verified');
  expect(api.exportFullBackupZip).not.toHaveBeenCalled();
});
it('verifies without offering or performing replacement', async () => {
  render(<FullLibraryBackupPanel />); select('Choose a backup to verify');
  expect(await screen.findByText(/Verified: archive structure/)).toBeVisible();
  expect(screen.getByLabelText('Backup validation report')).toHaveTextContent('2 prompts');
  expect(screen.queryByRole('button', { name: 'Confirm & Replace Current Library' })).not.toBeInTheDocument();
  expect(api.commitPreparedBackupRestore).not.toHaveBeenCalled();
});
it('requires an explicit confirmation after staging and makes the completed page reload-required', async () => {
  const reloaded = vi.fn(); window.addEventListener('krakinai-library-reload-required', reloaded, { once: true });
  render(<FullLibraryBackupPanel />); select('Choose a backup to stage for restore');
  const confirm = await screen.findByRole('button', { name: 'Confirm & Replace Current Library' });
  expect(api.commitPreparedBackupRestore).not.toHaveBeenCalled();
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(await screen.findByRole('button', { name: 'Reload Restored Library' })).toBeEnabled();
  expect(api.commitPreparedBackupRestore).toHaveBeenCalledTimes(1); expect(reloaded).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Choose a backup to stage for restore')).toBeDisabled();
});
it('cancels a pending read using the same AbortSignal and restores controls', async () => {
  api.verifyFullBackupFile.mockImplementation((_file, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Verification cancelled.', 'AbortError')), { once: true })));
  const onBusyChange = vi.fn(); render(<FullLibraryBackupPanel onBusyChange={onBusyChange} />);
  select('Choose a backup to verify');
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel Operation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Verification cancelled');
  await waitFor(() => expect(screen.getByLabelText('Choose a backup to verify')).toBeEnabled());
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});
it('retains the recoverable preview after a failed commit', async () => {
  api.commitPreparedBackupRestore.mockRejectedValue(new Error('Library changed in another tab. Revalidate the preview.'));
  render(<FullLibraryBackupPanel />); select('Choose a backup to stage for restore');
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Replace Current Library' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Library changed');
  expect(screen.getByRole('button', { name: 'Discard Preview' })).toBeEnabled();
  expect(api.discardPreparedBackupRestore).not.toHaveBeenCalled();
});
