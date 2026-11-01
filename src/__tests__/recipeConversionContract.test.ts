import { describe,it,expect } from 'vitest';
import v1 from '../../docs/change-set.schema.json?raw';
import v2 from '../../docs/change-set-v2.schema.json?raw';
import v3 from '../../docs/change-set-v3.schema.json?raw';
import v4 from '../../docs/change-set-v4.schema.json?raw';
import {parseChangeSet,validateJsonRule} from '../domain/changeSetValidation';
import * as schemas from '../domain/changeSetSchema';
import {MCP_INPUT_SCHEMAS,validateToolArgs} from '../domain/mcpProtocol';
import {validateChangeSetApproval} from '../domain/changeSetLedger';
import {conversionPackage,conversionApproval} from './fixtures/recipeConversionFixture';

describe('v4 conversion authority and contract',()=>{
 it('accepts an explicit conversion on existing manual and MCP preview/submit boundaries',()=>{
  const p=conversionPackage();expect(parseChangeSet(p)).toEqual(p);
  for(const tool of ['krakinai_preview_change_set','krakinai_submit_change_set'] as const){
   expect(validateToolArgs(tool,{changeSet:p})).toEqual({changeSet:p});
   expect(()=>validateJsonRule(MCP_INPUT_SCHEMAS[tool].properties.changeSet as any,p)).not.toThrow();
  }
 });
 it('publishes exactly the runtime v4 schema',()=>{
  const rule=(schemas as any).CHANGE_SET_V4_SCHEMA;expect(rule).toBeDefined();
  expect(JSON.parse(v4)).toEqual(rule);
 });
 it.each(['v1','v2','v3'])('does not reinterpret %s packages as conversions',version=>{
  const p=conversionPackage();p.schema='krakinai.change-set.'+version;
  expect(()=>parseChangeSet(p)).toThrow();
 });
 it.each([
  ['v1',v1,'ba8782ef3f960a0781c9227bf4423c5faad670b8214bdb0fa790f7aa54bf6164'],
  ['v2',v2,'4cd63ca3b28dee79cbff8834c2f6744c151b7dc793e0832d98228e130a59ed33'],
  ['v3',v3,'a46989b0d702ee8c0c94dcaa6164823ed2c2f0bbc1648f620eca8ab0e5932bc3'],
 ])('retains the distributed frozen contract %s', async (_,raw,hash)=>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(JSON.parse(raw))));
  expect(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')).toBe(hash);
 });
 it.each([
  ['raw text',(o:any)=>{o.prompt={version:1,text:'hidden primary output'}}],
  ['raw snapshots',(o:any)=>{o.slots={}}],
  ['human authority',(o:any)=>{o.conversion.reviewed=true}],
  ['implicit project',(o:any)=>{o.project={ref:'new-project'}}],
  ['implicit shot',(o:any)=>{o.shot={ref:'new-shot'}}],
  ['bad hash',(o:any)=>{o.conversion.sourceTextSha256='not-a-sha'}],
  ['too many mappings',(o:any)=>{o.conversion.mappings=Array.from({length:129},(_,i)=>({...o.conversion.mappings[0],id:'map'+i}))}],
  ['long explanation',(o:any)=>{o.conversion.mappings[0].explanation='x'.repeat(501)}],
  ['duplicate mapping IDs',(o:any)=>{o.conversion.mappings.push({...o.conversion.mappings[0],target:{kind:'settings'}})}],
  ['invalid span',(o:any)=>{o.conversion.mappings[0].sourceSpan={start:5,end:2}}],
  ['executable target path',(o:any)=>{o.conversion.mappings[0].target={kind:'path',path:'__proto__.approved'}}],
 ])('rejects %s',(_,mutate)=>{
  const p=conversionPackage();mutate(p.operations[0]);expect(()=>parseChangeSet(p)).toThrow();
 });
 it('accepts browser-owned mapping decisions and rejects unrelated row/operation targets',()=>{
  const p=conversionPackage(),approval:any=conversionApproval();
  expect(()=>validateChangeSetApproval(approval,p.operations)).not.toThrow();
  approval.conversionDecisions.convert.acknowledgedRowIds=['nonexistent'];
  expect(()=>validateChangeSetApproval(approval,p.operations)).toThrow(/mapping|row/i);
  approval.conversionDecisions={wrong:{reviewed:true,acknowledgedRowIds:[]}};
  expect(()=>validateChangeSetApproval(approval,p.operations)).toThrow(/conversion|operation/i);
 });
});
