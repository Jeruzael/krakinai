import type {SavedScene} from '../types/domain';
export interface ImageFrameExportFiles {document:string;full?:string;compact?:string}
/** Export captured text exactly. No assembler or external generation runs here. */
export function keyframeExportDocuments(scene:SavedScene,directory:string,component:(label:string,id:string)=>string){
 const frameFiles:Record<string,ImageFrameExportFiles>={},texts:{path:string;text:string}[]=[];
 for(const frame of scene.keyframePlan?.frames??[]){
  const base=`${directory}/image-frames/${component('frame',frame.id)}`,snapshot=scene.imagePromptSnapshots?.[frame.id],manual=scene.manualImageOutputs?.[frame.id];
  const effective={full:manual?.full?.text??snapshot?.full,compact:manual?.compact?.text??snapshot?.compact};
  const paths:ImageFrameExportFiles={document:`${base}/image-prompt.json`};
  for(const mode of ['full','compact'] as const)if(effective[mode]!==undefined){paths[mode]=`${base}/${mode}.txt`;texts.push({path:paths[mode]!,text:effective[mode]!});}
  texts.push({path:paths.document,text:JSON.stringify({schema:'krakinai.image-prompt.v1',sceneId:scene.id,keyframeId:frame.id,frame,canonicalSnapshot:snapshot??null,manualOutputs:manual??{},effectiveOutputs:effective,correspondence:manual?'unverified':'captured'},null,2)});frameFiles[frame.id]=paths;
 }
 return{frameFiles,texts};
}
