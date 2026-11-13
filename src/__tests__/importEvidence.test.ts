import {describe,it,expect} from 'vitest';
import {zlibSync,strToU8} from 'fflate';

const codec=()=>import('../domain/importEvidence');
describe('compact receipt evidence',()=>{
 it('preserves exact canonical Unicode, escapes and prompt newlines',async()=>{
  const {encodeImportEvidence,decodeImportEvidence,verifyImportEvidence}=await codec();
  const text=JSON.stringify({prompt:'Aya — 雨 🌿\n"original"\t\\',manual:'Do not normalize\r\nthis'});
  const evidence=await encodeImportEvidence(text);
  expect(decodeImportEvidence(evidence)).toBe(text);
  expect(await verifyImportEvidence(evidence)).toBe(text);
  expect(evidence.uncompressedBytes).toBe(new TextEncoder().encode(text).length);
 });
 it('rejects corrupt, noncanonical or unbounded envelope fields',async()=>{
  const {encodeImportEvidence,decodeImportEvidence,verifyImportEvidence}=await codec();
  const e=await encodeImportEvidence('{"prompt":"kept"}');
  for(const patch of [{encoding:'other'}, {uncompressedBytes:0},{uncompressedBytes:4194305},{data:e.data+'\n'},{extra:true},{data:e.data.slice(0,-4)}])expect(()=>decodeImportEvidence({...e,...patch})).toThrow();
  await expect(verifyImportEvidence({...e,sha256:'0'.repeat(64)})).rejects.toThrow(/hash/i);
  expect(()=>decodeImportEvidence({...e,uncompressedBytes:e.uncompressedBytes-1})).toThrow(/size|limit/i);
 });
 it('rejects trailing compressed input rather than accepting an earlier complete stream',async()=>{
  const {encodeImportEvidence,verifyImportEvidence}=await codec(),e=await encodeImportEvidence('{"prompt":"first"}');
  const raw=Uint8Array.from(atob(e.data),c=>c.charCodeAt(0)),extra=new Uint8Array(raw.length+3);extra.set(raw);extra.set([1,2,3],raw.length);
  await expect(verifyImportEvidence({...e,data:btoa(String.fromCharCode(...extra))})).rejects.toThrow();
 });
 it('bounds expansion while inflating a deceptive compressed fixture',async()=>{
  const {decodeImportEvidence}=await codec();
  const data=zlibSync(strToU8('x'.repeat(8*1024*1024))),envelope={encoding:'deflate-utf8-base64.v1',uncompressedBytes:32,sha256:'0'.repeat(64),data:btoa(String.fromCharCode(...data))};
  let highWater=0;
  expect(()=>decodeImportEvidence(envelope,{onChunk:bytes=>highWater=Math.max(highWater,bytes)})).toThrow(/size|limit/i);
  expect(highWater).toBeLessThan(512*1024);
 });
 it('round trips the exact 50 MiB boundary and rejects one byte over',async()=>{
  const {encodeImportEvidence,verifyImportEvidence}=await codec(),text='x'.repeat(50*1024*1024),e=await encodeImportEvidence(text);
  expect((await verifyImportEvidence(e)).length).toBe(text.length);
  await expect(encodeImportEvidence(text+'x')).rejects.toThrow(/50 MiB/);
 });
 it('accepts large high-entropy evidence without recursive base64 validation',async()=>{
  const {encodeImportEvidence,verifyImportEvidence}=await codec();let seed=2463534242;
  const chunks:string[]=[];
  for(let i=0;i<1024;i++){let chunk='';for(let j=0;j<1024;j++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;chunk+=String.fromCharCode(32+((seed>>>0)%95));}chunks.push(chunk);}
  const text=chunks.join(''),encoded=await encodeImportEvidence(text);
  expect(encoded.data.length).toBeGreaterThan(800000);
  expect(await verifyImportEvidence(encoded)).toBe(text);
 });
});
