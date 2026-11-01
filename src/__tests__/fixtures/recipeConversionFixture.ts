import { recipeChangeSet, recipeState, recipeTime } from './recipeChangeSetFixture';
import { planAuthoredScene } from '../../storage/sceneAuthoring';
import type { ChangeSetState, ChangeSetApproval } from '../../types/changeSet';
import { recipeApproval } from './recipeChangeSetFixture';
export const conversionSourceText = '  Synthetic original: wait in the courtyard.\r\nSOURCE_ONLY_DO_NOT_COPY 😊  ';
export function conversionPackage(): any {
  const p = recipeChangeSet() as any;
  p.schema = 'krakinai.change-set.v4';
  p.changeSetId = 'synthetic-conversion';
  Object.assign(p.operations[0], {
    operationId: 'convert', clientRef: 'converted', type: 'scene.convert_direct_to_recipe',
    sceneId: 'direct-source', expectedHeadId: 'direct-source',
    conversion: {version:1, sourceTextSha256:'a'.repeat(64), mappings:[
      {id:'environment-map',target:{kind:'slot',slot:'environment'},assessment:'suggested'},
    ]},
  });
  return p;
}
export function conversionState(): ChangeSetState {
  const state = recipeState();
  const draft: any = {id:'source-draft',inputRevision:1,updatedAt:recipeTime,title:'Synthetic Direct source',authoringMode:'direct_prompt',directPrompt:{version:1,text:conversionSourceText,origin:'manual'},slots:{},extraRequiredSlots:[],sceneInstructions:'',settings:{aspectRatio:'16:9',durationSeconds:4},manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',shotType:'property_environment',pendingInputs:[{version:1,id:'pending-frame',kind:'reference_image',label:'Synthetic first frame — not uploaded'}]};
  const result=planAuthoredScene(draft,{requestId:'source',expectedInputRevision:1,target:{collectionId:'project',shotId:'shot',expectedProjectRevision:1},selectAsPreferred:true},state,{id:'direct-source',now:recipeTime});
  state.scenes=[result.scene];state.collections=[result.collection!];return state;
}
export function conversionApproval(): ChangeSetApproval {
  return {...recipeApproval(),conversionDecisions:{convert:{reviewed:true,acknowledgedRowIds:[]}}} as ChangeSetApproval;
}
export async function conversionScenario(){
 const state=conversionState(),input=conversionPackage(),source=state.scenes[0];
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source.outputs.full));
 const sha256=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const op=input.operations[0];op.project.expectedRevision=state.collections[0].project!.revision;
 op.conversion.sourceTextSha256=sha256;
 op.conversion.mappings.push(...(['settings','instructions','pending_inputs'] as const).map(kind=>({id:kind+'-map',target:{kind},assessment:'suggested'})));
 return{state,input,approval:conversionApproval(),proofs:new Map([[source.id,{text:source.outputs.full,sha256}]])};
}
