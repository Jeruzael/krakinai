import {it,expect} from 'vitest';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {exportFullBackupZip,exportSnapshotBackupZip,restoreFullBackupZip,validateBackupZip} from '../storage/backup';
import {hasCBackupFeature} from '../domain/backupFeatures';
import {validateChangeSetBackupCapacity} from '../domain/changeSetCapacity';
import rasters from './fixtures/frame-raster-fixtures.json';
it('feature-gates compact history and restores its exact receipts and saved outputs',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval);await applyApprovedChangeSet(p,p.approvedDigest);
 const before=await getAllSnapshot(),archive=await exportFullBackupZip(),manifest=JSON.parse(strFromU8(unzipSync(archive)['manifest.json']));
 expect(manifest.schemaVersion).toBe(2);expect(manifest.requiredFeatures).toContain('compact-import-evidence.v1');expect((await validateBackupZip(archive)).valid).toBe(true);
 await restoreFullBackupZip(archive);const after=await getAllSnapshot();expect(after.scenes).toEqual(before.scenes);expect(after.preferences.aiImports).toEqual(before.preferences.aiImports);
 expect((await previewChangeSet(f.input)).replay).toEqual(before.preferences.aiImports!.receipts[0]);
});
it('rejects hash corruption and omitted compact features before any replacement',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval);await applyApprovedChangeSet(p,p.approvedDigest);const before=await getAllSnapshot(),archive=await exportFullBackupZip();
 for(const failure of ['hash','feature']){const entries=unzipSync(archive),manifest=JSON.parse(strFromU8(entries['manifest.json']));if(failure==='hash')manifest.preferences.aiImports.receipts[0].reviewedEvidence.sha256='0'.repeat(64);else manifest.requiredFeatures=manifest.requiredFeatures.filter((v:string)=>v!=='compact-import-evidence.v1');entries['manifest.json']=strToU8(JSON.stringify(manifest));let message='';try{await restoreFullBackupZip(zipSync(entries));}catch(error){message=(error as Error).message;}expect(message).toMatch(/hash|feature|evidence/i);expect(await getAllSnapshot()).toEqual(before);}
});
it('retains media/poster hashes and their reservation in compact-only history backups',async()=>{
 await seedKeyframeStorage();const state=await getAllSnapshot();state.scenes=[];state.drafts=[];state.collections=[];delete state.preferences.activeDraftId;state.preferences.aiImports={version:4,receipts:[],candidates:[]};
 const file=state.media[0],jpeg=rasters.files.find(r=>r.mime==='image/jpeg')!;file.posterBlob=new Blob([Uint8Array.from(atob(jpeg.base64),c=>c.charCodeAt(0))],{type:'image/jpeg'});
 expect(hasCBackupFeature(['compact-import-evidence.v1'])).toBe(true);
 const zip=await exportSnapshotBackupZip(state),entries=unzipSync(zip),manifest=JSON.parse(strFromU8(entries['manifest.json']));expect(manifest.requiredFeatures).toEqual(['compact-import-evidence.v1']);expect(manifest.media[0].sha256).toMatch(/^[a-f0-9]{64}$/);expect(manifest.media[0].posterSha256).toMatch(/^[a-f0-9]{64}$/);
 expect((await validateBackupZip(zip)).valid).toBe(true);
 const bytes=validateChangeSetBackupCapacity(state,{assets:[],variants:[],scenes:[],templates:[],collections:[],candidates:[]} as any,state.preferences.aiImports,'2026-11-05T00:00:00Z');expect(bytes).toBeGreaterThanOrEqual(new TextEncoder().encode(JSON.stringify(manifest,null,2)).length);
 for(const field of ['archivePath','posterArchivePath']){const altered=unzipSync(zip);altered[manifest.media[0][field]][0]^=255;expect((await validateBackupZip(zipSync(altered))).valid).toBe(false);}
});
