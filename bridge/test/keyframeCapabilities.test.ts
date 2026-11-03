import {afterEach,it,expect} from 'vitest';
import {createRelay,type RelayHandle,type VerificationRequest} from '../src/relay';
import {BrowserTransport} from '../../src/connections/browserTransport';
import {MCP_KEYFRAME_CAPABILITIES,MCP_BLOCKING_CAPABILITIES,BLOCKING_BRIDGE_VERSION} from '../../src/domain/mcpCapabilities';
import {BRIDGE_VERSION,resultData} from '../../src/domain/mcpProtocol';
import {createOffer} from '../../src/domain/mcpCrypto';
const origin='http://localhost:5183',relays:RelayHandle[]=[],clients:BrowserTransport[]=[];
afterEach(async()=>{await Promise.all(clients.splice(0).map(c=>c.disconnect()));await Promise.all(relays.splice(0).map(r=>r.close()));});
async function setup(options:{version?:1|2|3;unsupported?:boolean;failure?:number;tamper?:boolean;allowed?:boolean;requireBlocking?:boolean;requireKeyframes?:boolean}={}){
 let native:VerificationRequest|undefined,grant:any;const paths:string[]=[],relay=await createRelay({port:0,appOrigin:origin,bridgePath:'C:/synthetic/bridge.mjs',verifyNative:info=>{native=info;return{decision:Promise.resolve(options.allowed??true),close(){}};}});relays.push(relay);
 const client=new BrowserTransport({appOrigin:origin,relayAddress:relay.url,pairingVersion:options.version??3,requireKeyframes:options.requireKeyframes??true,requireBlocking:options.requireBlocking,fetcher:async(url,init)=>{
  const path=new URL(String(url)).pathname;paths.push(path);
  if(path==='/v2/pair/start'&&(options.unsupported||options.failure))return new Response(JSON.stringify({error:{code:options.unsupported?'UNKNOWN_ROUTE':'AUTH_FAILED'}}),{status:options.failure??404,headers:{'content-type':'application/json'}});
  const response=await fetch(url,{...init,headers:{...init?.headers,origin}});
  if(path==='/v2/pair/start'&&response.ok&&options.tamper){const data=await response.json();data.transcript.serverCapabilities=[];data.transcript.capabilities=[];return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});}
  return response;
 },onConnected(_id,value){grant=value;},onDisconnected(){},onCommand:async()=>resultData({synthetic:true})});clients.push(client);
 return{relay,client,paths,secret:()=>native!.secret,grant:()=>grant};
}

it('pairs C through the actual proof-bound transport and never leaks a pairing secret',async()=>{
 const f=await setup(),view=await f.client.startPairing();expect(view.capabilities).toEqual([...MCP_KEYFRAME_CAPABILITIES].sort());expect(JSON.stringify(view)).not.toContain(f.secret());
 await f.client.finishPairing(f.secret());expect(f.client.getCapabilities()).toEqual([...MCP_KEYFRAME_CAPABILITIES].sort());expect(await f.relay.dispatch('krakinai_get_scene',{sceneId:'synthetic',projection:'keyframes'})).toMatchObject({ok:true});
});
it('fails closed on unsupported C peers without a legacy fallback',async()=>{
 const f=await setup({unsupported:true});await expect(f.client.startPairing()).rejects.toMatchObject({code:'CAPABILITY_REQUIRED'});expect(f.paths).toEqual(['/v2/pair/start']);
});
it('rejects capability downgrades and does not mint browser grants',async()=>{
 const f=await setup({tamper:true});await expect(f.client.startPairing()).rejects.toMatchObject({code:'CAPABILITY_REQUIRED'});expect(f.grant()).toBeUndefined();
});
it('refuses C-specific dispatch on an otherwise valid B session',async()=>{
 const f=await setup({version:2,requireKeyframes:false});await f.client.startPairing();await f.client.finishPairing(f.secret());
 expect(await f.relay.dispatch('krakinai_get_generation_prompt',{sceneId:'synthetic',target:{kind:'image',keyframeId:'middle',mode:'full'}})).toMatchObject({ok:false,error:{code:'CAPABILITY_REQUIRED'}});
});
