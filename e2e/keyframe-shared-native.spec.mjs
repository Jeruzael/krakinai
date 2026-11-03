import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {createServer,connect} from 'node:net';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {freshKeyframeNativeBrowser,seedKeyframeNative,readKeyframeLibrary,configureKeyframeNative} from './keyframe-native-fixture.mjs';
import {setMcpFlag,syntheticMediaHashes} from './local-mcp-fixture.mjs';
import {configureKeyframeMcp} from './keyframe-fixture.mjs';
import {startInstalledCodexClient} from '../scripts/qa/shared-codex-client.mjs';
import {readCliReply} from '../scripts/qa/mcp-cli-replies.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function unusedPort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function isListening(port){return new Promise(resolve=>{const socket=connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.setTimeout(1000,()=>{socket.destroy();resolve(false);});});}
test('Keyframes shared desktop: actual two-client reads survive one departure and last-client loss revokes pairing',async({},info)=>{
 test.skip(process.platform!=='win32'||process.env.KRAKINAI_NATIVE_QA!=='1'||process.env.KRAKINAI_NATIVE_QA_MANUAL!=='1','Separate manual signed-launcher acceptance; not an automated passing substitute.');test.setTimeout(660000);
 const origin='http://localhost:4173',owned=await freshKeyframeNativeBrowser(origin,{manual:true}),page=owned.page,port=await unusedPort(),id=randomUUID().replaceAll('-',''),release=resolve(process.env.KRAKINAI_KEYFRAME_LAUNCHER_RELEASE??'qa-results/desktop-bridge-launcher/releases/keyframe-c-20261104-r1');
 const configDir=resolve(owned.target.workspaceRoot,'shared-settings-'+id),configPath=resolve(configDir,'settings.json');await mkdir(configDir,{recursive:false});const signer=process.env.KRAKINAI_KEYFRAME_QA_SIGNER;if(!/^[A-Fa-f0-9]{40}$/.test(signer??''))throw Error('Explicit synthetic candidate public signer thumbprint required');
 const config={formatVersion:1,installationId:id,nodePath:process.execPath,bridgeDirectory:resolve(release,'bridge'),nativeExecutable:resolve(release,'Krakinai.BridgeLauncher.exe'),approvedSignerThumbprint:signer,appOrigin:origin,relayPort:port};await writeFile(configPath,JSON.stringify(config,null,2),{flag:'wx'});
 let native,client;const calls=[],phasePath=resolve(configDir,'acceptance-state.json');
 try{
  expect([4177,4180,5173]).not.toContain(port);const ids=await seedKeyframeNative(page);await configureKeyframeMcp(page,ids,{proposals:false,text:false,derivation:false});await setMcpFlag(page,'Allow change-set proposals',false);const before=await readKeyframeLibrary(page),mediaHashes=await syntheticMediaHashes(page);
  native=spawn(config.nativeExecutable,['--config',configPath],{windowsHide:false,stdio:['ignore','ignore','ignore']});native.on('error',()=>{});
  const executable=process.env.KRAKINAI_DESKTOP_QA_EXE;if(!executable)throw Error('Explicit installed desktop Codex executable required');client=await startInstalledCodexClient({executable,directory:resolve(owned.target.workspaceRoot,'shared-cli-'+id),target:owned.target,launcherConfig:configPath});
  await client.startThread('alpha');await client.startThread('beta');await page.getByLabel('Local bridge address',{exact:true}).fill('http://127.0.0.1:'+port);
  await writeFile(phasePath,JSON.stringify({syntheticOnly:true,phase:'awaiting-launcher-start-and-native-pairing',origin,relay:'http://127.0.0.1:'+port,configPath,entry:resolve(config.bridgeDirectory,'krakinai-managed-host.mjs'),profilePath:owned.target.profilePath,installedClient:client.metadata},null,2));console.log('KRAKINAI_KEYFRAME_SHARED_MANUAL '+JSON.stringify({origin,relay:'http://127.0.0.1:'+port,state:phasePath}));
  await page.getByRole('button',{name:'Disconnect Codex',exact:true}).waitFor({state:'visible',timeout:540000});expect(await isListening(port)).toBe(true);expect(await readKeyframeLibrary(page)).toEqual(before);
  const invoke=async(label,tool,args,callId)=>{const record=await client.invoke(label,tool,args,callId);expect(record.client).toBe(label);expect(record.callId).toBe(callId);expect(record.tool).toBe(tool);const reply=readCliReply([record.message],callId,tool);expect(reply.ok).toBe(true);calls.push({client:label,callId,tool,argumentsSha256:hash(args),responseSha256:hash(record.message),ok:reply.ok});return reply.data;};
  const first=await invoke('alpha','krakinai_get_scene',{sceneId:ids.sceneId,projection:'keyframes'},'keyframe_alpha_source');expect(first.blocking.disclosure).toBe('shared');expect(first.blocking.plan.version).toBe(1);expect(first.fullPrompt).toBeUndefined();expect(first.keyframes.disclosure).toBe('shared');expect(first.keyframes.plan.frames.map(f=>f.id)).toEqual(['start','end']);
  const peer=await invoke('beta','krakinai_connection_status',{},'keyframe_beta_before');expect(peer).toMatchObject({connected:true,scopeVersion:3,allowProposals:false,allowBlockingProposals:false,allowKeyframeProposals:false});
  await client.closeThread('alpha');await new Promise(r=>setTimeout(r,2100));const survivor=await invoke('beta','krakinai_get_scene',{sceneId:ids.sceneId,projection:'keyframes'},'keyframe_beta_after_alpha_left');expect(survivor).toEqual(first);expect(await isListening(port)).toBe(true);expect(await readKeyframeLibrary(page)).toEqual(before);
  await client.closeThread('beta');await expect.poll(()=>isListening(port),{timeout:20000}).toBe(false);await expect(page.getByRole('button',{name:'Connect Codex',exact:true})).toBeVisible();expect(await readKeyframeLibrary(page)).toEqual(before);expect(await syntheticMediaHashes(page)).toEqual(mediaHashes);
  const summary=client.summary();
  // This installed client attempts these CONNECTs even with zero model turns
  // and no paired browser. Keep them denied; do not report zero attempts.
  expect(summary.blockedExternalAttempts).toBe(summary.blockedDestinations.length);expect(summary.blockedDestinations.every(d=>d.blocked===true&&d.forwarded===false&&d.method==='CONNECT'&&d.port==='443'&&['chatgpt.com','github.com','api.github.com'].includes(d.hostname))).toBe(true);
  expect(summary.fixtureRequests).toBe(calls.length*2);expect(summary.actualCallIds).toEqual(calls.map(c=>c.callId));expect(new Set(calls.map(c=>c.client+':'+c.callId)).size).toBe(3);expect(summary.version).toMatch(/^codex-cli /);
  await writeFile(info.outputPath('keyframe-shared-native-evidence.json'),JSON.stringify({syntheticOnly:true,origin,installedDesktopClient:summary.version,installedDesktopExecutableSha256:summary.executableSha256,implementation:'actual installed Codex app-server / production persistent adapter / unchanged signed native launcher',callAudit:calls,twoInitializedClients:true,oneClientDeparturePreservedAccess:true,lastClientLossRevokedBrowserAndStoppedRelay:true,libraryUnchanged:true,mediaHashes,modelFixtureRequests:summary.fixtureRequests,blockedExternalAttempts:summary.blockedExternalAttempts,blockedDestinations:summary.blockedDestinations,networkObservationLimit:'Only fixture/proxy traffic observed; no system-wide direct-egress capture.',launcherSha256:createHash('sha256').update(await readFile(config.nativeExecutable)).digest('hex')},null,2));await writeFile(phasePath,JSON.stringify({phase:'passed',syntheticOnly:true,origin,evidence:info.outputPath('keyframe-shared-native-evidence.json')},null,2));
 }catch(error){await writeFile(phasePath,JSON.stringify({phase:'failed',error:String(error.message).slice(0,1000),syntheticOnly:true,origin,observedCalls:calls,client:client?.summary()},null,2));throw error;}finally{await client?.close();if(native&&native.exitCode===null)native.kill();await owned.context.close();}
});
