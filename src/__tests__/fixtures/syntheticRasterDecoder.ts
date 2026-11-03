/** Unit-only header-based stand-in. Native decoding is verified separately in Chromium. */
export function installSyntheticRasterDecoder(){
 if(typeof createImageBitmap==='function')return;
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:async(blob:Blob)=>{
  const bytes=new Uint8Array(await blob.arrayBuffer());let width=32,height=24;
  if(blob.type==='image/png'&&bytes.length>=24){const view=new DataView(bytes.buffer);width=view.getUint32(16);height=view.getUint32(20);}
  return{width,height,close(){}} as ImageBitmap;
 }});
}
