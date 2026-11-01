import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {instrumentProbe,summarizeProbe,observeBoot} from './launcher-windows-probe.mjs';

test('diagnostics reuse the actual guard while retaining all rejection checks',async()=>{
 const source=await readFile(new URL('../../bridge/src/windowsPrivateConfig.ts',import.meta.url),'utf8');
 const script=instrumentProbe(source);
 for(const guard of ["throw 'CONFIGURATION_ACCESS_UNSAFE'",'$allowed -notcontains $rule.IdentityReference.Value','[IO.FileAttributes]::ReparsePoint','AssertPrivate $file $write'])assert(script.includes(guard));
 assert(script.includes('QA_GUARD_META '));assert(!script.includes('Set-Acl'));assert(!script.includes('SetAccessControl'));
 assert(script.includes('QA_GUARD_PHASE boot'));assert(script.indexOf('QA_GUARD_PHASE boot')<script.indexOf('$allowed='));
 assert(script.includes('QA_GUARD_PHASE file_lookup'));assert(script.indexOf('QA_GUARD_PHASE file_lookup')<script.indexOf('$file=Get-Item'));
 assert.throws(()=>instrumentProbe('unexpected source'),/PROBE_SOURCE_CHANGED/);
});
test('only fixed execution phase names are exposed',()=>{
 const result=summarizeProbe({stdout:'',stderr:'QA_GUARD_PHASE boot\nQA_GUARD_PHASE file_lookup\nQA_GUARD_PHASE SYNTHETIC_PRIVATE_SENTINEL',elapsedMs:10000,error:{killed:true}});
 assert.equal(result.phase,'file_lookup');assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_SENTINEL'));
});
test('boot timing detects split markers followed by a large coalesced stderr chunk',()=>{
 const first=observeBoot('','QA_GUARD_PHASE bo');assert.equal(first.seen,false);
 const next=observeBoot(first.carry,'ot\n'+'x'.repeat(1024));assert.equal(next.seen,true);assert(next.carry.length<=256);
});
test('probe failure diagnostics expose timing and fixed metadata without raw stderr or paths',()=>{
 const secret='SYNTHETIC_PRIVATE_SENTINEL';
 const result=summarizeProbe({error:{killed:true,signal:'SIGTERM',code:secret,message:secret},stdout:secret,stderr:secret+'\nQA_GUARD_META '+JSON.stringify({level:2,ownerTrusted:true,reparse:false,mutationRuleCount:0,privatePath:secret}),elapsedMs:10008});
 assert.equal(result.failure,'timeout');assert.equal(result.privateConfiguration,false);assert.equal(result.elapsedMs,10008);
 assert.deepEqual(result.ancestors,[{level:2,ownerTrusted:true,reparse:false,mutationRuleCount:0}]);assert(!JSON.stringify(result).includes(secret));
});
test('only actual successful guard output counts as a successful preflight',()=>{
 assert.equal(summarizeProbe({stdout:'PRIVATE_CONFIGURATION\r\n',stderr:'',elapsedMs:400}).privateConfiguration,true);
 assert.equal(summarizeProbe({stdout:'PRIVATE_CONFIGURATION',stderr:'',elapsedMs:400}).exitCode,0);
 assert.equal(summarizeProbe({error:{code:1},stdout:'PRIVATE_CONFIGURATION',stderr:'',elapsedMs:400}).privateConfiguration,false);
 assert.equal(summarizeProbe({stdout:'SYNTHETIC SUCCESS',stderr:'QA_GUARD_META {"private":"hidden"}',elapsedMs:400}).privateConfiguration,false);
});
