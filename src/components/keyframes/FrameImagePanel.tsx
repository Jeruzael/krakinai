import {useEffect,useRef,useState} from 'react';
import type {Collection,MediaAsset} from '../../types/domain';
import type {FrameImageTarget,FrameImageCommand} from '../../types/frameProduction';
import {getActiveFrameImage} from '../../domain/frameImageAssociations';
import {applyFrameImageCommand,uploadFrameImage} from '../../storage/frameImages';
import {MediaThumbnail} from '../MediaThumbnail';
import {FrameImageHistory} from './FrameImageHistory';
import {downloadBlobAsFile} from '../../hooks/useObjectUrl';
export function FrameImagePanel({target,collection,mediaMap,onChanged}:{target:FrameImageTarget;collection:Collection;mediaMap:ReadonlyMap<string,MediaAsset>;onChanged():Promise<unknown>|unknown}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[mediaId,setMediaId]=useState(''),[confirmed,setConfirmed]=useState(false);const controller=useRef<AbortController>();
 const production=collection.project?.frameProduction,active=getActiveFrameImage(production,target),media=active?.mediaId?mediaMap.get(active.mediaId):undefined,shot=collection.project?.shots.find(s=>s.id===target.shotId);
 useEffect(()=>setConfirmed(false),[JSON.stringify(target),active?.id]);
 const events=production?.imageEvents.filter(e=>e.shotId===target.shotId&&e.sceneId===target.sceneId&&e.frameId===target.frameId)??[];
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();setConfirmed(false);await onChanged();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const command=(value:Omit<Extract<FrameImageCommand,{kind:'link'}>,'target'>|Omit<Extract<FrameImageCommand,{kind:'clear'}>,'target'>|Omit<Extract<FrameImageCommand,{kind:'review'}>,'target'>)=>run(()=>applyFrameImageCommand({...value,target} as FrameImageCommand));
 return <section className="frame-image-panel" aria-label="Image for selected frame"><h3>Frame image</h3><p>{active?`Image ${active.reviewStatus.replaceAll('_',' ')} · revision ${active.revision}`:'No image assigned to this exact take/frame.'}</p>{media&&<><MediaThumbnail media={media} altText="Externally supplied frame image"/><button className="btn btn-secondary btn-sm" onClick={()=>downloadBlobAsFile(media.blob,media.safeFilename||media.filename)}>Download original image</button></>}
  <label className="btn btn-secondary btn-sm frame-image-upload">Upload image for this frame<input aria-label="Upload image for this frame" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file){controller.current=new AbortController();void run(()=>uploadFrameImage({target,file,signal:controller.current!.signal}));}}}/></label>{busy&&<button className="btn btn-ghost" onClick={()=>controller.current?.abort()}>Cancel upload</button>}
  <label>Existing image<select className="select" value={mediaId} disabled={busy} onChange={e=>{setMediaId(e.target.value);setConfirmed(false);}}><option value="">Select a stored image</option>{[...mediaMap.values()].filter(m=>['image/png','image/jpeg','image/webp'].includes(m.mimeType)).map(m=><option key={m.id} value={m.id}>{m.filename}</option>)}</select></label>
  <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this image for this exact frame; linking resets review</label><button className="btn btn-secondary btn-sm" disabled={busy||!mediaId||!confirmed} onClick={()=>void command({kind:'link',mediaId})}>Link selected image</button>
  {[['First',shot?.firstFrameMediaId],['Last',shot?.lastFrameMediaId]].map(([label,id])=>id?<button key={label} className="btn btn-ghost btn-sm" disabled={busy||!confirmed} onClick={()=>void command({kind:'link',mediaId:id,provenance:{kind:'legacy_adoption'}})}>Adopt legacy {label} image explicitly</button>:null)}
  {active&&<><button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>void command({kind:'clear'})}>Clear frame image association</button><button className="btn btn-secondary btn-sm" disabled={busy||!confirmed} onClick={()=>void command({kind:'review',reviewStatus:'approved'})}>Mark image reviewed</button><button className="btn btn-ghost btn-sm" disabled={busy||!confirmed} onClick={()=>void command({kind:'review',reviewStatus:'needs_changes'})}>Image needs changes</button></>}
  <p className="muted-text">Uploads and reuse always need review. Clear keeps the file and append-only history. No images are generated here.</p><FrameImageHistory events={events} disabled={busy||!confirmed} onReuse={event=>{if(event.mediaId)void command({kind:'link',mediaId:event.mediaId});}}/>{error&&<p role="alert">{error}</p>}
 </section>;
}
