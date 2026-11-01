import React,{useRef,useState}from'react';
import type{ChangeSet,ChangeSetState}from'../types/changeSet';
import type{BuilderSlot,SceneDraft,SavedScene}from'../types/domain';
import type{RecipeResolvedPreview}from'../domain/changeSetRecipe';
import type{ConversionOperation}from'../domain/recipeConversion';
import{SLOT_LABELS,SLOT_TO_CATEGORY,ALLOWED_IMAGE_MIMES,ALLOWED_VIDEO_MIMES}from'../domain/validation';
import{ORDERED_BUILDER_SLOTS}from'../domain/promptAssembler';
import{SHOT_TYPES,SHOT_TYPE_LABELS,getShotTypeRules}from'../domain/shotTypeRules';
import{ensemblePatchFromMapping}from'../domain/recipeConversionRequest';
import{generateId}from'../storage/db';
import{StudioDialog}from'./StudioDialog';
import{EnsembleControls}from'./EnsembleControls';
import{resolveImportedBindings}from'../domain/changeSetReferences';
import{applyRecipeEnsemblePatch}from'../domain/changeSetEnsemble';
export function RecipeMappingEditor({input,operation,source,state,resolved,onChange}:{input:ChangeSet;operation:ConversionOperation;source:SavedScene;state:ChangeSetState;resolved?:RecipeResolvedPreview;onChange(op:ConversionOperation,extra?:ChangeSet['operations'][number]):void}){
 const[slot,setSlot]=useState<BuilderSlot>(),[search,setSearch]=useState(''),[proposing,setProposing]=useState(false),[candidateDrafts,setCandidateDrafts]=useState<Record<string,{title:string;text:string}>>({}),[error,setError]=useState('');
 const draftKey=JSON.stringify([source.id,operation.operationId,slot]);
 const candidateTitle=candidateDrafts[draftKey]?.title??'',candidateText=candidateDrafts[draftKey]?.text??'';
 const setCandidateTitle=(title:string)=>{if(slot)setCandidateDrafts(previous=>({...previous,[draftKey]:{title,text:previous[draftKey]?.text??''}}))};
 const setCandidateText=(text:string)=>{if(slot)setCandidateDrafts(previous=>({...previous,[draftKey]:{title:previous[draftKey]?.title??'',text}}))};
 const trigger=useRef<HTMLButtonElement|null>(null),op=operation;
 const slots=resolved?.components??{},rules=getShotTypeRules({shotType:op.shotType});
 const change=(patch:Partial<ConversionOperation>)=>{setError('');onChange({...op,...patch})};
 const replace=(value:string)=>{
  if(!slot)return;const asset=state.assets.find(a=>a.id===value),overrides={...op.overrides};delete overrides[slot as Exclude<BuilderSlot,'character'>];
  const next={...op,assetRefs:[...(op.assetRefs??[]).filter(r=>r.slot!==slot),...(asset?[{slot,asset:{id:asset.id},expectedRevision:asset.revision}]:[])],variantRefs:op.variantRefs?.filter(r=>r.slot!==slot)};
  if(Object.keys(overrides).length)next.overrides=overrides;else delete next.overrides;
  setError('');onChange(next);
 };
 let draft:SceneDraft={id:'transient-mapping',title:op.title,authoringMode:'recipe',slots:{...slots},extraRequiredSlots:[],sceneInstructions:op.sceneInstructions??'',settings:op.settings,manualOutputs:{},resultMediaLinks:[],reviewNotes:'',reviewStatus:'unreviewed',inputRevision:1,updatedAt:source.updatedAt,shotType:op.shotType,...(op.dialogue?{dialogue:op.dialogue}:{})};
 let ensembleUnresolved=false;
 // Editing derives participant inputs from the current operation, never a late preview.
 // Candidate bindings stay untouched in the package and cannot masquerade as stored IDs.
 try{
  delete draft.slots.character;delete draft.slots.wardrobe;
  const owned=(slot:BuilderSlot)=>['character','wardrobe'].includes(slot);
  if(!op.ensemble){
   if(op.assetRefs?.some(r=>owned(r.slot)&&'ref'in r.asset))throw Error('Unresolved participant candidate.');
   for(const s of resolveImportedBindings({assetRefs:op.assetRefs?.filter(r=>owned(r.slot)),variantRefs:op.variantRefs?.filter(r=>owned(r.slot))},state,t=>{if('id'in t)return t.id;throw Error('Unresolved candidate.')}))draft.slots[s.slot]=s;
  }else draft=applyRecipeEnsemblePatch(draft,op.ensemble,state,(_kind,t)=>{if('id'in t)return t.id;throw Error('Unresolved participant candidate.')});
 }catch{ensembleUnresolved=true}
 const selected=slot?state.assets.find(a=>(op.assetRefs??[]).some(r=>r.slot===slot&&'id'in r.asset&&r.asset.id===a.id)):undefined;
 const pending=op.pendingInputs??source.pendingInputs??[];
 return <div className="recipe-mapping-editor">
  <div className="import-recipe-components"><table aria-label="Scene recipe mapping"><thead><tr><th scope="col">Component</th><th scope="col">Selection</th><th scope="col">Action</th></tr></thead><tbody>{ORDERED_BUILDER_SLOTS.map(name=>{
   const binding=op.assetRefs?.find(r=>r.slot===name),component=slots[name],owned=!!op.ensemble&&['character','wardrobe'].includes(name);
   const stored=binding&&'id'in binding.asset?state.assets.find(a=>'id'in binding.asset&&a.id===binding.asset.id):undefined,candidate=binding&&'ref'in binding.asset?binding.asset.ref:undefined;
   const variantRef=op.variantRefs?.find(r=>r.slot===name),variant=variantRef?state.variants?.find(v=>v.id===variantRef.variantId):undefined;
   return <tr key={name}><th scope="row">{SLOT_LABELS[name]}</th><td><strong>{owned?`${op.ensemble?.participantUpserts?.length??resolved?.ensemble?.participants.length??0} participant assignments`:stored?.title??variant?.title??(candidate?`Candidate ${candidate}`:'Not selected')}</strong><small>{rules.inapplicableSlots.includes(name)?'Inactive for this Shot Type':owned?'Edit each participant below':stored||variant?'Stored selection':candidate?'Requires candidate review':binding||variantRef?'Stored selection missing':'Unassigned'}</small></td><td><button className="btn btn-secondary btn-sm" type="button" disabled={owned} aria-label={'Change '+SLOT_LABELS[name]} onClick={e=>{trigger.current=e.currentTarget;setSlot(name);setSearch('');setProposing(false);setError('')}}>Change</button></td></tr>;
  })}</tbody></table></div>
  <section className="card"><h3>People and dialogue</h3>{ensembleUnresolved?<p className="banner banner-warning">Participant candidates are unresolved. Review their create/reuse decisions in the batch, or ask Codex for a revised mapping. Their bindings remain in this package.</p>:<EnsembleControls draft={draft} assets={state.assets} variants={state.variants??[]} onChange={next=>{
   try{const changed={...op,ensemble:ensemblePatchFromMapping(next),assetRefs:op.assetRefs?.filter(r=>!['character','wardrobe'].includes(r.slot)),variantRefs:op.variantRefs?.filter(r=>!['character','wardrobe'].includes(r.slot))};delete changed.dialogue;delete changed.identitySource;onChange(changed);return true}catch(cause){setError((cause as Error).message);return false}
  }}/>}</section>
  <details className="card"><summary>Scene instructions and negative text</summary><label>Scene instructions<textarea className="textarea" rows={4} maxLength={4000} value={op.sceneInstructions??''} onChange={e=>change({sceneInstructions:e.target.value})}/></label><label>Negative instructions<textarea className="textarea" rows={3} maxLength={100000} value={op.avoidText??''} onChange={e=>change({avoidText:e.target.value})}/></label></details>
  <details className="card"><summary>Shot settings · {op.settings.aspectRatio} · {op.settings.durationSeconds}s</summary><div className="recipe-field-grid"><label>Shot Type<select className="select" value={op.shotType} onChange={e=>change({shotType:e.target.value as ConversionOperation['shotType']})}>{SHOT_TYPES.map(t=><option key={t} value={t}>{SHOT_TYPE_LABELS[t]}</option>)}</select></label><label>Aspect ratio<select className="select" value={op.settings.aspectRatio} onChange={e=>change({settings:{...op.settings,aspectRatio:e.target.value as '16:9'|'9:16'|'1:1'}})}>{['16:9','9:16','1:1'].map(r=><option key={r}>{r}</option>)}</select></label><label>Duration (seconds)<input className="input" type="number" min={1} max={60} step="any" value={op.settings.durationSeconds??''} onChange={e=>change({settings:{...op.settings,durationSeconds:Number(e.target.value)}})}/></label></div></details>
  {rules.sourceKind&&<section className="card"><h3>Source Media — original {rules.sourceKind} required</h3><p>Choose the actual stored original. Upload missing originals through Source Media in Scene Builder, then return with your downloaded mapping package.</p><label>Stored original {rules.sourceKind}<select className="select" value={(op.sourceMedia??source.sourceMediaLinks)?.[0]?.mediaId??''} onChange={e=>{const media=state.media.find(m=>m.id===e.target.value);change({sourceMedia:media?[{mediaId:media.id,role:'reference',mimeType:media.mimeType,altText:'Original source '+rules.sourceKind}]:[]})}}><option value="">Select an original…</option>{state.media.filter(m=>(rules.sourceKind==='image'?ALLOWED_IMAGE_MIMES:ALLOWED_VIDEO_MIMES).has(m.mimeType)).map(m=><option key={m.id} value={m.id}>{m.filename}</option>)}</select></label></section>}
  <details className="card"><summary>Pending production inputs ({pending.length})</summary><p>These are requirements, not uploaded media. Removing one is an explicit omission reviewed before saving.</p>{pending.map(p=><article key={p.id}><strong>{p.label}</strong>{p.notes&&<p>{p.notes}</p>}<button className="btn btn-secondary btn-sm" onClick={()=>change({pendingInputs:pending.filter(x=>x.id!==p.id)})}>Remove pending requirement {p.label}</button></article>)}</details>
  {error&&<p className="banner banner-warning" role="alert">{error}</p>}
  {slot&&<StudioDialog title={'Map '+SLOT_LABELS[slot]} size="wide" returnFocusRef={trigger} onClose={()=>setSlot(undefined)} footer={<button type="button" className="btn btn-primary" onClick={()=>setSlot(undefined)}>Done mapping</button>}>
   <label>Search {SLOT_LABELS[slot]}<input className="input" type="search" aria-label={'Search '+SLOT_LABELS[slot]} value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>{SLOT_LABELS[slot]} asset<select className="select" aria-label={SLOT_LABELS[slot]+' asset'} value={selected?.id??''} onChange={e=>replace(e.target.value)}><option value="">Unassigned</option>{state.assets.filter(a=>a.category===SLOT_TO_CATEGORY[slot]&&(`${a.title} ${a.tags.join(' ')}`).toLowerCase().includes(search.toLowerCase())).map(a=><option key={a.id} value={a.id}>{a.title} · rev {a.revision}</option>)}</select></label>
   {selected&&<><p><code>{selected.id}</code> · rev {selected.revision}</p><details><summary>Complete component prompt {slot==='character'?'(identity locked)':''}</summary><textarea readOnly rows={5} value={selected.promptText}/></details>{slot!=='character'&&<label>Scene-only override<textarea rows={4} maxLength={100000} value={op.overrides?.[slot]?.overrideText??''} onChange={e=>change({overrides:{...op.overrides,[slot]:{...op.overrides?.[slot],overrideText:e.target.value}}})}/></label>}</>}
   <button type="button" className="btn btn-secondary" onClick={()=>setProposing(!proposing)}>Propose missing {SLOT_LABELS[slot]}</button>
   {proposing&&<section><p>This adds a candidate proposal, not a library record. Creation/reuse needs explicit batch review.</p><label>Candidate title<input className="input" maxLength={100} value={candidateTitle} onChange={e=>setCandidateTitle(e.target.value)}/></label><label>Candidate prompt<textarea rows={5} maxLength={12000} value={candidateText} onChange={e=>setCandidateText(e.target.value)}/></label><button type="button" className="btn btn-secondary" disabled={!candidateTitle.trim()||!candidateText.trim()||input.operations.filter(o=>o.type.startsWith('asset.')||o.type.startsWith('variant.')).length>=50} onClick={()=>{
    const id=generateId('candidate');const extra={operationId:id,type:'asset.propose' as const,clientRef:id,kind:slot,title:candidateTitle,promptText:candidateText,tags:[],sourceScene:{id:source.id}};
    onChange({...op,assetRefs:[...(op.assetRefs??[]).filter(r=>r.slot!==slot),{slot,asset:{ref:id}}],variantRefs:op.variantRefs?.filter(r=>r.slot!==slot)},extra);setProposing(false);setCandidateTitle('');setCandidateText('');
   }}>Add candidate to mapping</button></section>}
  </StudioDialog>}
 </div>;
}
