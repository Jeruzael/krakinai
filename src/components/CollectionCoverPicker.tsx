import React, { useState } from 'react';
import type { MediaAsset } from '../types/domain';
import { StudioDialog } from './StudioDialog';
import { MediaThumbnail } from './MediaThumbnail';
import { saveMediaAsset } from '../storage/db';
import { validateMediaCandidate } from '../domain/validation';
import { getMediaDisplayName } from '../domain/mediaNaming';
export const CollectionCoverPicker: React.FC<{media:MediaAsset[];currentId?:string|null;onSelect:(id:string|null)=>void;onClose:()=>void;onUploaded:()=>Promise<unknown>}> = ({media,currentId,onSelect,onClose,onUploaded}) => {
 const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
 return <StudioDialog title="Choose Collection Cover" onClose={()=>{if(!busy)onClose();}} footer={<><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{onSelect(null);onClose();}}>Remove Cover</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button></>}>
 {currentId && !media.some(m=>m.id===currentId) && <p role="status">Current cover is missing ({currentId}).</p>}
 <label className="form-label">Upload a separate cover image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e=>{
 const file=e.target.files?.[0]; if(!file)return; setError('');
 const check=validateMediaCandidate({name:file.name,type:file.type,size:file.size,existingCount:0,currentTotalBytes:media.reduce((n,m)=>n+m.byteSize+(m.posterBlob?.size??0),0)});
 if(!check.valid || check.kind!=='image'){setError(check.error || 'Choose an image file.');return;}
 setBusy(true);try{const saved=await saveMediaAsset({filename:file.name,mimeType:file.type,blob:file});await onUploaded();onSelect(saved.id);onClose();}catch(err){setError(err instanceof Error?err.message:'Upload failed.');}finally{setBusy(false);}
 }}/></label>{error && <p role="alert">{error}</p>}
 <div className="card-grid">{media.filter(m=>m.mimeType.startsWith('image/')).map(m=><button type="button" className="card" key={m.id} disabled={busy} aria-label={`Use ${getMediaDisplayName(m)} as cover`} aria-pressed={currentId===m.id} onClick={()=>{onSelect(m.id);onClose();}}><div style={{height:120}}><MediaThumbnail media={m} altText={getMediaDisplayName(m)}/></div>{getMediaDisplayName(m)}<small className="muted-text">Original: {m.filename}</small></button>)}</div>
 </StudioDialog>;
};
