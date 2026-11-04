import type {ChangeSetPreview} from '../types/changeSet';
import type {AdmissionCode} from './importAdmission';
const messages:Record<AdmissionCode,string>={
 LEDGER_CAPACITY:'This batch exceeds the stored import-history allowance. Review Storage check in KRAKINAI.',
 LEDGER_RECEIPT_CAPACITY:'This batch exceeds the import receipt-count allowance. Existing history was preserved.',
 LEDGER_CANDIDATE_CAPACITY:'This batch exceeds the combined reusable-candidate allowance.',
 RECEIPT_EVIDENCE_CAPACITY:'The complete evidence for this receipt exceeds its expanded-size allowance.',
 LEDGER_EVIDENCE_CAPACITY:'This batch exceeds the aggregate expanded-evidence allowance.',
 BACKUP_METADATA_CAPACITY:'The resulting full-backup metadata exceeds its unchanged allowance.',
 IMPORT_EVIDENCE_INVALID:'Import evidence could not be verified. No batch was applied.',
};
/** Only this authorized proposal's admission outcome; never history measurements/content. */
export function importBatchChecks(preview:ChangeSetPreview|undefined){
 const codes=[...new Set(preview?.plan.findings.filter(f=>f.severity==='blocking').map(f=>/^[A-Z][A-Z0-9_]{0,63}$/.test(f.code)?f.code:'VALIDATION_BLOCKED')??[])];
 const blocked=codes.some(c=>!c.startsWith('APPROVAL_'))||preview?.capacity?.status==='blocked';
 return{version:1,readiness:blocked?'blocked':!preview||!preview.capacity||preview.capacity.status==='not_calculable'?'not_evaluated':'review_required',previewIsSnapshot:true,...(preview?.allocation?.preparedAt?{previewPreparedAt:preview.allocation.preparedAt}:{}),...(preview?.approvedDigest?{previewDigest:preview.approvedDigest}:{}),findings:codes.map(code=>({code,severity:'blocking',message:messages[code as AdmissionCode]??(code.startsWith('APPROVAL_')?'Explicit browser review and approval are required.':'Resolve this proposal finding in KRAKINAI and revalidate before approval.')}))};
}
