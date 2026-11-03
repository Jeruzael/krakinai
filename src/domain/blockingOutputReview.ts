import type {OutputMode,SceneDraft} from '../types/domain';
import type {BlockingFinding} from '../types/blocking';
export type BlockingOutputDecisions=Partial<Record<OutputMode,'canonical'|'keep_manual_unverified'>>;
export interface BlockingOutputResolution{outputs:Record<OutputMode,string>;manualOutputs:SceneDraft['manualOutputs'];findings:BlockingFinding[];valid:boolean}
export function resolveBlockingOutputs(draft:Pick<SceneDraft,'blocking'|'manualOutputs'>,canonical:Record<OutputMode,string>,decisions?:BlockingOutputDecisions,requireReview=false):BlockingOutputResolution{
 const outputs={...canonical},manualOutputs=structuredClone(draft.manualOutputs),findings:BlockingFinding[]=[];
 const modes=['full','structured','compact'] as const,review=!!draft.blocking||requireReview;
 if(decisions!==undefined&&(decisions===null||typeof decisions!=='object'||Array.isArray(decisions)||Object.entries(decisions).some(([mode,choice])=>!modes.includes(mode as OutputMode)||!['canonical','keep_manual_unverified'].includes(choice)||!draft.manualOutputs[mode as OutputMode])))findings.push({code:'BLOCKING_OUTPUT_DECISION_INVALID',severity:'blocking',path:'blockingOutputDecisions',message:'Choose a valid explicit decision only for each active manual output.'});
 for(const mode of modes){
  const manual=draft.manualOutputs[mode];if(!manual)continue;
  outputs[mode]=manual.text;
  if(!review)continue;
  const choice=decisions?.[mode];
  if(choice==='canonical'){outputs[mode]=canonical[mode];delete manualOutputs[mode];}
  else if(choice==='keep_manual_unverified')findings.push({code:'BLOCKING_MANUAL_UNVERIFIED',severity:'advisory',path:`manualOutputs.${mode}`,message:`${mode}: exact manual text retained; blocking correspondence is unverified. Review it manually.`});
  else findings.push({code:'BLOCKING_OUTPUT_DECISION_REQUIRED',severity:'blocking',path:`manualOutputs.${mode}`,message:`Choose newly assembled canonical ${mode} output or keep the exact manual output with unverified blocking correspondence.`});
 }
 return{outputs,manualOutputs,findings,valid:!findings.some(f=>f.severity==='blocking')};
}
