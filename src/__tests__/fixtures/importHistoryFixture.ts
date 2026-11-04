import {seedKeyframeStorage} from './keyframeStorageFixture';
import {writeRecord} from './ensembleStorageFixture';
import {getAllSnapshot} from '../../storage/db';
import {NULL_BLOCKING_DIGEST} from '../../domain/blockingPatch';
import {conversionBlockingPatch} from '../../domain/blockingConversionMapping';
import {conversionKeyframePatch} from '../../domain/keyframeConversionMapping';
import {ensemblePatchFromMapping} from '../../domain/recipeConversionRequest';
import {emptyChangeSetApproval,type ChangeSet,type ChangeOperation} from '../../types/changeSet';
/** Independent synthetic bulk Recipe fixture; no real story, library IDs or uploads. */
export async function seedImportHistoryBulk(){
 const f=await seedKeyframeStorage(),state=await getAllSnapshot(),collection=state.collections.find(c=>c.id===f.projectId)!,sources=[];
 for(let i=0;i<15;i++){
  const source=structuredClone(f.parent),id='history-source-'+String(i+1).padStart(2,'0'),shotId='history-shot-'+String(i+1).padStart(2,'0');
  source.id=id;source.title='Synthetic continuity moment '+(i+1);source.sceneRevision={version:1,rootSceneId:id,sequence:1,createdAt:source.createdAt};delete source.versionOfSceneId;delete source.separateTakeOfSceneId;
  if(i>=3){source.keyframePlan!.frames=source.keyframePlan!.frames.filter(frame=>frame.id!=='middle');delete source.imagePromptSnapshots!.middle;}
  collection.project!.shots.push({id:shotId,code:'H'+String(i+1).padStart(2,'0'),title:source.title,order:collection.project!.shots.length,takeSceneIds:[id],selectedSceneId:id,status:'prompt_ready',plannedShotType:source.shotType,plannedDurationSeconds:source.settings.durationSeconds});
  collection.members.push({type:'scene',id,addedAt:source.createdAt});sources.push(source);await writeRecord('scenes',source);
 }
 await writeRecord('collections',collection);
 const base={packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex' as const},appliedAt:f.parent.createdAt,approval:emptyChangeSetApproval(),idMappings:{},operations:[{operationId:'historical',type:'project.update' as const,status:'updated' as const}],projectRevisions:{}};
 await writeRecord('preferences',{...state.preferences,aiImports:{version:3,receipts:[{...base,version:1,changeSetId:'synthetic-old-v1'},{...base,version:2,changeSetId:'synthetic-old-v5',changeSetSchema:'krakinai.change-set.v5',reviewedContent:'{"blockingContinuity":[],"blockingScenes":[],"review":{}}'},{...base,version:3,changeSetId:'synthetic-old-v6',changeSetSchema:'krakinai.change-set.v6',reviewedContent:'{"collections":[],"findings":[],"operations":[],"scenes":[]}',frameResults:[]}],candidates:[]}});
 const operations:ChangeOperation[]=[];
 for(const [i,source]of sources.entries()){
  const shotId='history-shot-'+String(i+1).padStart(2,'0'),operationId='history-recipe-'+String(i+1).padStart(2,'0'),clientRef='history-take-'+(i+1),plan=structuredClone(source.keyframePlan!);
  for(const frame of plan.frames){frame.referenceAssociationIds=[];frame.visualInstructions='Synthetic moment '+(i+1)+': maintain the original identities, wardrobe, room and blocking while depicting this exact frozen pose.';}
  operations.push({operationId,type:'scene.create_recipe',clientRef,title:source.title,shotType:source.shotType??'character_scene',settings:{...source.settings,aspectRatio:source.settings.aspectRatio??'16:9',durationSeconds:source.settings.durationSeconds??8},project:{id:f.projectId,expectedRevision:collection.project!.revision},shot:{id:shotId},sceneInstructions:source.sceneInstructions,ensemble:ensemblePatchFromMapping(f.draft),assetRefs:Object.entries(source.slots).filter(([slot,snapshot])=>snapshot&&snapshot.sourceType==='asset'&&!['character','wardrobe'].includes(slot)).map(([slot,snapshot])=>({slot:slot as import('../../types/domain').BuilderSlot,asset:{id:snapshot!.sourceId},expectedRevision:snapshot!.sourceRevision})),blocking:conversionBlockingPatch(source.blocking,NULL_BLOCKING_DIGEST),keyframes:conversionKeyframePatch(plan,NULL_BLOCKING_DIGEST),videoDecision:'reassemble'});
  operations.push({operationId:'history-select-'+(i+1),type:'shot.select_take',project:{id:f.projectId,expectedRevision:collection.project!.revision},shot:{id:shotId},scene:{ref:clientRef},expectedSelectedSceneId:source.id});
 }
 const input:ChangeSet={schema:'krakinai.change-set.v6',changeSetId:'synthetic-history-bulk-15',source:{kind:'codex',label:'Independent synthetic import history certification'},title:'Synthetic continuity batch — 15 shots',operations};
 const approval={...f.approval,preferred:true};
 return{input:JSON.parse(JSON.stringify(input)) as ChangeSet,approval,sourceIds:sources.map(s=>s.id),projectId:f.projectId,projectName:collection.name,sceneId:f.parent.id,shotId:f.shotId,frameCount:33,assetIds:state.assets.map(a=>a.id),variantIds:state.variants.map(v=>v.id)};
}

/** Valid historical receipt fields, independent of any live proposal. */
export function boundaryImportLedger(targetBytes=8*1024*1024){
 const base={version:3 as const,packageDigest:'a'.repeat(64),approvedDigest:'b'.repeat(64),source:{kind:'codex' as const},appliedAt:'2026-11-05T00:00:00Z',approval:emptyChangeSetApproval(),idMappings:{},operations:[{operationId:'historical',type:'project.update' as const,status:'updated' as const}],projectRevisions:{},changeSetSchema:'krakinai.change-set.v6' as const,frameResults:[]};
 const review=(bytes:number)=>{const empty='{"collections":[],"findings":[{"message":""}],"operations":[],"scenes":[]}';return empty.replace('"message":""','"message":"'+'x'.repeat(bytes-empty.length)+'"');};
 const receipts=[{...base,changeSetId:'boundary-one',reviewedContent:review(4*1024*1024)},{...base,changeSetId:'boundary-two',reviewedContent:review(4*1024*1024-2000)}],ledger={version:4 as const,receipts,candidates:[]};
 const difference=targetBytes-new TextEncoder().encode(JSON.stringify(ledger)).length;receipts[1].reviewedContent=review(4*1024*1024-2000+difference);return ledger;
}
export async function expandedBoundaryImportLedger(){
 const {encodeImportEvidence}=await import('../../domain/importEvidence');
 const plain='{"collections":[],"findings":[{"message":""}],"operations":[],"scenes":[]}',text=plain.replace('"message":""','"message":"'+'x'.repeat(4*1024*1024-plain.length)+'"'),reviewedEvidence=await encodeImportEvidence(text),base=boundaryImportLedger(8*1024*1024).receipts[0];
 const {reviewedContent,...fields}=base;void reviewedContent;
 return{version:4 as const,receipts:Array.from({length:8},(_,i)=>({...fields,version:4 as const,changeSetId:'expanded-'+i,reviewedEvidence})),candidates:[]};
}

export async function incompressibleImportLedger(){
 const {encodeImportEvidence}=await import('../../domain/importEvidence'),plain='{"collections":[],"findings":[{"message":""}],"operations":[],"scenes":[]}',alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(33+i)).filter(c=>c!=='"'&&c!==String.fromCharCode(92)).join('');
 let seed=2463534242;const parts:string[]=[];for(let n=0;n<4*1024*1024-plain.length;){let part='';for(let i=0;i<8192&&n<4*1024*1024-plain.length;i++,n++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;part+=alphabet[(seed>>>0)%alphabet.length];}parts.push(part);}
 const reviewedEvidence=await encodeImportEvidence(plain.replace('"message":""',()=>'"message":"'+parts.join('')+'"')),base=boundaryImportLedger().receipts[0],{reviewedContent,...fields}=base;void reviewedContent;
 return{version:4 as const,receipts:[{...fields,version:4 as const,changeSetId:'incompressible',reviewedEvidence}],candidates:[]};
}
