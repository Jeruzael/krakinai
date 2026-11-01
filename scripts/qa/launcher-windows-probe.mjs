// CI diagnostics only. Reuses the production probe; never changes ACLs or policy.
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join,win32} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {availableParallelism} from 'node:os';

export function instrumentProbe(source){
 const probe=source.match(/const probe = String\.raw`([\s\S]*?)`;/)?.[1];
 const start='function AssertPrivate($item,[long]$mask) {',acl='$acl=$item.GetAccessControl()';
 if(!probe?.includes(start)||!probe.includes(acl))throw Error('PROBE_SOURCE_CHANGED');
 const metadata=String.raw`
  $qaCount=0;foreach($qaRule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($qaRule.AccessControlType -eq 'Allow' -and (($qaRule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0) -and ($allowed -notcontains $qaRule.IdentityReference.Value) -and (([long]$qaRule.FileSystemRights -band ($mask -bor 0x50000000)) -ne 0)){$qaCount++}}
  $qaOwner=($allowed -contains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value);$qaReparse=(($item.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0)
  [Console]::Error.WriteLine('QA_GUARD_META {"level":'+$script:qaGuardLevel+',"ownerTrusted":'+$qaOwner.ToString().ToLowerInvariant()+',"reparse":'+$qaReparse.ToString().ToLowerInvariant()+',"mutationRuleCount":'+$qaCount+'}')`;
 return "[Console]::Error.WriteLine('QA_GUARD_PHASE boot')\n$script:qaGuardLevel=0\n"+probe.replace('$control=[long]',"[Console]::Error.WriteLine('QA_GUARD_PHASE identity_loaded')\n$control=[long]").replace('$file=[IO.FileInfo]::new',"[Console]::Error.WriteLine('QA_GUARD_PHASE file_lookup')\n$file=[IO.FileInfo]::new").replace('if(-not $file.Exists',"[Console]::Error.WriteLine('QA_GUARD_PHASE file_loaded')\nif(-not $file.Exists").replace(start,start+"\n  $script:qaGuardLevel++;[Console]::Error.WriteLine('QA_GUARD_LEVEL '+$script:qaGuardLevel)").replace(acl,acl+metadata);
}
export function summarizeProbe({error,stdout='',stderr='',elapsedMs}){
 const ancestors=[];let lastLevel=null,phase=null;
 for(const line of String(stderr).split(/\r?\n/)){
  const progress=line.match(/^QA_GUARD_PHASE (boot|identity_loaded|file_lookup|file_loaded)$/);if(progress)phase=progress[1];
  const stage=line.match(/^QA_GUARD_LEVEL (\d+)$/);if(stage&&Number(stage[1])<=128)lastLevel=Number(stage[1]);
  if(!line.startsWith('QA_GUARD_META '))continue;
  try{const m=JSON.parse(line.slice(14));if(Number.isSafeInteger(m.level)&&m.level>=0&&m.level<=128&&typeof m.ownerTrusted==='boolean'&&typeof m.reparse==='boolean'&&Number.isSafeInteger(m.mutationRuleCount)&&m.mutationRuleCount>=0&&m.mutationRuleCount<=1000)ancestors.push({level:m.level,ownerTrusted:m.ownerTrusted,reparse:m.reparse,mutationRuleCount:m.mutationRuleCount});}catch{}
 }
 return {privateConfiguration:!error&&stdout.trim()==='PRIVATE_CONFIGURATION',elapsedMs,failure:!error?null:error.killed?'timeout':Number.isInteger(error.code)?'process_exit':'process_error',exitCode:!error?0:Number.isInteger(error.code)?error.code:null,killed:error?.killed===true,signal:['SIGTERM','SIGKILL'].includes(error?.signal)?error.signal:null,phase,lastLevel,ancestors};
}
export function observeBoot(carry,bytes){const combined=carry+String(bytes);return {seen:combined.includes('QA_GUARD_PHASE boot'),carry:combined.slice(-256)};}
async function compareInvocation(script,env,endInput){
 const start=Date.now();let spawnMs=null,exitMs=null,closeMs=null,firstMarkerMs=null,partial='';
 return new Promise(accept=>{
  const child=execFile(win32.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{env,timeout:10000,maxBuffer:8192,windowsHide:true},(error,stdout,stderr)=>queueMicrotask(()=>accept({...summarizeProbe({error,stdout,stderr,elapsedMs:Date.now()-start}),spawnMs,firstMarkerMs,exitMs,closeMs})));
  child.once('spawn',()=>{spawnMs=Date.now()-start;});child.once('exit',()=>{exitMs=Date.now()-start;});child.once('close',()=>{closeMs=Date.now()-start;});
  child.stderr?.on('data',bytes=>{const observation=observeBoot(partial,bytes);partial=observation.carry;if(firstMarkerMs===null&&observation.seen)firstMarkerMs=Date.now()-start;});
  if(endInput)child.stdin?.end();
 });
}
async function main(){
 if(process.platform!=='win32'||!process.env.KRAKINAI_PRIVATE_CONFIG_TEST_ROOT)throw Error('OWNED_WINDOWS_FIXTURE_REQUIRED');
 const root=resolve(process.env.KRAKINAI_PRIVATE_CONFIG_TEST_ROOT);await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'preflight-')),config=join(directory,'settings.json');await writeFile(config,'{}');
 const script=instrumentProbe(await readFile(new URL('../../bridge/src/windowsPrivateConfig.ts',import.meta.url),'utf8'));
 const env={KRAKINAI_CONFIGURATION_PATH:config};for(const key of ['SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
 for(let attempt=1;attempt<=2;attempt++)for(const endInput of [false,true]){
  const result=await compareInvocation(script,env,endInput);
  console.log(JSON.stringify({event:'KRAKINAI_CI_PRIVATE_PROBE',logicalProcessors:availableParallelism(),attempt,mode:endInput?'experiment_eof':'production_open',...result}));
  // Experimental success must never substitute for a failed production-equivalent call.
  if(!endInput&&!result.privateConfiguration)process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('KRAKINAI_CI_PROBE_SETUP_FAILED');process.exitCode=1;});
