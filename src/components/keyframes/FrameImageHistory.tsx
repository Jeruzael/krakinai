import type {FrameImageEvent} from '../../types/frameProduction';
export function FrameImageHistory({events,onReuse,disabled}:{events:FrameImageEvent[];onReuse?(event:FrameImageEvent):void;disabled?:boolean}){
 return <details><summary>Image history · {events.length} events</summary><ol>{[...events].reverse().map(event=><li key={event.id}><p>{event.kind} · {event.reviewStatus.replaceAll('_',' ')} · {new Date(event.createdAt).toLocaleString()}</p><small>{event.provenance.kind.replaceAll('_',' ')} · {event.id}</small>{event.mediaId&&onReuse&&<button className="btn btn-secondary btn-sm" disabled={disabled} onClick={()=>onReuse(event)}>Reuse this image; review again</button>}</li>)}</ol></details>;
}
