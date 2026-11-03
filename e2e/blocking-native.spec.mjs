import {test,expect,chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {freshBlockingNativeBrowser,seedBlockingNative,blockingNativePackage,readBlockingNativeLibrary,configureBlockingNative,approveBlockingNative} from './blocking-native-fixture.mjs';
import {syntheticMediaHashes,ownedCliBridgePid,nativeWindowDecision,enterPairingKey,setMcpFlag} from './local-mcp-fixture.mjs';
import {certifyInstalledCli} from '../scripts/qa/mcp-codex-cli.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
for(const origin of ['http://127.0.0.1:4173','http://localhost:4173'])test(`Blocking actual installed CLI and signed Windows pairing at ${origin}`,async({},info)=>{
 test.skip(process.platform!=='win32'||process.env.KRAKINAI_NATIVE_QA!=='1','Acceptance incomplete unless separately run with a Valid signed helper/driver and isolated native pairing.');test.setTimeout(660000);
 const manual=process.env.KRAKINAI_NATIVE_QA_MANUAL==='1',owned=await freshBlockingNativeBrowser(origin,{manual}),page=owned.page;page.setDefaultTimeout(20000);let restarted;
 const attempt=resolve('.superpowers/sdd/2026-11-03-shot-blocking-spatial-continuity-b','native-'+randomUUID());await mkdir(attempt,{recursive:true});
 const observedCalls=[];
 const phase=async value=>{await writeFile(resolve(attempt,'state.json'),JSON.stringify({syntheticOnly:true,origin,manual,observedCalls,...value},null,2));};
 try{
  const ids=await seedBlockingNative(page),input=blockingNativePackage(ids,origin.includes('localhost')?'localhost':'ipv4'),before=await readBlockingNativeLibrary(page),mediaHashes=await syntheticMediaHashes(page),oldSceneHashes=Object.fromEntries(before.scenes.map(s=>[s.id,hash(JSON.stringify(s))]));await configureBlockingNative(page,ids);expect(await readBlockingNativeLibrary(page)).toEqual(before);let noWriteChecks=0,after,savedReceipt;
  const unchanged=async()=>{expect(await readBlockingNativeLibrary(page)).toEqual(before);expect(await syntheticMediaHashes(page)).toEqual(mediaHashes);noWriteChecks++;};
  const result=await certifyInstalledCli({projectId:ids.projectId,projectName:ids.projectName,excludedProjectId:ids.excludedProjectId,appOrigin:origin,manualApproval:manual,
   onReady:async({cliPid,port,entry})=>{
    expect([4177,4180,5173]).not.toContain(port);const pid=await ownedCliBridgePid(cliPid,port);await page.getByLabel('Local bridge address',{exact:true}).fill('http://127.0.0.1:'+port);
    if(manual){await phase({phase:'awaiting-manual-native-pairing',bridgePid:pid,relay:'http://127.0.0.1:'+port,entry,profilePath:owned.target.profilePath,counts:{assets:before.assets.length,scenes:before.scenes.length,collections:before.collections.length}});console.log('KRAKINAI_BLOCKING_MANUAL_PAIRING '+JSON.stringify({origin,relay:'http://127.0.0.1:'+port,state:resolve(attempt,'state.json')}));await page.getByRole('button',{name:'Disconnect Codex',exact:true}).waitFor({state:'visible',timeout:540000});}
    else{await page.getByRole('button',{name:'Connect Codex',exact:true}).click();const code=await page.locator('.ai-verification').textContent(),native=await nativeWindowDecision({pid,entry,port,code,origin});expect(native.verified&&native.allowed).toBe(true);await enterPairingKey(page,native.secret);native.secret='';await page.getByRole('button',{name:'Confirm pairing',exact:true}).click();await expect(page.getByRole('button',{name:'Disconnect Codex',exact:true})).toBeVisible();}
    await unchanged();await phase({phase:'paired-running-actual-cli'});
   },workflow:{kind:'blocking',target:{projectId:ids.projectId,sceneId:ids.sceneId,shotId:ids.shotId},changeSet:input,baseline:{sourceSceneIds:ids.sourceSceneIds,excludedCanaries:['PRIVATE_BLOCKING_EXCLUDED_PROJECT']},onReply:async({step,reply,callId,tool})=>{
    observedCalls.push({callId,tool,step,ok:reply.ok,errorCode:reply.error?.code??null,replySha256:hash(JSON.stringify(reply))});await phase({phase:'actual-cli-'+step});
    if(['connected','source','permission-denied','permissions-enabled','preview','submitted','pending'].includes(step))await unchanged();
    if(step==='permission-denied')await setMcpFlag(page,'Allow blocking proposals',true);
    if(step==='pending'){
     await approveBlockingNative(page,reply.data.proposalId);after=await readBlockingNativeLibrary(page);savedReceipt=after.preferences.aiImports.receipts.find(r=>r.changeSetId===input.changeSetId);const newId=savedReceipt.idMappings['new-turn'].id,scene=after.scenes.find(s=>s.id===newId),source=before.scenes.find(s=>s.id===ids.sceneId);
     expect(after.scenes.filter(s=>s.id!==newId)).toEqual(before.scenes);expect(scene.slots).toEqual(source.slots);expect(scene.ensemble).toEqual(source.ensemble);expect(scene.blocking.participants[1]).toEqual(source.blocking.participants[1]);expect(scene.manualOutputs).toEqual({});expect(scene.outputs.full).toContain('Aya turns toward the chapel door.');expect(source.outputs.full).toContain('SYNTHETIC ORIGINAL MANUAL VIDEO');expect(scene.referencePack).toEqual(source.referencePack);expect(scene.references).toEqual(source.references);expect(after.collections.find(c=>c.id===ids.projectId).project.shots.find(s=>s.id===ids.shotId).selectedSceneId).toBe(ids.sceneId);
     for(const key of ['assets','variants','templates','drafts','media'])expect(after[key]).toEqual(before[key]);expect(await syntheticMediaHashes(page)).toEqual(mediaHashes);
    }
    if(step==='retried')expect(await readBlockingNativeLibrary(page)).toEqual(after);
    if(step==='new-full-denied'){await page.getByRole('tab',{name:'Connection',exact:true}).click();await page.getByRole('button',{name:'Disconnect Codex',exact:true}).click();await page.getByRole('button',{name:'Disconnect now',exact:true}).click();await expect(page.getByRole('button',{name:'Connect Codex',exact:true})).toBeVisible();}
   }},
  });
  expect(result.cliVersionOutput).toBe('codex-cli 0.73.0');expect(result.cliVersion).toBe('0.73.0');expect(result.exitCode).toBe(0);expect(result.callAudit).toHaveLength(15);expect(result.requests).toBe(16);expect(result.providerFailure).toBe('');expect(noWriteChecks).toBeGreaterThanOrEqual(8);expect(result.newSceneIds).toEqual([savedReceipt.idMappings['new-turn'].id]);expect(await readBlockingNativeLibrary(page)).toEqual(after);
  const opposite=await owned.context.newPage();await opposite.goto(origin.includes('localhost')?'http://127.0.0.1:4173':'http://localhost:4173');const empty=await readBlockingNativeLibrary(opposite);for(const key of ['assets','variants','scenes','collections','media','drafts'])expect(empty[key]).toHaveLength(0);await opposite.close();
  await owned.context.close();restarted=await chromium.launchPersistentContext(owned.target.profilePath,{headless:true,baseURL:origin,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});const again=restarted.pages()[0]??await restarted.newPage();await again.goto('/#/');expect(await readBlockingNativeLibrary(again)).toEqual(after);expect(await syntheticMediaHashes(again)).toEqual(mediaHashes);for(const [id,digest]of Object.entries(oldSceneHashes))expect(hash(JSON.stringify(after.scenes.find(s=>s.id===id)))).toBe(digest);
  const evidence={syntheticOnly:true,origin,manualNativeVerification:manual,implementation:result.implementation,cliVersionOutput:result.cliVersionOutput,cliExecutableSha256:result.cliExecutableSha256,stdioEntrySha256:result.stdioEntrySha256,exitCode:result.exitCode,callAudit:result.callAudit,sourceSceneId:ids.sceneId,newSceneIds:result.newSceneIds,packageDigest:result.packageDigest,approvedDigest:result.approvedDigest,noWriteChecks,oldSceneHashes,mediaHashes,immutableSourcePreserved:true,preferredPreserved:true,manualChoice:'canonical explicitly selected in browser',otherParticipantsPreserved:true,crossOriginEmpty:true,fullBrowserRestartVerified:true,revoked:true,warning:result.warning};await writeFile(info.outputPath('blocking-native-evidence.json'),JSON.stringify(evidence,null,2));await phase({phase:'passed',evidence:info.outputPath('blocking-native-evidence.json')});
 }catch(error){await phase({phase:'failed',error:String(error.message).slice(0,1000)});throw error;}finally{await restarted?.close();await owned.context.close();}
});
