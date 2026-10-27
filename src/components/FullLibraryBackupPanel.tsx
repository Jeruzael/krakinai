import React, { useEffect, useRef, useState } from 'react';
import {
  commitPreparedBackupRestore, discardPreparedBackupRestore, exportFullBackupToStream,
  exportFullBackupZip, prepareFullBackupRestore, resumeFullBackupRestore, verifyFullBackupFile,
  type BackupFileReport, type PreparedBackupRestore,
} from '../storage/backup';
import { listRestoreStages, openRestoreStage } from '../storage/restoreStaging';
import { MAX_BACKUP_COMPRESSED_BYTES, MAX_BUFFERED_BACKUP_BYTES, MAX_VERIFIED_RESTORE_BYTES } from '../storage/backupLimits';
import { MAX_BACKUP_UNCOMPRESSED_BYTES, MAX_TOTAL_MEDIA_BYTES } from '../domain/validation';
import type { ArchiveProgress } from '../storage/backupArchive';
import { downloadBlobAsFile } from '../hooks/useObjectUrl';

const mib = (bytes: number) => (bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 });
const failureMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'The backup operation failed.';
type SavePickerWindow = Window & { showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle> };

/** Large output always goes to a writable file. The optional buffered download has its own small cap. */
export const FullLibraryBackupPanel: React.FC<{ onBusyChange?: (busy: boolean) => void }> = ({ onBusyChange }) => {
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<BackupFileReport | null>(null);
  const [prepared, setPrepared] = useState<PreparedBackupRestore | null>(null);
  const [restored, setRestored] = useState(false);
  const [stages, setStages] = useState<Array<{ id: string; state: string }>>([]);
  const [quota, setQuota] = useState<{ quota: number; usage: number } | null>(null);
  const hasPicker = typeof (window as SavePickerWindow).showSaveFilePicker === 'function';
  const refreshStages = async () => {
    try { setStages(await listRestoreStages()); } catch { /* OPFS may be unavailable: actions report the applicable fallback/limit. */ }
  };
  useEffect(() => { void refreshStages(); }, []);
  useEffect(() => {
    let active = true;
    if (typeof navigator.storage?.estimate === 'function') {
      void navigator.storage.estimate().then(estimate => {
        if (active && typeof estimate.quota === 'number' && Number.isFinite(estimate.quota) && typeof estimate.usage === 'number' && Number.isFinite(estimate.usage)) {
          setQuota({ quota: estimate.quota, usage: estimate.usage });
        }
      }).catch(() => { /* An unavailable estimate is not zero available capacity. */ });
    }
    return () => { active = false; };
  }, []);
  useEffect(() => () => { controller.current?.abort(); }, []);

  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (lock.current || restored) return;
    lock.current = true;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); onBusyChange?.(true); setError(''); setMessage(''); setProgress(null);
    try { await work(abort.signal); }
    catch (err) {
      setError(failureMessage(err));
    } finally {
      controller.current = null; lock.current = false; setBusy(false); onBusyChange?.(false);
      await refreshStages();
    }
  };

  const exportToDisk = () => {
    if (lock.current || restored) return;
    // Start the native picker directly in the click gesture, before any asynchronous database read.
    const picker = (window as SavePickerWindow).showSaveFilePicker;
    if (!picker) { setError('Direct file saving is unavailable. Use the explicitly limited small-backup download below, or Chrome/Edge on a secure origin.'); return; }
    let chosen: Promise<FileSystemFileHandle>;
    try {
      chosen = picker.call(window, { suggestedName: `krakinai-backup-${new Date().toISOString().slice(0, 10)}.zip`, types: [{ description: 'KRAKINAI full-library ZIP64 backup', accept: { 'application/zip': ['.zip'] } }] });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open the save dialog.'); return; }
    void run(async signal => {
      const handle = await chosen;
      signal.throwIfAborted();
      const writable = await handle.createWritable();
      try {
        const result = await exportFullBackupToStream(writable, { signal, onProgress: setProgress });
        setMessage(`Saved ${result.compressedBytes.toLocaleString()} bytes. Select the saved file under Verify Existing Backup for an independent readback; Saved does not mean Verified.`);
      } catch (err) { try { await writable.abort(); } catch { /* The streaming engine may already have aborted it. */ } throw err; }
    });
  };

  const readFile = (event: React.ChangeEvent<HTMLInputElement>, mode: 'verify' | 'restore') => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file || lock.current || restored) return;
    void run(async signal => {
      setReport(null);
      if (prepared) { await discardPreparedBackupRestore(prepared); setPrepared(null); }
      const options = { signal, onProgress: setProgress };
      if (mode === 'verify') {
        const verified = await verifyFullBackupFile(file, options);
        setReport(verified); setMessage('Verified: archive structure, extracted sizes, checksums, available hashes, and library associations passed. Live records were not replaced.');
      } else {
        const ready = await prepareFullBackupRestore(file, options);
        setPrepared(ready); setReport(ready);
        setMessage('Validation and staging completed. Review the counts before confirming replacement.');
      }
    });
  };

  return <section aria-label="Full Library Backup" aria-busy={busy}>
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>Full Library Backup</h3>
      <p className="muted-text">All library records and original media, restorable as a version-1 backup. Project Export is a separate selection workflow with its existing 128 MiB cap.</p>
      <dl>
        <dt>Stored media ceiling</dt><dd>{mib(MAX_TOTAL_MEDIA_BYTES)} MiB</dd>
        <dt>Uncompressed backup ceiling</dt><dd>{mib(MAX_BACKUP_UNCOMPRESSED_BYTES)} MiB</dd>
        <dt>Compressed ZIP ceiling</dt><dd>{mib(MAX_BACKUP_COMPRESSED_BYTES)} MiB</dd>
        <dt>Current enforced restore ceiling</dt><dd>{mib(MAX_VERIFIED_RESTORE_BYTES)} MiB uncompressed</dd>
      </dl>
      {MAX_VERIFIED_RESTORE_BYTES < MAX_TOTAL_MEDIA_BYTES && <div className="banner banner-warning" role="note" aria-label="Restore certification limit" style={{ display: 'block' }}>
        <strong>Near-limit full-library restoration is not certified.</strong>
        <p>Restores above {mib(MAX_VERIFIED_RESTORE_BYTES)} MiB expanded are blocked. Large ZIP64 parsing and export tests do not certify replacement of a 5,000 MiB library. Keep a verified external backup and sufficient space for staging, the restored copy, and the existing library.</p>
        <p>The prior 1 GiB capacity run used opaque synthetic media. Representative scene, variant, collection, and playable-media recovery has only been checked at a smaller size.</p>
      </div>}
      {quota ? <p className="form-help">{mib(Math.max(0, quota.quota - quota.usage))} MiB estimated browser quota remaining ({mib(quota.usage)} MiB used of {mib(quota.quota)} MiB).</p> : <p className="form-help">Browser storage quota estimate unavailable.</p>}
      <p className="form-help">This is not a measurement of free NTFS space. Browser quota, destination capacity, and temporary restore space are separate constraints; estimates do not guarantee a successful write.</p>
      <button type="button" className="btn btn-primary" disabled={busy || restored || !hasPicker} onClick={exportToDisk}>Export Full Library (ZIP64)</button>
      {!hasPicker && <p className="form-help">Direct file saving requires a supported browser such as Chrome or Edge on HTTPS/localhost. Large export is unavailable here.</p>}
      <p className="form-help">Destination free space cannot be reliably checked by the browser. FAT32 cannot store individual files of 4 GiB or more. Keep enough space for temporary files and your original library.</p>
      <details><summary>Small-backup compatibility download</summary>
        <p>Explicitly limited to {mib(MAX_BUFFERED_BACKUP_BYTES)} MiB in memory. Larger libraries require direct file saving.</p>
        <button type="button" className="btn btn-secondary" disabled={busy || restored} onClick={() => void run(async signal => {
          signal.throwIfAborted(); const bytes = await exportFullBackupZip({ signal, onProgress: setProgress }); signal.throwIfAborted();
          downloadBlobAsFile(new Blob([bytes as unknown as BlobPart], { type: 'application/zip' }), `krakinai-backup-${new Date().toISOString().slice(0, 10)}.zip`);
          setMessage('Small backup download requested. Browser download completion has not been verified.');
        })}>Download Small Full Backup</button>
      </details>
    </div>

    <div className="card" style={{ marginBottom: 20 }}>
      <h3>Verify Existing Backup</h3>
      <p className="muted-text">Read and validate a ZIP without replacing live records. Checksums and hashes detect corruption; they do not authenticate the author.</p>
      <label className="form-label" htmlFor="verify-full-backup">Choose a backup to verify</label>
      <input id="verify-full-backup" type="file" accept=".zip,application/zip" disabled={busy || restored} onChange={event => readFile(event, 'verify')} />
    </div>

    <div className="card" style={{ marginBottom: 20 }}>
      <h3>Restore Full Library</h3>
      <p className="muted-text">Files are validated in temporary storage before a replacement can be confirmed. An interrupted stage can be reviewed or discarded below. Reload older KRAKINAI tabs before restoring; current-build stale tabs will be prevented from saving after replacement.</p>
      <label className="form-label" htmlFor="restore-full-backup">Choose a backup to stage for restore</label>
      <input id="restore-full-backup" type="file" accept=".zip,application/zip" disabled={busy || restored} onChange={event => readFile(event, 'restore')} />
      {prepared && !restored && <div className="banner banner-warning" style={{ display: 'block', marginTop: 12 }}>
        <strong>Replace the entire library stored in this browser?</strong>
        <p>Export your current library first if you need to retain it. Changes made in another current-build tab invalidate this preview.</p>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void run(async signal => {
          await commitPreparedBackupRestore(prepared, { signal, onProgress: setProgress });
          setRestored(true); setPrepared(null);
          setMessage('Library replacement committed. This page must reload before saving again. Copy any unsaved text from other tabs before reloading them.');
          window.dispatchEvent(new Event('krakinai-library-reload-required'));
        })}>Confirm & Replace Current Library</button>{' '}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { await discardPreparedBackupRestore(prepared); setPrepared(null); setReport(null); setMessage('Temporary restore stage discarded.'); })}>Discard Preview</button>
      </div>}
    </div>

    {busy && <div role="status" aria-live="polite" className="banner banner-info" style={{ display: 'block' }}>
      <p>{progress?.phase || 'Preparing backup operation…'}: {(progress?.completedBytes ?? 0).toLocaleString()} {progress?.phase === 'commit-records' ? 'records' : 'bytes'}{progress?.totalBytes ? ` of ${progress.totalBytes.toLocaleString()}` : ''}</p>
      {progress?.totalBytes && <progress aria-label="Backup operation progress" value={Math.min(progress.completedBytes, progress.totalBytes)} max={progress.totalBytes} />}
      <button type="button" className="btn btn-secondary" onClick={() => controller.current?.abort()}>Cancel Operation</button>
    </div>}
    {error && <p role="alert" className="banner banner-error">{error}</p>}
    {message && <p role="status" className="banner banner-info">{message}</p>}
    {progress?.phase === 'committed-stage-cleanup-required' && <p className="banner banner-warning">Replacement committed, but the temporary stage could not be marked complete. Reload the library and discard that stage; do not apply it again.</p>}
    {report && <div className="card" aria-label="Backup validation report" style={{ marginBottom: 20 }}>
      <h3>Validation report</h3>
      <p>ZIP: {report.compressedBytes.toLocaleString()} bytes ({mib(report.compressedBytes)} MiB). Expanded: {report.uncompressedBytes.toLocaleString()} bytes. {report.entries} archive entries.</p>
      <p>{report.summary.assetsCount} prompts, {report.summary.variantsCount} variants, {report.summary.scenesCount} saved scenes, {report.summary.draftsCount} drafts, {report.summary.collectionsCount} collections, {report.summary.templatesCount} templates, {report.summary.mediaCount} media files.</p>
      <p>Media: {report.summary.totalMediaBytes.toLocaleString()} bytes. Exported: {report.summary.exportedAt}.</p>
      {report.warnings.length > 0 && <ul>{report.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    </div>}
    {stages.filter(stage => stage.id !== prepared?.stageId).length > 0 && <details>
      <summary>Recoverable temporary restore stages</summary>
      <p>Resume rechecks staged files. No stage is automatically applied.</p>
      {stages.filter(stage => stage.id !== prepared?.stageId).map(stage => <div key={stage.id} className="card">
        <p>{stage.id} — {stage.state}</p>
        <button type="button" className="btn btn-secondary" disabled={busy || restored || stage.state !== 'ready'} onClick={() => void run(async signal => {
          const ready = await resumeFullBackupRestore(stage.id, { signal, onProgress: setProgress }); setPrepared(ready); setReport(ready); setMessage('Stage revalidated. Confirm replacement only after reviewing the counts.');
        })}>Revalidate Stage</button>{' '}
        <button type="button" className="btn btn-secondary" disabled={busy || restored} onClick={() => void run(async () => { await (await openRestoreStage(stage.id)).discard(); setMessage('Temporary stage discarded.'); })}>Discard Stage</button>
      </div>)}
    </details>}
    {restored && <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload Restored Library</button>}
  </section>;
};
