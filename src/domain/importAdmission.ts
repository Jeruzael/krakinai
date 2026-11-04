export type AdmissionCode='LEDGER_CAPACITY'|'LEDGER_RECEIPT_CAPACITY'|'LEDGER_CANDIDATE_CAPACITY'|'RECEIPT_EVIDENCE_CAPACITY'|'LEDGER_EVIDENCE_CAPACITY'|'BACKUP_METADATA_CAPACITY'|'IMPORT_EVIDENCE_INVALID';
export class ImportAdmissionError extends Error{
 constructor(public code:AdmissionCode,message:string,public measured?:number,public limit?:number){super(message);this.name='ImportAdmissionError';}
}
export interface ImportCapacityTotals{storedBytes:number;expandedBytes:number;receipts:number;candidates:number}
export interface ImportCapacity{
 status:'checked'|'blocked'|'not_calculable';
 current:ImportCapacityTotals;limits:ImportCapacityTotals;
 prospective?:ImportCapacityTotals;receiptBytes?:number;backupMetadataBytes?:number;backupMetadataLimit:number;
 findings:{code:AdmissionCode;severity:'blocking';message:string}[];
}
