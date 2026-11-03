import {it,expect} from 'vitest';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {writeRecord} from './fixtures/ensembleStorageFixture';
import {exportFullBackupZip,exportSnapshotBackupZip,restoreFullBackupZip,validateBackupZip,buildBackupManifest} from '../storage/backup';
import {getAllSnapshot} from '../storage/db';
import {detectBackupFeatures} from '../domain/backupFeatures';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {applyFrameImageCommand} from '../storage/frameImages';
import {removeTakeFromProject} from '../domain/projectStoryboard';
const hash=async(blob:Blob)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
it('round trips complete C records, exact manual text, receipts and original file hashes',async()=>{
 const f=await seedKeyframeStorage();f.parent.manualImageOutputs={start:{full:{text:'  EXACT STILL\r\n\tbuffer  ',basedOnVisualDigest:f.parent.imagePromptSnapshots!.start.visualDigest,updatedAt:f.parent.updatedAt}}};f.parent.manualOutputs.full={text:'  EXACT VIDEO\n\tbuffer  ',updatedAt:f.parent.updatedAt,basedOnInputRevision:1};await writeRecord('scenes',f.parent);
 const before=await getAllSnapshot(),zip=await exportFullBackupZip(),files=unzipSync(zip),manifest=JSON.parse(strFromU8(files['manifest.json']));expect(manifest.requiredFeatures).toEqual(['blocking.v1','keyframes.v1']);for(const m of manifest.media)expect(m.sha256).toBe(await hash(before.media.find(row=>row.id===m.id)!.blob));expect((await validateBackupZip(zip)).valid).toBe(true);
 await restoreFullBackupZip(zip);const after=await getAllSnapshot();expect(after.scenes).toEqual(before.scenes);expect(after.drafts).toEqual(before.drafts);expect(after.collections).toEqual(before.collections);expect(after.preferences).toEqual(before.preferences);expect(await Promise.all(after.media.map(m=>hash(m.blob)))).toEqual(await Promise.all(before.media.map(m=>hash(m.blob))));
});
it('requires independent features for history-only and ledger-only libraries after C scenes are removed',async()=>{
 const f=await seedKeyframeStorage(),state=await getAllSnapshot();state.scenes=[];state.drafts=[];state.collections[0].project!.shots=[];state.collections[0].members=[];state.collections[0].project!.frameProduction={version:1,revision:0,imageEvents:[],active:[],videoReviews:[]};state.preferences.aiImports={version:3,receipts:[],candidates:[]};expect(detectBackupFeatures(state)).toEqual(['frame-image-history.v1','change-set.v6-ledger']);expect(buildBackupManifest(state)).toMatchObject({schemaVersion:2,requiredFeatures:['frame-image-history.v1','change-set.v6-ledger']});expect(f.parent.keyframePlan).toBeDefined();
});
it('rejects corrupted C payload bytes and missing feature declarations before replacement',async()=>{
 await seedKeyframeStorage();const original=await exportFullBackupZip(),before=await getAllSnapshot();
 for(const kind of ['media','feature','digest']){const files=unzipSync(original),manifest=JSON.parse(strFromU8(files['manifest.json']));if(kind==='media')files[manifest.media[0].archivePath][0]^=255;if(kind==='feature')manifest.requiredFeatures=['blocking.v1'];if(kind==='digest')delete manifest.media[0].sha256;files['manifest.json']=strToU8(JSON.stringify(manifest));await expect(restoreFullBackupZip(zipSync(files))).rejects.toThrow(/hash|checksum|SHA|feature/i);expect(await getAllSnapshot()).toEqual(before);}
});
it('restores a v6 receipt and replays without recreating the saved take',async()=>{
 const f=await seedKeyframeStorage(),p=await previewChangeSet(f.input,f.approval),receipt=await applyApprovedChangeSet(p,p.approvedDigest),before=await getAllSnapshot(),zip=await exportFullBackupZip();expect(detectBackupFeatures(before)).toContain('change-set.v6-ledger');await restoreFullBackupZip(zip);const replay=await previewChangeSet(f.input);expect(await applyApprovedChangeSet(replay,replay.approvedDigest)).toEqual(receipt);expect((await getAllSnapshot()).scenes).toEqual(before.scenes);
});
it('round trips cleared image history after its source take and all frame plans are gone',async()=>{
 const f=await seedKeyframeStorage(),target={collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0};
 const linked=await applyFrameImageCommand({kind:'link',target,mediaId:f.state.media[0].id});await applyFrameImageCommand({kind:'clear',target:{...target,expectedProjectRevision:linked.project!.revision,expectedAssociationRevision:1}});
 const state=await getAllSnapshot();state.collections=state.collections.map(c=>state.scenes.reduce((current,scene)=>removeTakeFromProject(current,scene.id,[]),c));state.scenes=[];state.drafts=[];state.preferences.activeDraftId=undefined;
 const zip=await exportSnapshotBackupZip(state),checked=await validateBackupZip(zip);expect(checked,checked.error).toMatchObject({valid:true});expect(JSON.parse(strFromU8(unzipSync(zip)['manifest.json'])).requiredFeatures).toEqual(['frame-image-history.v1']);await restoreFullBackupZip(zip);const after=await getAllSnapshot();expect(after.collections).toEqual(state.collections);expect(after.scenes).toEqual([]);expect(after.drafts).toEqual([]);expect(await Promise.all(after.media.map(m=>hash(m.blob)))).toEqual(await Promise.all(state.media.map(m=>hash(m.blob))));
});
