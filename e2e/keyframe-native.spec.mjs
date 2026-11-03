import {test,expect,chromium} from '@playwright/test';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {freshKeyframeNativeBrowser,seedKeyframeNative,keyframeNativePackage,readKeyframeLibrary,configureKeyframeNative,approveKeyframeProposal,grantSavedKeyframe,assertNativeSceneResult,prepareKeyframeNativePairing} from './keyframe-native-fixture.mjs';
import {ownedCliBridgePid,setMcpFlag,selectMcpReceipt,isolatedMcpBrowser,sdkBridge,pairSynthetic} from './local-mcp-fixture.mjs';
import {beginWriteObservation,observedWrites} from './recipe-change-set-fixture.mjs';
import {certifyInstalledCli} from '../scripts/qa/mcp-codex-cli.mjs';
import {assertKeyframeSavedState,verifyKeyframeEvidence} from '../scripts/qa/keyframe-mcp-workflow.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const origin of ['http://127.0.0.1:4173','http://localhost:4173'])test('C native-scenario preflight: real browser grants and atomic scene/ledger checks at '+origin,async()=>{
 test.setTimeout(120000);const {page,context}=await isolatedMcpBrowser(undefined,1,origin),bridge=await sdkBridge({origin});try{
  const ids=await seedKeyframeNative(page),input=keyframeNativePackage(ids,'preflight'),before=await readKeyframeLibrary(page);await page.evaluate(async input=>(await import('/src/domain/changeSetValidation.ts')).parseChangeSet(input),input);await page.goto('/#/');await prepareKeyframeNativePairing(page,ids,'http://127.0.0.1:'+bridge.port);await pairSynthetic(page,bridge,origin);for(const label of ['Allow change-set proposals','Allow blocking proposals','Allow frame plan proposals'])await setMcpFlag(page,label,true);
  const preview=await bridge.call('krakinai_preview_change_set',{changeSet:input,projection:{operationId:'add-middle',keyframeId:'middle',mode:'full'}});console.log('C_NATIVE_PREFLIGHT_DISCLOSURE '+JSON.stringify({frame:preview.data?.keyframes?.frame&&{disclosure:preview.data.keyframes.frame.disclosure,missingDisclosures:preview.data.keyframes.frame.missingDisclosures},operations:preview.data?.keyframes?.operations}));expect(preview).toMatchObject({ok:true,data:{keyframes:{frame:{disclosure:'shared'}}}});const submitted=await bridge.call('krakinai_submit_change_set',{changeSet:input});expect(submitted.ok).toBe(true);await approveKeyframeProposal(page,submitted.data.proposalId);const after=await readKeyframeLibrary(page),receipt=after.preferences.aiImports.receipts.find(r=>r.changeSetId===input.changeSetId),newId=receipt.idMappings['new-take'].id;assertKeyframeSavedState({before,after,target:{projectId:ids.projectId,sceneId:ids.sceneId,shotId:ids.shotId},changeSet:input,newSceneId:newId});await assertNativeSceneResult(before,after,ids,newId);await grantSavedKeyframe(page,newId,'middle');const text=await bridge.call('krakinai_get_generation_prompt',{sceneId:newId,target:{kind:'image',keyframeId:'middle',mode:'full'}});expect(text).toMatchObject({ok:true,data:{text:preview.data.keyframes.frame.text}});
 }finally{await bridge.close();await context.close();}
});
for(const origin of ['http://127.0.0.1:4173','http://localhost:4173'])test(`Keyframes actual installed CLI and signed Windows pairing at ${origin}`,async({},info)=>{
 test.skip(process.platform!=='win32'||process.env.KRAKINAI_NATIVE_QA!=='1'||process.env.KRAKINAI_NATIVE_QA_MANUAL!=='1','Incomplete until separately executed with the signed candidate and manual native confirmation.');test.setTimeout(660000);
 const owned=await freshKeyframeNativeBrowser(origin,{manual:true});let page=owned.page;page.setDefaultTimeout(20000);const attempt=resolve('.superpowers/sdd/2026-11-03-multi-frame-image-prompt-studio-c','native-'+randomUUID());await mkdir(attempt,{recursive:true});let transport,after,afterReplay,savedReceipt,before;const toolReplies=[];
 const phase=async value=>{await writeFile(resolve(attempt,'state.json'),JSON.stringify({syntheticOnly:true,origin,observedCalls:toolReplies.map(r=>({callId:r.callId,tool:r.tool,ok:r.message.ok})),...value},null,2));};
 async function manualPair(label,ids,receipt){
  expect([4177,4180,5173]).not.toContain(transport.port);await prepareKeyframeNativePairing(page,ids,'http://127.0.0.1:'+transport.port,receipt);
  const counts=await readKeyframeLibrary(page);await phase({phase:'awaiting-manual-native-pairing',label,relay:'http://127.0.0.1:'+transport.port,entry:transport.entry,profilePath:owned.target.profilePath,counts:{assets:counts.assets.length,scenes:counts.scenes.length,collections:counts.collections.length}});console.log('KRAKINAI_KEYFRAME_MANUAL_PAIRING '+JSON.stringify({origin,label,relay:'http://127.0.0.1:'+transport.port,state:resolve(attempt,'state.json')}));
  await page.getByRole('button',{name:'Disconnect Codex',exact:true}).waitFor({state:'visible',timeout:540000});await phase({phase:'paired-'+label});
 }
 try{
  const ids=await seedKeyframeNative(page),input=keyframeNativePackage(ids,origin.includes('localhost')?'localhost':'ipv4'),baseline={sourceSceneIds:ids.sourceSceneIds,excludedCanaries:['PRIVATE_KEYFRAME_EXCLUDED_PROJECT']};before=await readKeyframeLibrary(page);await page.evaluate(async input=>(await import('/src/domain/changeSetValidation.ts')).parseChangeSet(input),input);await configureKeyframeNative(page,ids);expect(await readKeyframeLibrary(page)).toEqual(before);await beginWriteObservation(page);let writesBeforeApproval;
  const unchanged=async()=>{expect(await readKeyframeLibrary(page)).toEqual(before);expect(await observedWrites(page)).toEqual([]);};
  const result=await certifyInstalledCli({projectId:ids.projectId,projectName:ids.projectName,excludedProjectId:ids.excludedProjectId,appOrigin:origin,manualApproval:true,
   onReady:async ready=>{transport={...ready,pid:await ownedCliBridgePid(ready.cliPid,ready.port)};await manualPair('initial',ids);await unchanged();},
   workflow:{kind:'keyframes',target:{projectId:ids.projectId,sceneId:ids.sceneId,shotId:ids.shotId},changeSet:input,baseline,onReply:async({step,reply,callId,tool})=>{
    toolReplies.push({callId,tool,message:reply});await phase({phase:'actual-cli-'+step});
    if(['connected','source','permission-denied','permissions-enabled','preview','submitted','pending'].includes(step))await unchanged();
    if(step==='permission-denied')for(const label of ['Allow change-set proposals','Allow blocking proposals','Allow frame plan proposals'])await setMcpFlag(page,label,true);
    if(step==='pending'){
     writesBeforeApproval=await observedWrites(page);await approveKeyframeProposal(page,reply.data.proposalId);after=await readKeyframeLibrary(page);savedReceipt=after.preferences.aiImports.receipts.find(r=>r.changeSetId===input.changeSetId);const newId=savedReceipt.idMappings['new-take'].id,saved=await assertNativeSceneResult(before,after,ids,newId);assertKeyframeSavedState({before,after,target:{projectId:ids.projectId,sceneId:ids.sceneId,shotId:ids.shotId},changeSet:input,newSceneId:newId});baseline.savedImageSha256=hash(saved.imagePromptSnapshots.middle.full);
    }
    if(step==='retried'){
     afterReplay=await readKeyframeLibrary(page);expect(afterReplay).toEqual(after);await phase({phase:'restarting-synthetic-browser',profilePath:owned.target.profilePath});await owned.context.close();owned.context=await chromium.launchPersistentContext(owned.target.profilePath,owned.settings);page=owned.context.pages()[0]??await owned.context.newPage();page.setDefaultTimeout(20000);await page.goto('/#/');expect(await readKeyframeLibrary(page)).toEqual(after);await manualPair('after-browser-restart',ids,savedReceipt);expect(await readKeyframeLibrary(page)).toEqual(after);
    }
    if(step==='new-image-denied')await grantSavedKeyframe(page,savedReceipt.idMappings['new-take'].id,'middle');
    if(step==='new-image'){await page.getByRole('tab',{name:'Connection',exact:true}).click();await page.getByRole('button',{name:'Disconnect Codex',exact:true}).click();await page.getByRole('button',{name:'Disconnect now',exact:true}).click();}
   }},
  });
  expect(result.cliVersion).toBe('0.73.0');expect(result.cliVersionOutput).toBe('codex-cli 0.73.0');expect(result.exitCode).toBe(0);expect(result.callAudit).toHaveLength(17);expect(result.requests).toBe(18);expect(result.providerFailure).toBe('');expect(await readKeyframeLibrary(page)).toEqual(after);
  const evidence={syntheticOnly:true,origin,cliVersion:result.cliVersion,target:{projectId:ids.projectId,sceneId:ids.sceneId,shotId:ids.shotId},changeSet:input,baseline,toolReplies,before,after,afterReplay,noWritesBeforeApproval:true,writesBeforeApproval,fullBrowserRestartVerified:true,explicitNewFrameGrant:true,manualNativeVerification:true,productionEntry:result.stdioEntry,productionEntrySha256:result.stdioEntrySha256,cliExecutableSha256:result.cliExecutableSha256,exitCode:result.exitCode,callAudit:result.callAudit,warning:result.warning,modelProvider:result.modelProvider,rawCliDirectory:result.isolatedHome};await writeFile(resolve(attempt,'keyframe-evidence.json'),JSON.stringify(evidence,null,2));const verified=await verifyKeyframeEvidence(attempt);await writeFile(info.outputPath('keyframe-native-evidence.json'),JSON.stringify(verified,null,2));await phase({phase:'passed',evidence:resolve(attempt,'keyframe-evidence.json')});
 }catch(error){await phase({phase:'failed',error:String(error.message).slice(0,1200)});throw error;}finally{await owned.context.close();}
});
