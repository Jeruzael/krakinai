import {it,expect} from 'vitest';
import {MCP_INPUT_SCHEMAS} from '../../src/domain/mcpProtocol';
import * as factoring from '../src/schemaDiscovery';
import {McpServer,InMemoryTransport} from '@modelcontextprotocol/server';
import {Client} from '@modelcontextprotocol/client';
import {registerKrakinaiTools} from '../src/registerTools';
import {resultData} from '../../src/domain/mcpProtocol';
it('factors repeated JSON Schema subtrees without removing any contract branch',()=>{
 const compact=(factoring as any).factorDiscoverySchema(MCP_INPUT_SCHEMAS.krakinai_preview_change_set);
 expect(Buffer.byteLength(JSON.stringify(compact))).toBeLessThan(500000);
 const resolve=(value:any,root:any=compact):any=>Array.isArray(value)?value.map(v=>resolve(v,root)):value&&typeof value==='object'?value.$ref?resolve(root.$defs[value.$ref.slice(8)],root):Object.fromEntries(Object.entries(value).filter(([key])=>key!=='$defs').map(([key,v])=>[key,resolve(v,value.$id?value:root)])):value;
 expect(resolve(compact)).toEqual(MCP_INPUT_SCHEMAS.krakinai_preview_change_set);
 expect(JSON.stringify(compact)).not.toContain('undefined');
});
it('lists the factored contracts through the actual SDK without broadening validation',async()=>{
 const server=new McpServer({name:'synthetic-discovery',version:'1'}),errors:string[]=[];registerKrakinaiTools(server,async()=>resultData({synthetic:true}));server.server.onerror=error=>errors.push(String(error));
 const [a,b]=InMemoryTransport.createLinkedPair(),client=new Client({name:'synthetic',version:'1'});
 try{await server.connect(a);await client.connect(b);try{const list=await client.listTools();expect(list.tools).toHaveLength(36);expect(Buffer.byteLength(JSON.stringify(list))).toBeLessThan(1310720);}catch(error){throw Error(String(error)+'; server errors: '+errors.join(' | '));}}finally{await client.close();await server.close();}
});
