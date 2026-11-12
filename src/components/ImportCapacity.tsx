import type {ImportCapacity as Capacity} from '../domain/importAdmission';
import {MAX_RECEIPT_EVIDENCE_BYTES} from '../domain/importEvidence';
const size=(bytes:number)=>bytes<1024?`${bytes} bytes`:bytes<1024*1024?`${(bytes/1024).toFixed(2)} KiB`:`${(bytes/(1024*1024)).toFixed(2)} MiB`;
export function ImportCapacity({capacity:c}:{capacity?:Capacity}){
 return <section className="import-capacity" aria-label="Import storage capacity" style={{padding:'12px',border:'1px solid var(--border-color, #dce5f2)',borderRadius:10,marginBottom:12}}>
  <h4 style={{margin:'0 0 6px'}}>Storage check</h4>
  {!c?<p className="muted-text">Revalidate to calculate current storage capacity.</p>:<>
   <p role="status">{c.status==='checked'?'Fits current preview; review and final recheck required.':c.status==='not_calculable'?'Not yet calculable: resolve the listed choices, then revalidate.':'Storage limits block this batch. Existing history is preserved.'}</p>
   <p className="muted-text">Import history: {size(c.current.storedBytes)} / {size(c.limits.storedBytes)} · {size(Math.max(0,c.limits.storedBytes-c.current.storedBytes))} remaining now.</p>
   {c.backupMetadataBytes!==undefined&&<p className="muted-text">Backup metadata after import: at most {size(c.backupMetadataBytes)} / {size(c.backupMetadataLimit)} (checksum reservation included).</p>}
   <details><summary>Usage and limits</summary>
    {c.prospective?<><p>This receipt: {size(c.receiptBytes??0)} stored; {size(Math.max(0,c.prospective.expandedBytes-c.current.expandedBytes))} expanded / {size(MAX_RECEIPT_EVIDENCE_BYTES)} per receipt. History after import: {size(c.prospective.storedBytes)}; {size(Math.max(0,c.limits.storedBytes-c.prospective.storedBytes))} remaining.</p><p>Exact stored bytes: {c.current.storedBytes.toLocaleString()} now → {c.prospective.storedBytes.toLocaleString()} / {c.limits.storedBytes.toLocaleString()} after import.</p><p>Expanded review evidence: {size(c.current.expandedBytes)} now → {size(c.prospective.expandedBytes)} / {size(c.limits.expandedBytes)} after import.</p><p>Receipts after import: {c.prospective.receipts} / {c.limits.receipts}. Combined candidates: {c.prospective.candidates} / {c.limits.candidates}.</p></>:<p>Prospective totals are unavailable until the required choices resolve.</p>}
    <p className="muted-text">Capacity is not reserved. Another tab can change it. No receipt is removed automatically.</p>
   </details>
   {c.findings.length>0&&<ul role="alert">{c.findings.map(f=><li key={f.code}>{f.code}: {f.message}</li>)}</ul>}
  </>}
 </section>;
}
