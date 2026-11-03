import {afterEach,it,expect} from 'vitest';
import {createRelay,type RelayHandle,type VerificationRequest} from '../src/relay';
import {BrowserTransport} from '../../src/connections/browserTransport';
import {MCP_BLOCKING_CAPABILITIES,BLOCKING_BRIDGE_VERSION} from '../../src/domain/mcpCapabilities';
import {BRIDGE_VERSION,resultData} from '../../src/domain/mcpProtocol';
import {createOffer} from '../../src/domain/mcpCrypto';
const origin='http://localhost:5183',relays:RelayHandle[]=[],clients:BrowserTransport[]=[];
afterEach(async()=>{await Promise.all(clients.splice(0).map(c=>c.disconnect()));await Promise.all(relays.splice(0).map(r=>r.close()));});
async function setup(options:{version?:1|2;unsupported?:boolean;failure?:number;tamper?:boolean;allowed?:boolean;requireBlocking?:boolean}={}){
 let native:VerificationRequest|undefined,grant:any;const paths:string[]=[],relay=await createRelay({port:0,appOrigin:origin,bridgePath:'C:/synthetic/bridge.mjs',verifyNative:info=>{native=info;return{decision:Promise.resolve(options.allowed??true),close(){}};}});relays.push(relay);
 const client=new BrowserTransport({appOrigin:origin,relayAddress:relay.url,pairingVersion:options.version??2,requireBlocking:options.requireBlocking,fetcher:async(url,init)=>{
  const path=new URL(String(url)).pathname;paths.push(path);
  if(path==='/v2/pair/start'&&(options.unsupported||options.failure))return new Response(JSON.stringify({error:{code:options.unsupported?'UNKNOWN_ROUTE':'AUTH_FAILED'}}),{status:options.failure??404,headers:{'content-type':'application/json'}});
  const response=await fetch(url,{...init,headers:{...init?.headers,origin}});
  if(path==='/v2/pair/start'&&response.ok&&options.tamper){const data=await response.json();data.transcript.serverCapabilities=[];data.transcript.capabilities=[];return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});}
  return response;
 },onConnected(_id,value){grant=value;},onDisconnected(){},onCommand:async()=>resultData({synthetic:true})});clients.push(client);
 return{relay,client,paths,secret:()=>native!.secret,grant:()=>grant};
}
it('pairs new peers with proof-bound capability intersection and existing authenticated session routes',async()=>{
 const f=await setup(),view=await f.client.startPairing();expect(view.capabilities).toEqual(MCP_BLOCKING_CAPABILITIES);expect(f.client.getCapabilities()).toEqual([]);
 await f.client.finishPairing(f.secret());expect(f.grant().capabilities).toEqual(MCP_BLOCKING_CAPABILITIES);expect(f.client.getCapabilities()).toEqual(MCP_BLOCKING_CAPABILITIES);expect(await f.relay.dispatch('krakinai_get_shot_types',{})).toMatchObject({ok:true,data:{synthetic:true}});await f.client.disconnect();expect(f.client.getCapabilities()).toEqual([]);
});
it('keeps old/new v1 request, transcript and confirmation fields exact',async()=>{
 const f=await setup({version:1}),offer=await createOffer(),response=await fetch(f.relay.url+'/v1/pair/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({version:BRIDGE_VERSION,client:offer.offer})}),value=await response.json();
 expect(response.status).toBe(200);expect(Object.keys(value).sort()).toEqual(['expiresAt','transcript','verificationCode']);expect(Object.keys(value.transcript).sort()).toEqual(['challengeId','client','instanceId','origin','relay','server','version']);expect(value.transcript.version).toBe(BRIDGE_VERSION);expect(JSON.stringify(value)).not.toContain(f.secret());
});
it('falls back with Blocking disabled only on explicit unsupported-version response',async()=>{
 const f=await setup({unsupported:true}),view=await f.client.startPairing();expect(f.paths).toEqual(['/v2/pair/start','/v1/pair/start']);expect(view).not.toHaveProperty('capabilities');await f.client.finishPairing(f.secret());expect(f.grant()).not.toHaveProperty('capabilities');expect(f.client.getCapabilities()).toEqual([]);
});
it.each([401,403,409,500])('does not fall back after HTTP %s authorization/transport failure',async failure=>{const f=await setup({failure});await expect(f.client.startPairing()).rejects.toThrow();expect(f.paths).toEqual(['/v2/pair/start']);});
it('requires an update rather than silently downgrading requested Blocking authority',async()=>{const f=await setup({unsupported:true,requireBlocking:true});await expect(f.client.startPairing()).rejects.toMatchObject({code:'CAPABILITY_REQUIRED'});expect(f.paths).toEqual(['/v2/pair/start']);});
it('rejects a consistent-looking capability downgrade through the actual cryptographic transcript',async()=>{const f=await setup({tamper:true});await f.client.startPairing();await expect(f.client.finishPairing(f.secret())).rejects.toMatchObject({code:'AUTH_FAILED'});expect(f.grant()).toBeUndefined();expect(f.paths).not.toContain('/v1/pair/start');});
it('retains native denial with a correct secret and does not downgrade',async()=>{const f=await setup({allowed:false});await f.client.startPairing();await expect(f.client.finishPairing(f.secret())).rejects.toThrow();expect(f.grant()).toBeUndefined();expect(f.paths).not.toContain('/v1/pair/start');});
it('rejects v2 fields on the frozen v1 start endpoint',async()=>{const f=await setup(),offer=await createOffer(),response=await fetch(f.relay.url+'/v1/pair/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({version:BRIDGE_VERSION,client:offer.offer,capabilities:[...MCP_BLOCKING_CAPABILITIES]})});expect(response.status).toBe(400);const wrong=await fetch(f.relay.url+'/v2/pair/start',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({version:BLOCKING_BRIDGE_VERSION,client:offer.offer})});expect(wrong.status).toBe(400);});
it('refuses v5 dispatch over a legacy paired session even though tools advertise the new contract',async()=>{
 const f=await setup({version:1});await f.client.startPairing();await f.client.finishPairing(f.secret());
 const changeSet={schema:'krakinai.change-set.v5',changeSetId:'capability-only',source:{kind:'codex'},operations:[{operationId:'metadata',type:'project.update',project:{id:'synthetic-project',expectedRevision:1},name:'New name'}]};
 expect(await f.relay.dispatch('krakinai_preview_change_set',{changeSet})).toMatchObject({ok:false,error:{code:'CAPABILITY_REQUIRED'}});
});
it('keeps authenticated capabilities independent of the presentation view returned to callers',async()=>{
 const f=await setup({requireBlocking:true}),view=await f.client.startPairing();expect(view.capabilities).toBeDefined();view.capabilities!.splice(0);await f.client.finishPairing(f.secret());expect(f.client.getCapabilities()).toEqual(MCP_BLOCKING_CAPABILITIES);expect(f.grant().capabilities).toEqual(MCP_BLOCKING_CAPABILITIES);
});
