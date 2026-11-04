import type {
  ChangeSetPlan,
  ChangeSetState,
  ImportLedger,
} from "../types/changeSet";
import { MAX_MANIFEST_BYTES } from "./validation";
import { buildBackupManifest } from "../storage/backup";

import {detectBackupFeatures,hasCBackupFeature} from './backupFeatures';
import {ImportAdmissionError,type ImportCapacity,type ImportCapacityTotals} from './importAdmission';
import {MAX_IMPORT_LEDGER_BYTES,importLedgerExpandedBytes,prospectiveImportLedger,validateImportLedger} from './changeSetLedger';
import {MAX_EXPANDED_IMPORT_EVIDENCE_BYTES} from './importEvidence';
import type {ChangeSetReceipt} from '../types/changeSet';

/** Retain the existing full-backup metadata bound; imported records must remain restorable. */
export function validateChangeSetBackupCapacity(
  state: ChangeSetState,
  plan: ChangeSetPlan,
  ledger: ImportLedger,
  appliedAt: string,
): number {
  const projects = new Map(plan.collections.map((c) => [c.id, c]));
  const snapshot = {
    ...state,
    variants: [...(state.variants ?? []),...(plan.variants??[])],
    drafts: state.drafts ?? [],
    collections: [
      ...state.collections.map((c) => projects.get(c.id) ?? c),
      ...plan.collections.filter(
        (c) => !state.collections.some((before) => before.id === c.id),
      ),
    ],
    scenes: [...state.scenes, ...plan.scenes],
    assets: [...state.assets, ...plan.assets],
    templates: [...state.templates, ...plan.templates],
    preferences: {
      ...state.preferences,
      aiImports: ledger,
      updatedAt: appliedAt,
    },
  };
  const bytes = new TextEncoder().encode(
    JSON.stringify(buildBackupManifest(snapshot, appliedAt), null, 2),
  ).length;
  // Hash fields are filled from real bytes by export; reserve their pretty-JSON
  // size without inventing a checksum in this metadata-only capacity check.
  const checkedBytes=bytes+(hasCBackupFeature(detectBackupFeatures(snapshot))?snapshot.media.reduce((n,m)=>n+96+(m.posterBlob?128:0),0):0);
  if (checkedBytes > MAX_MANIFEST_BYTES)
    throw new ImportAdmissionError('BACKUP_METADATA_CAPACITY',
      `Resulting full-backup metadata would be ${checkedBytes.toLocaleString()} bytes, exceeding the existing 20 MiB backup metadata allowance. Use a smaller batch; no records were changed.`,
    checkedBytes,MAX_MANIFEST_BYTES);
  return checkedBytes;
}

const totals=(ledger:ImportLedger):ImportCapacityTotals=>({storedBytes:new TextEncoder().encode(JSON.stringify(ledger)).length,expandedBytes:importLedgerExpandedBytes(ledger),receipts:ledger.receipts.length,candidates:ledger.candidates.length+(ledger.variantCandidates?.length??0)});
export function assessImportCapacity(state:ChangeSetState,plan:ChangeSetPlan,ledger:ImportLedger,appliedAt:string,receipt?:ChangeSetReceipt):ImportCapacity{
 const result:ImportCapacity={status:receipt?'checked':'not_calculable',current:totals(ledger),limits:{storedBytes:MAX_IMPORT_LEDGER_BYTES,expandedBytes:MAX_EXPANDED_IMPORT_EVIDENCE_BYTES,receipts:1000,candidates:250},backupMetadataLimit:MAX_MANIFEST_BYTES,findings:[]};
 if(!receipt)return result;
 const next=prospectiveImportLedger(ledger,plan,receipt);result.prospective=totals(next);result.receiptBytes=new TextEncoder().encode(JSON.stringify(receipt)).length;
 const checks:[keyof ImportCapacityTotals,import('./importAdmission').AdmissionCode,string][]=[['storedBytes','LEDGER_CAPACITY','Stored import history exceeds its 8 MiB allowance.'],['expandedBytes','LEDGER_EVIDENCE_CAPACITY','Expanded import evidence exceeds its 32 MiB allowance.'],['receipts','LEDGER_RECEIPT_CAPACITY','Import history exceeds its 1,000 receipt allowance.'],['candidates','LEDGER_CANDIDATE_CAPACITY','Combined import candidates exceed their 250-record allowance.']];
 for(const [field,code,message]of checks)if(result.prospective[field]>result.limits[field])result.findings.push({code,severity:'blocking',message:message+' No receipts or candidates were dropped.'});
 try{validateImportLedger(next);}catch(error){if(!(error instanceof ImportAdmissionError))throw error;if(!result.findings.some(f=>f.code===error.code))result.findings.push({code:error.code,severity:'blocking',message:error.message});}
 try{result.backupMetadataBytes=validateChangeSetBackupCapacity(state,plan,next,appliedAt);}catch(error){if(!(error instanceof ImportAdmissionError))throw error;result.backupMetadataBytes=error.measured;result.findings.push({code:error.code,severity:'blocking',message:error.message});}
 if(result.findings.length)result.status='blocked';return result;
}
