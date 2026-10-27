import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { StudioDialog } from './StudioDialog';
export const CollectionMembershipBadge: React.FC<{sceneId:string}> = ({sceneId}) => {
 const {snapshot,navigate} = useLibrary();
 const [open,setOpen] = useState(false);
 const collections = snapshot?.collections.filter(c=>c.members.some(m=>m.type==='scene' && m.id===sceneId)) ?? [];
 return <><button className="btn btn-secondary btn-sm" style={{alignSelf:'flex-start'}} type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)}>{collections.length === 0 ? 'Not in a Collection':collections.length === 1 ? `In ${collections[0].name}`:`In ${collections.length} Collections`}</button>{open && <StudioDialog title="Scene Collections" onClose={()=>setOpen(false)}>{collections.length ? collections.map(c=><p key={c.id}><a href={`#/collections/${encodeURIComponent(c.id)}?tab=scenes`} onClick={e=>{e.preventDefault();setOpen(false);navigate(`/collections/${encodeURIComponent(c.id)}?tab=scenes`);}}>{c.name}</a></p>):<p>Not in a Collection</p>}</StudioDialog>}</>;
};
