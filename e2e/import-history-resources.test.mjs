import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {observeImportMemory} from './import-history-resources.mjs';
const browser=()=>({newBrowserCDPSession:async()=>({send:async name=>name==='SystemInfo.getProcessInfo'?{processInfo:[{id:1}]}:{product:'synthetic-sampler-unit'},detach:async()=>{}})});
for(const fail of [false,true])test('settles the pending memory sample before '+(fail?'reporting a late error':'capturing the peak'),async()=>{
 let start,release,reject;const started=new Promise(yes=>{start=yes;}),gate=new Promise((yes,no)=>{release=yes;reject=no;});let reads=0;
 const running=observeImportMemory(browser(),async()=>{await started;return 'actual work';},{intervalMs:1,readMemory:async()=>{if(++reads===1)return 10;if(reads===2){start();return gate;}return 700;}});
 await started;await delay(0);if(fail)reject(Error('late sampling failure'));else release(900);
 if(fail)await assert.rejects(running,/late sampling failure/);else{const result=await running;assert.equal(result.observation.peakObservedBytes,900);assert(result.observation.sampleCount>=2);}
});
