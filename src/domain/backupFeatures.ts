export type BackupFeature='blocking.v1'|'change-set.v5-ledger';
export const BACKUP_FEATURES:readonly BackupFeature[]=['blocking.v1','change-set.v5-ledger'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Metadata-only feature selection also covers durable receipts after scenes are removed. */
export function detectBackupFeatures(snapshot:unknown):BackupFeature[]{
 if(!record(snapshot))return [];
 const found=new Set<BackupFeature>();
 for(const key of ['drafts','scenes'])if(Array.isArray(snapshot[key])&&snapshot[key].some(row=>record(row)&&row.blocking!==undefined))found.add('blocking.v1');
 const ledger=record(snapshot.preferences)?snapshot.preferences.aiImports:undefined;
 if(record(ledger)){
  const newReceipt=Array.isArray(ledger.receipts)&&ledger.receipts.some(entry=>record(entry)&&(entry.version===2||entry.changeSetSchema==='krakinai.change-set.v5'));
  if(ledger.version===2||newReceipt)found.add('change-set.v5-ledger');
 }
 return BACKUP_FEATURES.filter(feature=>found.has(feature));
}
export function validateBackupFeatures(manifest:unknown):string|undefined{
 if(!record(manifest)||![1,2].includes(manifest.schemaVersion as number))return 'Unsupported or missing full-backup schemaVersion (expected 1 or 2).';
 const detected=detectBackupFeatures(manifest);
 if(manifest.schemaVersion===1)return detected.length||manifest.requiredFeatures!==undefined?'New backup features require manifest version 2.':undefined;
 const required=manifest.requiredFeatures;
 if(!Array.isArray(required)||!required.length||required.some(value=>!BACKUP_FEATURES.includes(value as BackupFeature))||new Set(required).size!==required.length||required.length!==detected.length||detected.some(feature=>!required.includes(feature)))return 'Unsupported, missing or inconsistent full-backup requiredFeatures.';
}
