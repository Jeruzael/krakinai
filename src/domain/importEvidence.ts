import {Unzlib,zlibSync} from 'fflate';
import {ImportAdmissionError} from './importAdmission';

export const MAX_RECEIPT_EVIDENCE_BYTES=4*1024*1024;
export const MAX_EXPANDED_IMPORT_EVIDENCE_BYTES=32*1024*1024;
const MAX_ENCODED_BYTES=8*1024*1024;
// Small input pushes bound fflate's work/allocation before each output callback.
const INPUT_CHUNK=256;
export interface CompactImportEvidence {
 encoding:'deflate-utf8-base64.v1';uncompressedBytes:number;sha256:string;data:string;
}
const utf8=new TextEncoder();
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
function compressed(value:unknown):{envelope:CompactImportEvidence;bytes:Uint8Array}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid compact receipt evidence.');
 const e=value as CompactImportEvidence;
 if(Object.keys(e).sort().join(',')!=='data,encoding,sha256,uncompressedBytes'||e.encoding!=='deflate-utf8-base64.v1'||!Number.isSafeInteger(e.uncompressedBytes)||e.uncompressedBytes<1||e.uncompressedBytes>MAX_RECEIPT_EVIDENCE_BYTES||typeof e.sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256)||typeof e.data!=='string'||!e.data.length||e.data.length>MAX_ENCODED_BYTES||e.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(e.data))throw Error('Invalid encoding, size or fields in compact receipt evidence (4 MiB expanded limit).');
 const bytes=Uint8Array.from(atob(e.data),c=>c.charCodeAt(0));
 if(base64(bytes)!==e.data)throw Error('Receipt evidence base64 must be canonical.');
 return{envelope:e,bytes};
}
/** Bounded synchronous structure decoding; hash/framing verification is separate and async. */
export function decodeImportEvidence(value:unknown,observation?:{onChunk(bytes:number):void}):string{
 const {envelope:e,bytes}=compressed(value),output=new Uint8Array(e.uncompressedBytes);let size=0;
 const decoder=new Unzlib(chunk=>{
  observation?.onChunk(chunk.length);
  if(size+chunk.length>e.uncompressedBytes)throw Error('Receipt evidence exceeds its declared expanded size limit.');
  output.set(chunk,size);size+=chunk.length;
 });
 for(let i=0;i<bytes.length;i+=INPUT_CHUNK)decoder.push(bytes.subarray(i,i+INPUT_CHUNK),i+INPUT_CHUNK>=bytes.length);
 if(size!==e.uncompressedBytes)throw Error('Receipt evidence expanded size is inconsistent.');
 return new TextDecoder('utf-8',{fatal:true}).decode(output);
}
/** Native strict framing rejects checksum errors and trailing data fflate can ignore. */
export async function verifyImportEvidence(value:unknown):Promise<string>{
 const {envelope,bytes}=compressed(value),e={...envelope},text=decodeImportEvidence(e),expected=utf8.encode(text);
 if(typeof DecompressionStream==='undefined')throw Error('This browser cannot verify compact import evidence. Use an updated Chromium browser.');
 const input=new ReadableStream<BufferSource>({start(controller){for(let i=0;i<bytes.length;i+=65536)controller.enqueue(bytes.subarray(i,i+65536) as BufferSource);controller.close();}});
 const reader=input.pipeThrough(new DecompressionStream('deflate')).getReader();let offset=0;
 try{
  while(true){const {value:chunk,done}=await reader.read();if(done)break;
   if(offset+chunk.length>expected.length)throw Error('Receipt evidence exceeds its verified expanded size limit.');
   for(let i=0;i<chunk.length;i++)if(chunk[i]!==expected[offset+i])throw Error('Receipt evidence decoding is inconsistent.');
   offset+=chunk.length;
  }
  if(offset!==expected.length||await sha(expected)!==e.sha256)throw Error('Receipt evidence hash or size mismatch.');
 }catch(error){await reader.cancel().catch(()=>undefined);throw error;}finally{reader.releaseLock();}
 return text;
}
export async function encodeImportEvidence(text:string):Promise<CompactImportEvidence>{
 const bytes=utf8.encode(text);
 if(!bytes.length||bytes.length>MAX_RECEIPT_EVIDENCE_BYTES)throw new ImportAdmissionError('RECEIPT_EVIDENCE_CAPACITY','Receipt review evidence exceeds its 4 MiB expanded limit.',bytes.length,MAX_RECEIPT_EVIDENCE_BYTES);
 const evidence:CompactImportEvidence={encoding:'deflate-utf8-base64.v1',uncompressedBytes:bytes.length,sha256:await sha(bytes),data:base64(zlibSync(bytes,{level:6}))};
 if(await verifyImportEvidence(evidence)!==text)throw Error('Receipt evidence did not round trip exactly.');
 return evidence;
}
