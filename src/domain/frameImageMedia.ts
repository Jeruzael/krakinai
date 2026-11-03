import type {MediaAsset} from '../types/domain';
import type {FrameMediaProof} from '../types/frameProduction';
import {validateMediaCandidate} from './validation';
import {frameMediaSignature} from './frameImageAssociations';
// C raster decoding is sequential and bounded before allocating a bitmap.
export const MAX_FRAME_IMAGE_PIXELS=64*1024*1024;
export const MAX_FRAME_IMAGE_EDGE=16384;
const text=(bytes:Uint8Array,start:number,length:number)=>String.fromCharCode(...bytes.subarray(start,start+length));
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function frameRasterDimensions(bytes:Uint8Array,mime:string):{width:number;height:number}{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),fail=()=>{throw Error('Image bytes have an invalid or unsupported raster signature.');};
 let width=0,height=0;
 if(mime==='image/png'){
  if(bytes.length<33||text(bytes,0,8)!=='\x89PNG\r\n\x1a\n')return fail();let offset=8,ended=false,chunks=0;
  while(offset<bytes.length){if(++chunks>2000||offset+12>bytes.length)return fail();const size=view.getUint32(offset),kind=text(bytes,offset+4,4),end=offset+12+size;if(end>bytes.length||crc32(bytes.subarray(offset+4,end-4))!==view.getUint32(end-4))return fail();
   if(offset===8){if(kind!=='IHDR'||size!==13)return fail();width=view.getUint32(offset+8);height=view.getUint32(offset+12);}
   if(kind==='acTL')throw Error('Choose one still image for a keyframe. Animated PNG files remain usable in their existing reference roles.');
   if(kind==='IEND'){if(size!==0||end!==bytes.length)return fail();ended=true;break;}offset=end;
  }if(!ended)return fail();
 }else if(mime==='image/jpeg'){
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return fail();let offset=2,segments=0;
  while(offset+4<=bytes.length){if(++segments>2000||bytes[offset++]!==255)return fail();while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;
   if(offset+2>bytes.length)return fail();const size=view.getUint16(offset);if(size<2||offset+size>bytes.length)return fail();if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)return fail();height=view.getUint16(offset+3);width=view.getUint16(offset+5);}offset+=size;
  }
 }else if(mime==='image/webp'){
  if(bytes.length<20||text(bytes,0,4)!=='RIFF'||text(bytes,8,4)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)return fail();let offset=12,chunks=0;
  while(offset+8<=bytes.length){if(++chunks>2000)return fail();const kind=text(bytes,offset,4),size=view.getUint32(offset+4,true),at=offset+8,end=at+size;if(end>bytes.length)return fail();
   if(kind==='ANIM'||kind==='ANMF'||kind==='VP8X'&&(bytes[at]&2))throw Error('Choose one still WebP image for a keyframe; animated files are not converted automatically.');
   if(kind==='VP8X'){if(size!==10)return fail();width=1+bytes[at+4]+(bytes[at+5]<<8)+(bytes[at+6]<<16);height=1+bytes[at+7]+(bytes[at+8]<<8)+(bytes[at+9]<<16);}
   if(kind==='VP8 '){if(size<10||text(bytes,at+3,3)!=='\x9d\x01\x2a')return fail();const w=view.getUint16(at+6,true)&16383,h=view.getUint16(at+8,true)&16383;if(width&&width!==w||height&&height!==h)return fail();width=w;height=h;}
   if(kind==='VP8L'){if(size<5||bytes[at]!==47)return fail();const bits=view.getUint32(at+1,true),w=1+(bits&16383),h=1+((bits>>>14)&16383);if(width&&width!==w||height&&height!==h)return fail();width=w;height=h;}
   offset=end+(size%2);if(offset>bytes.length)return fail();
  }if(offset!==bytes.length)return fail();
 }else return fail();
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>MAX_FRAME_IMAGE_EDGE||height>MAX_FRAME_IMAGE_EDGE||width*height>MAX_FRAME_IMAGE_PIXELS)throw Error('Image dimensions exceed the keyframe decoding budget (16,384 per edge and 64 MiPixels). The original file was not changed.');
 return{width,height};
}
export async function decodeFrameRaster(blob:Blob):Promise<{width:number;height:number}>{
 if(typeof createImageBitmap!=='function')throw Error('This browser cannot validate image decoding. Keep the file and use a supported Chromium browser.');
 const bitmap=await createImageBitmap(blob);try{return{width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}
}
export async function prepareStoredFrameImage(media:MediaAsset,options:{decode?:(blob:Blob)=>Promise<{width:number;height:number}>;signal?:AbortSignal}={}):Promise<FrameMediaProof&{width:number;height:number}>{
 const abort=()=>{if(options.signal?.aborted)throw new DOMException('Image preparation cancelled.','AbortError');};abort();
 if(!media.blob||media.blob.size!==media.byteSize||media.blob.type!==media.mimeType)throw Error('Image bytes or MIME metadata are inconsistent. Select the original supported file.');
 const checked=validateMediaCandidate({name:media.filename,type:media.mimeType,size:media.byteSize,existingCount:0});if(!checked.valid||checked.kind!=='image')throw Error(checked.error??'Choose a supported PNG, JPEG or WebP image.');
 const bytes=new Uint8Array(await media.blob.arrayBuffer());abort();const header=frameRasterDimensions(bytes,media.mimeType);
 let decoded:{width:number;height:number};try{decoded=await(options.decode??decodeFrameRaster)(media.blob);}catch{throw Error('Image decode failed. Choose a complete decodable original image.');}abort();
 const same=decoded.width===header.width&&decoded.height===header.height,oriented=media.mimeType!=='image/png'&&decoded.width===header.height&&decoded.height===header.width;
 if(!same&&!oriented||!Number.isSafeInteger(decoded.width)||!Number.isSafeInteger(decoded.height))throw Error('Decoded image dimensions do not match its original bytes.');
 if((media.width!==undefined||media.height!==undefined)&&(media.width!==decoded.width||media.height!==decoded.height))throw Error('Stored image dimensions are inconsistent with the decoded original.');
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');abort();
 return{signature:frameMediaSignature(media),sha256,width:decoded.width,height:decoded.height};
}
