import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {responsesToolMessage,toolResponseEvents,findAdvertisedTool,endInstalledThread} from './shared-codex-client.mjs';
import {readCliReply} from './mcp-cli-replies.mjs';
const expected={callId:'actual-call-one',name:'mcp__krakinai__krakinai_connection_status',args:{}};
const input=()=>[{type:'function_call',call_id:expected.callId,name:expected.name,arguments:'{}'},{type:'function_call_output',call_id:expected.callId,output:JSON.stringify({content:[{type:'text',text:JSON.stringify({ok:true,data:{connected:false}})}]})}];
test('normalizes only exact actual Responses call/output pairs',()=>{
 const message=responsesToolMessage({input:input()},expected);assert.equal(message.tool_call_id,expected.callId);assert.equal(readCliReply([message],expected.callId,'status').data.connected,false);
});
test('wrong IDs, duplicate outputs and modified actual call arguments cannot pass',()=>{
 for(const change of [v=>v[1].call_id='wrong',v=>v.push(v[1]),v=>v[0].arguments='{"extra":true}',v=>v[0].name='shell']){const value=input();change(value);assert.throws(()=>responsesToolMessage({input:value},expected));}
});
test('a failed actual response cannot be rescued by a later success or assistant JSON',()=>{
 const value=input();value[1].output=JSON.stringify({ok:false,error:{code:'TOOL_TIMEOUT'}});value.push({...value[1],call_id:'later',output:input()[1].output});
 const message=responsesToolMessage({input:value},expected);assert.throws(()=>readCliReply([message],expected.callId,'status'));
 assert.throws(()=>responsesToolMessage({input:[{type:'message',role:'assistant',content:input()[1].output}]},expected));
});
test('loopback Responses fixture preserves actual function name, call ID and exact arguments',()=>{
 const wanted={...expected,args:{text:'日本語\r\n🎬'}};const events=toolResponseEvents(wanted);
 const done=events.find(e=>e.type==='response.output_item.done').item;
 assert.equal(done.call_id,wanted.callId);assert.equal(done.name,wanted.name);assert.deepEqual(JSON.parse(done.arguments),wanted.args);
 assert.equal(events.at(-1).response.status,'completed');
});
test('selects an actual advertised namespaced tool and rejects fabricated/unrelated names',()=>{
 assert.equal(findAdvertisedTool([{type:'function',name:expected.name}],'krakinai_connection_status'),expected.name);
 assert.equal(findAdvertisedTool([{type:'namespace',name:'mcp__krakinai',tools:[{type:'function',name:'krakinai_connection_status'}]}],'krakinai_connection_status'),'mcp__krakinai.krakinai_connection_status');
 assert.throws(()=>findAdvertisedTool([{type:'function',name:'shell'}],'krakinai_connection_status'));
 assert.throws(()=>findAdvertisedTool([{type:'function',name:expected.name},{type:'function',name:expected.name}],'krakinai_connection_status'));
});
test('namespaced Responses calls use separate namespace and name fields',()=>{
 const wanted={...expected,name:'mcp__krakinai.krakinai_connection_status'};
 const item=toolResponseEvents(wanted).find(e=>e.type==='response.output_item.done').item;
 assert.equal(item.namespace,'mcp__krakinai');assert.equal(item.name,'krakinai_connection_status');
 const body={input:[item,{type:'function_call_output',call_id:wanted.callId,output:input()[1].output}]};
 assert.equal(responsesToolMessage(body,wanted).tool_call_id,wanted.callId);
});
test('normalizes the actual installed Codex input_text timing envelope without merging content',()=>{
 const value=input();value[1].output=[{type:'input_text',text:'Wall time: 0.0058 seconds\nOutput:'},{type:'input_text',text:input()[1].output}];
 const message=responsesToolMessage({input:value},expected);assert.equal(readCliReply([message],expected.callId,'status').data.connected,false);
 for(const mutate of [v=>{v[1].output[0].text='SUCCESS'},v=>{v[1].output.push({type:'input_text',text:'another JSON'})}]){const malformed=structuredClone(value);mutate(malformed);assert.throws(()=>responsesToolMessage({input:malformed},expected));}
});
test('failed startup before a child exists closes its fixture listener and exits', {skip:process.platform!=='win32'}, async()=>{
 const base=resolve('qa-results/shared-mcp-session/startup-cleanup-tests',randomUUID());await mkdir(base,{recursive:true});
 const config=join(base,'settings.json');await writeFile(config,JSON.stringify({formatVersion:1,appOrigin:'http://localhost:5183',relayPort:54189,bridgeDirectory:join(base,'absent-bridge')}));
 const options={executable:join(base,'missing-codex.exe'),directory:join(base,'client'),launcherConfig:config,target:{syntheticOnly:true,origin:'http://localhost:5183',workspaceRoot:base,profilePath:join(base,'synthetic-profile')}};
 const script=`import {startInstalledCodexClient} from ${JSON.stringify(pathToFileURL(resolve('scripts/qa/shared-codex-client.mjs')).href)};try{await startInstalledCodexClient(${JSON.stringify(options)});process.exitCode=2}catch(error){if(error.code!=='ENOENT')throw error;console.log('EXPECTED_SETUP_FAILURE')}`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='',timedOut=false;child.stdout.on('data',b=>{output+=String(b)});child.stderr.resume();
 const timer=setTimeout(()=>{timedOut=true;child.kill()},5000);
 const code=await new Promise((yes,no)=>{child.once('error',no);child.once('close',yes)});clearTimeout(timer);
 assert.equal(timedOut,false,'Failed startup leaked its loopback listener');assert.equal(code,0);assert.match(output,/EXPECTED_SETUP_FAILURE/);
});
test('actual client departure ends the isolated session rather than only unsubscribing notifications',async()=>{
 const calls=[];await endInstalledThread(async(method,params)=>{calls.push({method,params});return method==='thread/unsubscribe'?{status:'notLoaded'}:{}},'owned-synthetic-thread');
 assert.deepEqual(calls,[{method:'thread/archive',params:{threadId:'owned-synthetic-thread'}},{method:'thread/unsubscribe',params:{threadId:'owned-synthetic-thread'}}]);
 const failed=[];await assert.rejects(endInstalledThread(async method=>{failed.push(method);throw Error('archive failed')},'owned-synthetic-thread'));assert.deepEqual(failed,['thread/archive']);
});
