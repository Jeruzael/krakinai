import {strToU8} from 'fflate';
import type {LibrarySnapshot} from '../storage/db';
import {PROJECT_EXPORT_MEDIA_LIMIT,PROJECT_EXPORT_TEXT_LIMIT,PROJECT_EXPORT_ENTRY_LIMIT,compressProjectEntries} from './projectExport';
import {canonicalStringify,changeSetDigest} from './changeSetCanonical';
import {getActiveFrameImage,frameMediaSignature} from './frameImageAssociations';
import {prepareStoredFrameImage} from './frameImageMedia';
import {flowCompatibility} from './flowCompatibility';
export interface FlowHandoffSelection{projectId:string;expectedProjectRevision:number;shotId:string;sceneId:string;expectedSceneRevision:number;mode:'frames'|'ingredients';frames:{frameId:string;role:'start'|'end'|'ingredient'}[];referenceAssociationIds:string[];excludedSelectionIds:string[];modelKey:string}
export interface FlowHandoffAssociation{id:string;frameId?:string;associationId?:string;mediaId:string;role:string;order:number;path?:string;sha256?:string;excluded:boolean;missing:boolean}
export interface FlowHandoffPlan{selection:FlowHandoffSelection;basis:string;complete:boolean;findings:string[];warnings:string[];exclusions:string[];associations:FlowHandoffAssociation[];files:{mediaId:string;path:string;sha256:string;signature:string;byteSize:number}[];texts:{path:string;text:string}[];estimatedMediaBytes:number;estimatedTextBytes:number;estimatedEntries:number;guidance:ReturnType<typeof flowCompatibility>}
const abort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Handoff cancelled.','AbortError');};
const safe=(id:string)=>id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64)||'frame';
export async function planFlowHandoff(selection:FlowHandoffSelection,snapshot:LibrarySnapshot,options:{signal?:AbortSignal}={}):Promise<FlowHandoffPlan>{
 abort(options.signal);const collection=snapshot.collections.find(c=>c.id===selection.projectId),shot=collection?.project?.shots.find(s=>s.id===selection.shotId),scene=snapshot.scenes.find(s=>s.id===selection.sceneId);
 if(!collection?.project||collection.project.revision!==selection.expectedProjectRevision||!scene||scene.revision!==selection.expectedSceneRevision||!shot?.takeSceneIds.includes(scene.id))throw Error('Exact project/shot/take revision changed. Preview the handoff again.');
 if(scene.authoringMode==='direct_prompt')throw Error('Use the guided Recipe conversion before preparing frame prompts. The Direct Prompt is preserved.');
 if(!['frames','ingredients'].includes(selection.mode)||selection.frames.length>16||selection.referenceAssociationIds.length>2000||selection.excludedSelectionIds.length>2000||selection.modelKey.length>100||new Set(selection.frames.map(f=>f.frameId)).size!==selection.frames.length||new Set(selection.referenceAssociationIds).size!==selection.referenceAssociationIds.length||new Set(selection.excludedSelectionIds).size!==selection.excludedSelectionIds.length)throw Error('Invalid or excessive handoff selection.');
 const findings:string[]=[],warnings=['Manual preparation only. No upload or generation occurs. Middle/intermediate frame timing is not guaranteed.'],associations:FlowHandoffAssociation[]=[],files:FlowHandoffPlan['files']=[],texts:FlowHandoffPlan['texts']=[],excluded=new Set(selection.excludedSelectionIds),media=new Map(snapshot.media.map(m=>[m.id,m])),guidance=flowCompatibility(selection.modelKey,selection.mode);
 warnings.push(guidance.message);if(guidance.status==='Unsupported')findings.push('Choose a model/mode supported by the dated guidance, or Unknown to prepare a clearly unverified manual package.');
 const addText=(path:string,text:string)=>texts.push({path,text});
 for(const mode of ['full','structured','compact'] as const)addText(`video/${mode}.txt`,scene.outputs[mode]);
 for(const [order,frameSelection]of selection.frames.entries()){
  const {frameId,role}=frameSelection,frame=scene.keyframePlan?.frames.find(f=>f.id===frameId);if(!frame)throw Error('Selected frame ID is unavailable. Preview the exact take again.');
  if(!['start','end','ingredient'].includes(role)||selection.mode==='frames'&&role==='ingredient'||selection.mode==='ingredients'&&role!=='ingredient')throw Error('Choose explicit frame roles for the selected handoff mode.');
  const active=getActiveFrameImage(collection.project.frameProduction,{shotId:shot.id,sceneId:scene.id,frameId}),row:FlowHandoffAssociation={id:`frame:${frameId}`,frameId,mediaId:active?.mediaId??'',role,order,excluded:excluded.has(`frame:${frameId}`),missing:!active?.mediaId||!media.has(active.mediaId)};associations.push(row);
  const captured=scene.imagePromptSnapshots?.[frameId],manual=scene.manualImageOutputs?.[frameId];
  for(const mode of ['full','compact'] as const){const text=manual?.[mode]?.text??captured?.[mode];if(text!==undefined)addText(`frames/${safe(frameId)}/${mode}.txt`,text);else if(!row.excluded)findings.push(`Complete ${mode} image prompt missing for frame ${frameId}.`);}
  if(manual)warnings.push(`Frame ${frameId}: manual image text is unverified.`);if(active?.reviewStatus!=='approved')warnings.push(`Frame ${frameId}: image needs human review.`);
 }
 for(const [index,id]of selection.referenceAssociationIds.entries()){
  const entry=scene.referencePack?.entries.find(e=>e.associationId===id);if(!entry)throw Error('Selected reference association is unavailable; no substitute was selected.');
  associations.push({id:`reference:${id}`,associationId:id,mediaId:entry.mediaId,role:`reference:${entry.role}`,order:selection.frames.length+index,excluded:excluded.has(`reference:${id}`),missing:!media.has(entry.mediaId)});
 }
 if([...excluded].some(id=>!associations.some(row=>row.id===id)))throw Error('Exclude only explicitly selected frame/reference association IDs.');
 const selected=associations.filter(row=>!row.excluded);
 if(!selected.length)findings.push('Select at least one actual available image. No complete handoff can be built from excluded or missing files.');
 if(selection.mode==='frames'&&(selected.filter(row=>row.frameId&&row.role==='start').length!==1||selected.filter(row=>row.frameId&&row.role==='end').length>1||selected.some(row=>!row.frameId)))findings.push('Frames requires exactly one Start image and optionally one End image. Use Ingredients for reference associations.');
 const seen=new Set<string>();let mediaBytes=0;
 for(const row of selected){const file=media.get(row.mediaId);if(!file||row.missing){findings.push(`Selected image missing for ${row.id}. Upload it or explicitly exclude it.`);continue;}
  if(!seen.has(file.id)){mediaBytes+=file.byteSize;if(mediaBytes>PROJECT_EXPORT_MEDIA_LIMIT)throw Error('Handoff exceeds 128 MiB selected media. Exclude associations explicitly.');seen.add(file.id);}
 }
 // Budget metadata/text before allocating file buffers. All final UTF-8 bytes are checked again.
 let textBytes=texts.reduce((sum,t)=>sum+strToU8(t.text).length,0);if(textBytes+strToU8(JSON.stringify(associations)).length>PROJECT_EXPORT_TEXT_LIMIT)throw Error('Handoff exceeds the 16 MiB text budget; no prompt was truncated.');
 if(seen.size+texts.length+2>PROJECT_EXPORT_ENTRY_LIMIT)throw Error('Handoff exceeds 2000 archive entries.');
 for(const row of selected){abort(options.signal);const file=media.get(row.mediaId);if(!file)continue;let prepared=files.find(f=>f.mediaId===file.id);
  if(!prepared){try{const proof=await prepareStoredFrameImage(file,{signal:options.signal}),extension=file.mimeType==='image/jpeg'?'jpg':file.mimeType==='image/webp'?'webp':'png';prepared={mediaId:file.id,path:`images/${(await changeSetDigest(file.id)).slice(0,24)}.${extension}`,sha256:proof.sha256,signature:proof.signature,byteSize:file.byteSize};files.push(prepared);}catch(e){abort(options.signal);findings.push(`Selected image invalid or unsupported for ${row.id}: ${e instanceof Error?e.message:String(e)}`);continue;}}
  row.path=prepared.path;row.sha256=prepared.sha256;
  if(row.frameId){const active=getActiveFrameImage(collection.project.frameProduction,{shotId:shot.id,sceneId:scene.id,frameId:row.frameId});if(active?.sha256!==prepared.sha256)findings.push(`Selected frame image bytes changed for ${row.frameId}. Review and associate the current original explicitly.`);}
 }
 const basis=await changeSetDigest({selection,collection,scene,files,texts});abort(options.signal);
 return{selection:structuredClone(selection),basis,complete:findings.length===0,findings,warnings,exclusions:[...excluded],associations,files,texts,estimatedMediaBytes:mediaBytes,estimatedTextBytes:textBytes,estimatedEntries:files.length+texts.length+2,guidance};
}
export async function buildFlowHandoff(plan:FlowHandoffPlan,snapshot:LibrarySnapshot,options:{signal?:AbortSignal}={}){
 abort(options.signal);if(!plan.complete)throw Error('Incomplete handoff: '+plan.findings.join(' '));const current=await planFlowHandoff(plan.selection,snapshot,options);if(!current.complete||current.basis!==plan.basis||canonicalStringify(current.associations)!==canonicalStringify(plan.associations))throw Error('Handoff source, prompt, image bytes or metadata changed. Preview again.');
 const entries:Record<string,Uint8Array>={},textFiles:{path:string;sha256:string;byteSize:number}[]=[];let textBytes=0;
 const addText=async(path:string,text:string)=>{if(entries[path])throw Error('Duplicate safe handoff path.');const bytes=strToU8(text);textBytes+=bytes.length;if(textBytes>PROJECT_EXPORT_TEXT_LIMIT)throw Error('Handoff exceeds the 16 MiB text budget.');entries[path]=bytes;textFiles.push({path,byteSize:bytes.length,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')});};
 for(const text of current.texts)await addText(text.path,text.text);
 await addText('README.txt',`KRAKINAI manual Flow handoff\nThis is a selected-file handoff, not a full-library backup.\nNo upload or generation occurs. Open Flow yourself, confirm its active model/mode, attach the manifest-selected images, and paste video/full.txt (or another complete mode). Frames: use exactly the selected Start and optional End. Ingredients: reference roles do not guarantee timed poses. Middle-frame timing is not guaranteed.\nSource take: ${plan.selection.sceneId}\nExclusions: ${plan.exclusions.join(', ')||'None'}\n${current.warnings.join('\n')}\nGuidance checked ${current.guidance.checkedAt}\n${current.guidance.sources.join('\n')}\n`);
 for(const file of current.files){abort(options.signal);const original=snapshot.media.find(m=>m.id===file.mediaId)!;if(frameMediaSignature(original)!==file.signature)throw Error('Image metadata changed during export.');entries[file.path]=new Uint8Array(await original.blob.arrayBuffer());}
 const manifest={schema:'krakinai.flow-handoff.v1' as const,selection:current.selection,basis:current.basis,associations:current.associations,exclusions:current.exclusions,files:current.files.map(({signature,...file})=>file),textFiles,guidance:current.guidance,warnings:current.warnings};
 const manifestBytes=strToU8(JSON.stringify(manifest,null,2));textBytes+=manifestBytes.length;if(textBytes>PROJECT_EXPORT_TEXT_LIMIT)throw Error('Handoff metadata exceeds 16 MiB.');entries['manifest.json']=manifestBytes;if(Object.keys(entries).length>PROJECT_EXPORT_ENTRY_LIMIT)throw Error('Handoff exceeds 2000 entries.');
 const bytes=await compressProjectEntries(entries,options.signal);return{bytes,filename:`krakinai-handoff-${safe(current.selection.sceneId)}.zip`,manifest};
}
