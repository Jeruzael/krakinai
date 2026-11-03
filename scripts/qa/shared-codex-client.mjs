// Owned synthetic acceptance only: installed app-server, fresh home, loopback Responses fixture.
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {assertSyntheticTarget} from './shared-mcp-workflow.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};};
export function blockedDestination(request){
  const method=['CONNECT','GET','POST','PUT','DELETE','HEAD','OPTIONS'].includes(request.method)?request.method:'OTHER';
  try{const url=new URL(method==='CONNECT'?'https://'+request.url:request.url);if(!['http:','https:'].includes(url.protocol))throw Error();return{method,hostname:url.hostname,port:url.port||(url.protocol==='https:'?'443':'80'),blocked:true,forwarded:false};}
  catch{return{method,hostname:'[invalid]',port:'',blocked:true,forwarded:false};}
}
export async function endInstalledThread(rpc,threadId){
  // Unsubscribe only removes notifications in current Codex; archive ends the
  // owned synthetic session and releases its MCP resources.
  await rpc('thread/archive',{threadId});
  const result=await rpc('thread/unsubscribe',{threadId});
  assert(['unsubscribed','notSubscribed','notLoaded'].includes(result.status),'Unexpected post-archive subscription status');
}
export function responsesToolMessage(body,expected) {
  const calls=(body.input??[]).filter(i=>i.type==='function_call'&&i.call_id===expected.callId);
  const outputs=(body.input??[]).filter(i=>i.type==='function_call_output'&&i.call_id===expected.callId);
  assert.equal(calls.length,1,'Missing/duplicate actual function call');assert.equal(outputs.length,1,'Missing/duplicate actual function output');
  const name=calls[0].namespace?calls[0].namespace+'.'+calls[0].name:calls[0].name;
  assert.equal(name,expected.name,'Actual function name changed');assert.deepEqual(JSON.parse(calls[0].arguments),expected.args,'Actual function arguments changed');
  let content=outputs[0].output;
  if(Array.isArray(content)&&content[0]?.type==='input_text'){
    assert.equal(content.length,2,'Unexpected installed-client output blocks');assert.equal(content[1]?.type,'input_text');
    assert.match(content[0].text,/^Wall time: [0-9]+(?:\.[0-9]+)? seconds\r?\nOutput:$/,'Unrecognized installed-client output header');
    assert.equal(typeof content[1].text,'string');content=content[1].text;
  }
  return{role:'tool',tool_call_id:expected.callId,content};
}
export function findAdvertisedTool(tools,suffix) {
  assert(/^krakinai_[a-z_]+$/.test(suffix),'Only KRAKINAI tools are permitted');
  const names=[];
  for(const tool of tools??[]) {
    if(tool.type==='function'&&typeof tool.name==='string'&&tool.name.endsWith(suffix))names.push(tool.name);
    if(tool.type==='namespace')for(const child of tool.tools??[])if(child.type==='function'&&child.name===suffix)names.push(tool.name+'.'+child.name);
  }
  assert.equal(names.length,1,'Actual installed Codex did not advertise exactly one requested tool');
  assert(names[0].includes('krakinai'),'Unrelated advertised tool');return names[0];
}
export function toolResponseEvents(expected) {
  const parts=expected.name.split('.');
  const item={type:'function_call',id:'fc_'+expected.callId,call_id:expected.callId,...(parts.length===2?{namespace:parts[0],name:parts[1]}:{name:expected.name}),arguments:JSON.stringify(expected.args),status:'completed'};
  return[
    {type:'response.created',response:{id:'resp_'+expected.callId,object:'response',status:'in_progress',output:[]}},
    {type:'response.output_item.added',output_index:0,item:{...item,arguments:'',status:'in_progress'}},
    {type:'response.function_call_arguments.delta',item_id:item.id,output_index:0,delta:item.arguments},
    {type:'response.function_call_arguments.done',item_id:item.id,output_index:0,arguments:item.arguments},
    {type:'response.output_item.done',output_index:0,item},
    {type:'response.completed',response:{id:'resp_'+expected.callId,object:'response',status:'completed',output:[item],usage:{input_tokens:0,output_tokens:0,total_tokens:0}}},
  ];
}
function finalEvents(id) {
  const item={type:'message',id:'msg_'+id,role:'assistant',status:'completed',content:[{type:'output_text',text:'Synthetic tool turn finished.',annotations:[]}]};
  return[{type:'response.output_item.added',output_index:0,item},{type:'response.output_item.done',output_index:0,item},
    {type:'response.completed',response:{id:'resp_final_'+id,object:'response',status:'completed',output:[item],usage:{input_tokens:0,output_tokens:0,total_tokens:0}}}];
}

/** The caller supplies an explicit installed binary and an isolated synthetic launcher config. */
export async function startInstalledCodexClient({executable,directory,target,launcherConfig}) {
  assertSyntheticTarget(target);assert.equal(process.platform,'win32','Installed Windows acceptance only');
  const config=JSON.parse(await readFile(launcherConfig,'utf8'));assert.equal(config.formatVersion,1);assert.equal(config.appOrigin,target.origin);
  assert(config.relayPort>=1024&&config.relayPort!==4180&&config.relayPort!==4177,'Live relay rejected');
  const home=join(directory,'codex-home'),workspace=join(directory,'workspace');
  await mkdir(directory,{recursive:false});await mkdir(home);await mkdir(workspace);
  const pending=new Map(),turns=new Map(),threads=new Map(),calls=new Map(),notifications=[],exited=deferred();
  let child,sequence=0,buffer='',stderrBytes=0,fixtureRequests=0,blockedExternalAttempts=0,closed=false;const blockedDestinations=[];
  const noteBlocked=request=>{blockedExternalAttempts++;if(blockedDestinations.length<32)blockedDestinations.push(blockedDestination(request));};
  const fail=error=>{for(const p of pending.values())p.reject(error);pending.clear();for(const p of turns.values())p.reject(error);};
  const fixture=createServer(async(request,response)=>{
    try {
      if(request.url?.startsWith('http://')||request.url?.startsWith('https://')){noteBlocked(request);response.writeHead(403);response.end();return;}
      assert.equal(request.method,'POST');assert.equal(request.url,'/v1/responses','Unexpected model endpoint');
      let text='';for await(const bytes of request){text+=String(bytes);assert(text.length<=8388608,'Synthetic request size limit');}
      const body=JSON.parse(text);fixtureRequests++;
      const input=JSON.stringify(body.input??[]),matching=[...calls.values()].filter(c=>input.includes(c.tag));
      assert(matching.length>0,'Uncorrelated model request');const current=matching.at(-1);
      let events;
      if((body.input??[]).some(i=>i.type==='function_call_output'&&i.call_id===current.callId)) {
        const message=responsesToolMessage(body,current);assert(!current.message,'Duplicate actual tool response');current.message=message;
        current.rawOutput=structuredClone(body.input.find(i=>i.type==='function_call_output'&&i.call_id===current.callId));
        events=finalEvents(current.callId);
      }else{
        current.advertised=(body.tools??[]).flatMap(t=>t.type==='namespace'?(t.tools??[]).map(c=>t.name+'.'+c.name):[t.name]).filter(Boolean);
        current.name=findAdvertisedTool(body.tools,current.tool);assert(!current.issued,'Repeated initial model request');current.issued=true;
        events=toolResponseEvents(current);
      }
      response.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});
      for(const event of events)response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);response.end();
    }catch(error){fail(error);if(!response.headersSent)response.writeHead(400);response.end('{}');}
  });
  fixture.on('connect',(request,socket)=>{noteBlocked(request);socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');});
  async function close() {
    if(closed)return;closed=true;
    try{
      if(child){
        child.stdin.end();let timer;
        try{await Promise.race([exited.promise,new Promise((_,no)=>{timer=setTimeout(()=>no(Error('Owned app-server shutdown timeout')),10000)})]);}
        catch{child.kill();await exited.promise;}
        finally{clearTimeout(timer);}
      }
    }finally{
      fail(Error('Synthetic client closed'));fixture.closeAllConnections();await new Promise(r=>fixture.close(r));
    }
  }
  try {
  await new Promise((yes,no)=>{fixture.once('error',no);fixture.listen(0,'127.0.0.1',yes)});
  const baseUrl=`http://127.0.0.1:${fixture.address().port}`;
  const env=Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','ProgramFiles','ProgramFiles(x86)'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  Object.assign(env,{CODEX_HOME:home,USERPROFILE:workspace,APPDATA:join(directory,'roaming'),LOCALAPPDATA:join(directory,'local'),KRAKINAI_SYNTHETIC_MODEL_KEY:'synthetic-loopback-not-a-secret',HTTP_PROXY:baseUrl,HTTPS_PROXY:baseUrl,ALL_PROXY:baseUrl,NO_PROXY:'localhost,127.0.0.1'});
  const version=await new Promise((yes,no)=>execFile(executable,['--version'],{env,cwd:workspace,windowsHide:true,timeout:10000},(error,out)=>error?no(error):yes(out.trim())));
  assert(/^codex-cli \S+$/.test(version),'Installed executable version missing');
  const metadata={version,executableSha256:createHash('sha256').update(await readFile(executable)).digest('hex')};
  const toml=[
    'model = "krakinai-synthetic"','model_provider = "krakinai_synthetic"','approval_policy = "never"','sandbox_mode = "read-only"',
    '[model_providers.krakinai_synthetic]','name = "KRAKINAI isolated loopback fixture"',`base_url = ${JSON.stringify(baseUrl+'/v1')}`,'wire_api = "responses"','env_key = "KRAKINAI_SYNTHETIC_MODEL_KEY"','requires_openai_auth = false','supports_websockets = false',
    '[mcp_servers.krakinai]',`command = ${JSON.stringify(process.execPath)}`,`args = ${JSON.stringify([resolve(config.bridgeDirectory,'krakinai-stdio-adapter.mjs'),'--config',resolve(launcherConfig)])}`,'startup_timeout_sec = 30','tool_timeout_sec = 30',
    '[analytics]','enabled = false','[otel]','log_user_prompt = false',
  ].join('\n')+'\n';
  await writeFile(join(home,'config.toml'),toml,{flag:'wx'});
  child=spawn(executable,['app-server','--stdio'],{cwd:workspace,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.once('error',error=>{fail(error);exited.resolve(null)});child.once('exit',code=>{if(!closed)fail(Error('Installed app-server exited '+code));exited.resolve(code)});
  child.stderr.on('data',bytes=>{stderrBytes+=bytes.length;if(stderrBytes>1048576)fail(Error('App-server diagnostic limit'));});
  child.stdin.on('error',error=>{if(!closed)fail(error)});
  child.stdout.on('data',bytes=>{
    try {
      buffer+=String(bytes);assert(buffer.length<=8388608,'App-server frame limit');let newline;
      while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;const value=JSON.parse(line);
        if(Object.hasOwn(value,'id')&&!value.method){const p=pending.get(value.id);assert(p,'Unexpected RPC response');pending.delete(value.id);value.error?p.reject(Error('App-server RPC: '+String(value.error.message).slice(0,1000))):p.resolve(value.result);}
        else if(value.method&&Object.hasOwn(value,'id')){fail(Error('Unexpected interactive app-server request: '+value.method));child.stdin.write(JSON.stringify({id:value.id,error:{code:-32601,message:'Synthetic acceptance does not automate approval'}})+'\n');}
        else{
          notifications.push({method:value.method,threadId:value.params?.threadId,turnId:value.params?.turn?.id,status:value.params?.turn?.status,
            ...(value.method==='mcpServer/startupStatus/updated'?{startup:structuredClone(value.params)}:{})});if(notifications.length>10000)throw Error('Notification limit');
          if(value.method==='turn/completed'){const waiter=turns.get(value.params.threadId);if(waiter){turns.delete(value.params.threadId);waiter.resolve(value.params.turn);}}
        }
      }
    }catch(error){fail(error);}
  });
  async function rpc(method,params) {
    const id=++sequence,p=deferred();pending.set(id,p);child.stdin.write(JSON.stringify({id,method,params})+'\n');
    const timer=setTimeout(()=>p.reject(Error('App-server RPC timeout: '+method)),45000);
    try{return await p.promise;}finally{clearTimeout(timer);pending.delete(id);}
  }
  await rpc('initialize',{clientInfo:{name:'krakinai_shared_acceptance',title:'KRAKINAI Synthetic Acceptance',version:'1.0.0'},capabilities:{experimentalApi:false}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  return {
    metadata,
    async startThread(label){
      assert(/^(alpha|beta|gamma|discovery)$/.test(label)&&!threads.has(label));
      // Persist only inside this fresh QA home so thread/archive can end the
      // session. Ephemeral threads have no rollout and cannot be archived.
      const value=await rpc('thread/start',{cwd:workspace,model:'krakinai-synthetic',modelProvider:'krakinai_synthetic',approvalPolicy:'never',sandbox:'read-only',ephemeral:false});
      assert(value.thread?.id);threads.set(label,value.thread.id);
      const end=Date.now()+45000;
      for(;;){
        const latest=notifications.filter(n=>n.startup?.threadId===value.thread.id&&n.startup.name==='krakinai').at(-1)?.startup;
        if(latest?.status==='ready')break;
        if(latest?.status==='failed')throw Error('Synthetic MCP startup failed: '+String(latest.error).slice(0,1000));
        assert(Date.now()<end,'Synthetic MCP initialization timeout');await new Promise(r=>setTimeout(r,50));
      }
      return value.thread.id;
    },
    async invoke(label,tool,args,callId) {
      assert(threads.has(label)&&!calls.has(callId));const threadId=threads.get(label);assert(!turns.has(threadId),'Concurrent turns on one thread');
      const current={tool,args:structuredClone(args),callId,tag:'SYNTHETIC_KRAKINAI_'+randomUUID()};calls.set(callId,current);
      const completed=deferred();turns.set(threadId,completed);
      const timer=setTimeout(()=>completed.reject(Error('Installed Codex turn timeout')),60000);
      try{
        await rpc('turn/start',{threadId,input:[{type:'text',text:current.tag+' Run the single planned synthetic MCP check.',text_elements:[]}]});
        const turn=await completed.promise;assert.equal(turn.status,'completed','Installed Codex turn did not complete');assert(current.message,'Missing actual installed-client tool response');
        return{client:label,callId,tool,message:structuredClone(current.message),rawToolOutput:structuredClone(current.rawOutput),actualToolName:current.name,advertised:current.advertised};
      }finally{clearTimeout(timer);turns.delete(threadId);}
    },
    async unsubscribe(label){const id=threads.get(label);assert(id);const value=await rpc('thread/unsubscribe',{threadId:id});assert.equal(value.status,'unsubscribed');threads.delete(label);return value;},
    async closeThread(label){const id=threads.get(label);assert(id);await endInstalledThread(rpc,id);threads.delete(label);},
    summary(){return{...metadata,fixtureRequests,blockedExternalAttempts,blockedDestinations:structuredClone(blockedDestinations),stderrBytes,notifications:structuredClone(notifications),advertisedToolNames:[...new Set([...calls.values()].flatMap(c=>c.advertised??[]))],actualCallIds:[...calls.values()].filter(c=>c.message).map(c=>c.callId)};},
    close,
  };
  }catch(error){await close();throw error;}
}
