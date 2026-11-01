import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {instrumentProbe,summarizeProbe} from './launcher-windows-probe.mjs';

test('diagnostics reuse the actual guard while retaining all rejection checks',async()=>{
 const source=await readFile(new URL('../../bridge/src/windowsPrivateConfig.ts',import.meta.url),'utf8');
 const script=instrumentProbe(source);
 for(const guard of ["throw 'CONFIGURATION_ACCESS_UNSAFE'",'$allowed -notcontains $rule.IdentityReference.Value','[IO.FileAttributes]::ReparsePoint','AssertPrivate $file $write'])assert(script.includes(guard));
 assert(script.includes('QA_GUARD_META '));assert(!script.includes('Set-Acl'));assert(!script.includes('SetAccessControl'));
 assert.throws(()=>instrumentProbe('unexpected source'),/PROBE_SOURCE_CHANGED/);
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
