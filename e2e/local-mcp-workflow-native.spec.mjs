import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isolatedMcpBrowser, nativeWindowDecision, enterPairingKey, selectMcpRecord, syntheticMediaHashes, ownedCliBridgePid, approveMcpContent } from './local-mcp-fixture.mjs';
import { seedChangeSet, readChangeLibrary, changeSetSample } from './change-set-fixture.mjs';
import { certifyInstalledCli } from '../scripts/qa/mcp-codex-cli.mjs';

const tools = ['krakinai_connection_status','krakinai_submit_change_set','krakinai_get_proposal_status','krakinai_get_import_receipt','krakinai_submit_change_set','krakinai_connection_status','krakinai_get_project','krakinai_get_proposal_status','krakinai_submit_change_set'];
for (const appOrigin of ['http://127.0.0.1:4173','http://localhost:4173']) {
  test(`actual CLI complete revision workflow at ${appOrigin}`, async () => {
    test.skip(process.platform !== 'win32' || process.env.KRAKINAI_NATIVE_QA !== '1', 'Requires actual installed CLI and Valid signed Windows verifier/driver; no injected verifier.');
    test.setTimeout(180000);
    const { context, page } = await isolatedMcpBrowser({width:1440,height:900},1,appOrigin);
    try {
      const ids=await seedChangeSet(page),before=await readChangeLibrary(page),hashes=await syntheticMediaHashes(page),sample=await changeSetSample();
      const project=before.collections.find(p=>p.id===ids.collectionId),original=before.scenes.find(s=>s.id===ids.sceneId);
      const text='Synthetic installed-CLI Shot05 revision.\r\nKeep identity and references unchanged.  日本語 / Tagalog.\n';
      const changeSet={schema:sample.schema,changeSetId:`synthetic-cli-complete-${appOrigin.includes('localhost')?'localhost':'ipv4'}`,source:sample.source,operations:[{operationId:'revise05',type:'scene.revise',clientRef:'revision',sceneId:original.id,expectedHeadId:original.id,project:{id:project.id,expectedRevision:project.project.revision},shot:{id:ids.shotId},prompt:{version:1,text,origin:'chatgpt'}}]};
      let approved,receipt,relayPort,submitted=false,readReceipt=false,retried=false,disconnected=false,noWriteChecks=0,otherOriginEmpty=false;
      await page.goto('/#/connections/ai');expect(await page.evaluate(()=>location.origin)).toBe(appOrigin);
      await selectMcpRecord(page,'Projects','MIDORI');await page.getByLabel('Allow change-set proposals',{exact:true}).check();
      const result=await certifyInstalledCli({projectId:project.id,projectName:project.name,excludedProjectId:ids.dramaId,appOrigin,
        onReady:async({cliPid,port,entry})=>{
          relayPort=port;const pid=await ownedCliBridgePid(cliPid,port);
          await page.getByLabel('Local bridge address',{exact:true}).fill(`http://127.0.0.1:${port}`);
          await page.getByRole('button',{name:'Connect Codex',exact:true}).click();
          const code=await page.locator('.ai-verification').textContent(),native=await nativeWindowDecision({pid,entry,port,code,origin:appOrigin});
          expect(native.verified&&native.allowed).toBe(true);await enterPairingKey(page,native.secret);native.secret='';
          await page.getByRole('button',{name:'Confirm pairing',exact:true}).click();await expect(page.getByRole('button',{name:'Disconnect Codex',exact:true})).toBeVisible();
        },
        workflow:{changeSet,onReply:async({step,reply})=>{
          if(step==='submitted'){
            await expect(page.getByRole('button',{name:'Review proposal',exact:true})).toBeVisible();
            expect(await readChangeLibrary(page)).toEqual(before);expect(await syntheticMediaHashes(page)).toEqual(hashes);noWriteChecks++;submitted=true;
            await page.getByRole('button',{name:'Review proposal',exact:true}).click();
            await expect(page.getByRole('heading',{name:'Change-set preview',exact:true})).toBeVisible();
            expect(await readChangeLibrary(page)).toEqual(before);noWriteChecks++;
            await approveMcpContent(page,{beforeApply:async()=>{expect(await readChangeLibrary(page)).toEqual(before);noWriteChecks++;}});
            approved=await readChangeLibrary(page);receipt=approved.preferences.aiImports.receipts.find(r=>r.changeSetId===changeSet.changeSetId);
            expect(receipt.packageDigest).toBe(reply.data.packageDigest);const savedId=receipt.idMappings.revision.id;
            expect(approved.scenes).toHaveLength(before.scenes.length+1);expect(approved.scenes.find(s=>s.id===original.id)).toEqual(original);
            expect(approved.scenes.filter(s=>s.id!==savedId)).toEqual(before.scenes);
            for(const key of Object.keys(before).filter(k=>!['scenes','collections','preferences'].includes(k)))expect(approved[key]).toEqual(before[key]);
            const saved=approved.scenes.find(s=>s.id===savedId);
            expect(saved.outputs.full).toBe(text);expect(saved.sceneRevision.parentSceneId).toBe(original.id);expect(saved.sceneRevision.rootSceneId).toBe(original.sceneRevision?.rootSceneId??original.id);
            expect(saved.sceneRevision.sequence).toBeGreaterThan(original.sceneRevision?.sequence??0);
            expect(approved.collections.filter(p=>p.id!==project.id)).toEqual(before.collections.filter(p=>p.id!==project.id));
            const selected=approved.collections.find(p=>p.id===project.id).project.shots.find(s=>s.id===ids.shotId);
            expect(selected.selectedSceneId).toBe(project.project.shots.find(s=>s.id===ids.shotId).selectedSceneId);
            expect(selected.takeSceneIds).toEqual([...project.project.shots.find(s=>s.id===ids.shotId).takeSceneIds,savedId]);expect(await syntheticMediaHashes(page)).toEqual(hashes);
            expect(approved.preferences.aiImports.receipts.filter(r=>r.changeSetId===changeSet.changeSetId)).toHaveLength(1);
          }
          if(step==='applied'||step==='receipt'){
            const actual=step==='receipt'?reply.data:reply.data.receipt;
            expect(actual.idMappings).toEqual(receipt.idMappings);expect(actual.operations).toEqual(receipt.operations);expect(actual.packageDigest).toBe(receipt.packageDigest);
            expect(actual.approvedDigest).toBe(receipt.approvedDigest);if(step==='receipt')readReceipt=true;
          }
          if(step==='retried'){
            expect(await readChangeLibrary(page)).toEqual(approved);expect(await syntheticMediaHashes(page)).toEqual(hashes);retried=true;
            await page.getByRole('button',{name:'Disconnect Codex',exact:true}).click();
            const revoke=page.waitForResponse(r=>r.url()===`http://127.0.0.1:${relayPort}/v1/session/revoke`&&r.status()===200);
            await page.getByRole('dialog',{name:'Disconnect Codex?',exact:true}).getByRole('button',{name:'Disconnect now',exact:true}).click();await revoke;
            await expect(page.getByRole('button',{name:'Connect Codex',exact:true})).toBeVisible();disconnected=true;
          }
        }}
      });
      expect(result.selectedTools.map(n=>n.split('__').at(-1))).toEqual(tools);
      expect(result).toMatchObject({cliVersion:'0.73.0',exitCode:0,workflowVerified:true,requests:10,providerFailure:''});
      expect([submitted,readReceipt,retried,disconnected]).toEqual([true,true,true,true]);
      expect(await readChangeLibrary(page)).toEqual(approved);expect(await syntheticMediaHashes(page)).toEqual(hashes);
      if(appOrigin.includes('localhost')){
        const other=await context.newPage();await other.goto('http://127.0.0.1:4173/#/');const isolated=await readChangeLibrary(other);
        expect(isolated.scenes).toHaveLength(0);expect(isolated.collections).toHaveLength(0);otherOriginEmpty=true;await other.close();
        await page.reload();expect(await readChangeLibrary(page)).toEqual(approved);
      }
      const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const after=await readChangeLibrary(page),newId=receipt.idMappings.revision.id,shot=after.collections.find(p=>p.id===project.id).project.shots.find(s=>s.id===ids.shotId);
      const observation={applicationOrigin:appOrigin,cliEvidenceDirectory:result.isolatedHome,changeSetId:changeSet.changeSetId,proposalId:result.proposalId,newSceneId:newId,receiptSavedId:result.sceneId,oldSceneId:original.id,oldSceneSha256Before:hash(original),oldSceneSha256After:hash(after.scenes.find(s=>s.id===original.id)),preferredTakeBefore:project.project.shots.find(s=>s.id===ids.shotId).selectedSceneId,preferredTakeAfter:shot.selectedSceneId,sceneCountBefore:before.scenes.length,sceneCountAfter:after.scenes.length,receiptCount:after.preferences.aiImports.receipts.filter(r=>r.changeSetId===changeSet.changeSetId).length,noDatabaseWritesBeforeApprovalChecks:noWriteChecks,mediaHashesBefore:hashes,mediaHashesAfter:await syntheticMediaHashes(page),retrySnapshotUnchanged:retried,revocationAcknowledged:disconnected,otherOriginEmpty,callAudit:result.callAudit};
      expect(observation.newSceneId).toBe(observation.receiptSavedId);expect(observation.noDatabaseWritesBeforeApprovalChecks).toBe(3);
      await writeFile(`qa-results/local-mcp/workflow-browser-${appOrigin.includes('localhost')?'localhost':'ipv4'}-${randomUUID()}.json`,JSON.stringify(observation,null,2)+'\n',{flag:'wx'});
    } finally { await context.close(); }
  });
}
