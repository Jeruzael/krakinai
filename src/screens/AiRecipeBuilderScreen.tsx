import React,{useEffect,useRef,useState}from'react';
import{useLibrary}from'../context/LibraryContext';
import type{ChangeSet,ChangeSetPreview}from'../types/changeSet';
import type{ConversionOperation}from'../domain/recipeConversion';
import type{RecipeResolvedPreview}from'../domain/changeSetRecipe';
import{isDirectPrompt}from'../domain/directPrompt';
import{createConversionPackage,reconcileConversionMappings,buildConversionRequest,serializableMappingPackage}from'../domain/recipeConversionRequest';
import{peekRecipePackage,consumeRecipePackage}from'../domain/recipePackageHandoff';
import{parseChangeSet,MAX_CHANGE_SET_BYTES}from'../domain/changeSetValidation';
import{previewChangeSet}from'../storage/changeSets';
import{generateId}from'../storage/db';
import{downloadBlobAsFile}from'../hooks/useObjectUrl';
import{RecipeMappingEditor}from'../components/RecipeMappingEditor';
import{ChangeSetImportScreen}from'./ChangeSetImportScreen';
import './recipeBuilder.css';
export function AiRecipeBuilderScreen(){
 const{snapshot,hashPath,navigate,setDirtyFormGuard}=useLibrary();
 const query=new URLSearchParams(hashPath.split('?')[1]??'');
 const[pkg,setPackage]=useState<ChangeSet|undefined>(peekRecipePackage);
 const initialOp=pkg?.operations.find((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe');
 const[sourceId,setSourceId]=useState(query.get('scene')??initialOp?.sceneId??'');
 const[targetKey,setTargetKey]=useState(()=>query.has('collection')&&query.has('shot')?JSON.stringify([query.get('collection'),query.get('shot')]):initialOp&&'id'in initialOp.project&&'id'in initialOp.shot?JSON.stringify([initialOp.project.id,initialOp.shot.id]):'');
 const[operationId,setOperationId]=useState(initialOp?.operationId??'convert'),[preview,setPreview]=useState<ChangeSetPreview>(),[reviewing,setReviewing]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const[reviewDirty,setReviewDirty]=useState(false),[hasUnsubmitted,setHasUnsubmitted]=useState(false);
 const initGeneration=useRef(0),previewGeneration=useRef(0),selectionKey=useRef(pkg?sourceId+'|'+targetKey:'');
 const source=snapshot?.scenes.find(s=>s.id===sourceId&&isDirectPrompt(s));
 const memberships=(snapshot?.collections??[]).flatMap(c=>(c.project?.shots??[]).filter(s=>s.takeSceneIds.includes(sourceId)).map(s=>({key:JSON.stringify([c.id,s.id]),collection:c,shot:s})));
 const destination=memberships.find(m=>m.key===targetKey);
 const op=pkg?.operations.find((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe'&&o.operationId===operationId);
 useEffect(()=>{if(pkg)consumeRecipePackage(pkg.changeSetId)},[]);
 const dirty=!!pkg&&(!reviewing||reviewDirty)||hasUnsubmitted;
 useEffect(()=>{setDirtyFormGuard(dirty);const guard=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',guard);return()=>{setDirtyFormGuard(false);window.removeEventListener('beforeunload',guard)}},[dirty,setDirtyFormGuard]);
 useEffect(()=>{
  if(!targetKey&&memberships.length===1&&!query.has('collection')&&!pkg){setTargetKey(memberships[0].key);return}
  if(!snapshot||!source||!destination||(pkg&&selectionKey.current===sourceId+'|'+targetKey))return;
  const token=++initGeneration.current;selectionKey.current=sourceId+'|'+targetKey;setError('');
  void createConversionPackage(source,{collectionId:destination.collection.id,shotId:destination.shot.id,expectedProjectRevision:destination.collection.project!.revision},snapshot).then(input=>{if(token===initGeneration.current){setPackage(input);setOperationId('convert')}}).catch(cause=>{if(token===initGeneration.current)setError((cause as Error).message)});
 },[sourceId,targetKey,snapshot]);
 useEffect(()=>{
  const token=++previewGeneration.current;if(!pkg||reviewing)return;
  setBusy(true);const timer=window.setTimeout(()=>{void previewChangeSet(pkg).then(p=>{if(token===previewGeneration.current){setPreview(p);setError('')}}).catch(cause=>{if(token===previewGeneration.current){setPreview(undefined);setError((cause as Error).message)}}).finally(()=>{if(token===previewGeneration.current)setBusy(false)})},120);
  return()=>{clearTimeout(timer);previewGeneration.current++};
 },[pkg,snapshot,reviewing]);
 useEffect(()=>()=>{initGeneration.current++;previewGeneration.current++},[]);
 if(!snapshot)return <p role="status">Loading recipe workspace…</p>;
 const changeSelection=(kind:'source'|'target',value:string)=>{
  if(pkg&&!window.confirm('Changing the source or destination starts a new mapping. Download the current mapping package first if you want to keep these unsaved edits. Continue?'))return;
  initGeneration.current++;selectionKey.current='';setPackage(undefined);setPreview(undefined);setError('');
  if(kind==='source'){setSourceId(value);setTargetKey('')}else setTargetKey(value);
 };
 const update=(next:ConversionOperation,extra?:ChangeSet['operations'][number])=>{
  if(!pkg||!source||!snapshot)return;
  const mapped=reconcileConversionMappings(next,source,snapshot);
  setPackage(serializableMappingPackage({...pkg,operations:[...(extra?[extra]:[]),...pkg.operations.map(o=>o.operationId===mapped.operationId?mapped:o)]}));
 };
 const download=()=>{if(pkg){downloadBlobAsFile(new Blob([JSON.stringify(pkg,null,2)+'\n'],{type:'application/json'}),`krakinai-mapping-${pkg.changeSetId}.json`);setStatus('Complete mapping package download requested. Browser approvals are not included.')}};
 const copyRequest=async()=>{if(!source||!destination)return;try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(buildConversionRequest(source,{collectionId:destination.collection.id,shotId:destination.shot.id,expectedProjectRevision:destination.collection.project!.revision}));setStatus('IDs-only Codex request copied. Permissions are unchanged.')}catch{setError('Copy failed. Use context export and share only explicitly selected records.')}};
 const load=async(file?:File)=>{
  if(!file)return;if(file.size>MAX_CHANGE_SET_BYTES){setError('Mapping package exceeds 20 MiB. It was not read.');return}
  try{
   if(!file.name.toLowerCase().endsWith('.json'))throw Error('Choose a JSON change-set package.');
   const input=parseChangeSet(await file.text()),first=input.operations.find((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe');
   if(input.schema!=='krakinai.change-set.v4'||!first||!('id'in first.project)||!('id'in first.shot))throw Error('Choose a v4 Direct Prompt conversion package. Use Import AI Change Set for other workflows.');
   if(pkg&&!window.confirm('Replace the current unsaved mapping with this package?'))return;
   initGeneration.current++;const key=JSON.stringify([first.project.id,first.shot.id]);selectionKey.current=first.sceneId+'|'+key;setSourceId(first.sceneId);setTargetKey(key);setOperationId(first.operationId);setPackage(input);setPreview(undefined);setError('');setStatus('Mapping loaded without approvals. Review all bindings before saving.');
  }catch(cause){setError((cause as Error).message)}
 };
 const row=preview?.plan.operations.find(r=>r.operationId===op?.operationId),resolved=(row?.resolved as{recipe?:RecipeResolvedPreview}|undefined)?.recipe;
 const blockers=preview?.plan.findings.filter(f=>f.severity==='blocking'&&!f.code.startsWith('APPROVAL_')&&f.code!=='CONVERSION_MAPPING_REVIEW')??[];
 return <>
  {reviewing&&pkg&&<ChangeSetImportScreen initialChangeSet={pkg} onDirtyChange={setReviewDirty} onBack={()=>{setPackage({...pkg,changeSetId:generateId('recipe_mapping')});setReviewing(false)}}/>}
  <section hidden={reviewing} className="ai-recipe-workspace" aria-label="AI Recipe Builder workspace">
  <header className="import-heading"><div><span className="import-eyebrow">Local creation · explicit review</span><h1>AI Recipe Builder</h1><p className="muted-text">Map a saved Direct Prompt into a new recipe alternate take. Preserve the original and its preferred selection.</p></div><button className="btn btn-secondary" onClick={()=>navigate('/connections/ai')}>Connect Codex</button></header>
  <section className="card recipe-start"><div><h2>Build a recipe</h2><p>Start from reusable assets in Scene Builder, or map a saved Direct Prompt below. Codex assistance uses the existing explicit connection and browser review.</p><button className="btn btn-secondary" onClick={()=>navigate('/builder')}>Open Scene Builder</button></div><label>Resume mapping package<input type="file" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void load(file)}}/></label></section>
  <section className="card recipe-field-grid" aria-label="Source and destination"><label>Saved Direct Prompt<select className="select" value={sourceId} onChange={e=>changeSelection('source',e.target.value)}><option value="">Choose a saved Direct Prompt…</option>{snapshot.scenes.filter(isDirectPrompt).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Destination project and shot<select className="select" value={targetKey} onChange={e=>changeSelection('target',e.target.value)}><option value="">Choose its exact project and shot…</option>{memberships.map(m=><option key={m.key} value={m.key}>{m.collection.name} · {m.shot.code} — {m.shot.title}</option>)}</select></label></section>
  {source&&!memberships.length&&<p className="banner banner-warning">Attach this saved Direct Prompt to an existing storyboard shot first. This workflow does not create a replacement project.</p>}
  {sourceId&&!source&&<p className="banner banner-warning" role="alert">This saved Direct Prompt is unavailable. Choose an existing saved source; your unfinished package is preserved.</p>}
  {source&&targetKey&&!destination&&<p className="banner banner-warning" role="alert">The explicit destination no longer contains this source. Select its actual project and shot; nothing has been reassigned.</p>}
  {error&&<p className="banner banner-warning" role="alert">{error} Your package remains available to download.</p>}
  {pkg&&(!source||!destination||!op)&&<section className="card"><p>The source or destination needs attention before assembly. Keep the complete package while resolving it.</p><button type="button" className="btn btn-secondary" onClick={download}>Download mapping package</button></section>}
  {source&&destination&&pkg&&op&&<>
   <section className="card recipe-source"><div className="studio-inline"><span className="badge">Shot {destination.shot.code}</span><span className="badge">Project revision {destination.collection.project!.revision}</span><span className="badge">Preferred take preserved</span><span className="badge">{(op.pendingInputs??source.pendingInputs)?.length??0} pending inputs</span></div><p><strong>{source.title}</strong> · {destination.collection.name} / {destination.shot.title}</p><details><summary>Original Direct Prompt (preserved)</summary><pre role="region" tabIndex={0} aria-label="Original Direct Prompt text">{source.outputs.full}</pre></details><p className="muted-text">Mapping edits stay in this tab until you explicitly review and apply a batch. Download a package to keep unfinished work. New wording and formatting can differ from the original.</p></section>
   {pkg.operations.filter(o=>o.type==='scene.convert_direct_to_recipe').length>1&&<label>Conversion shot to edit<select className="select" value={operationId} onChange={e=>{const next=pkg.operations.find((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe'&&o.operationId===e.target.value);if(!next||!('id'in next.project)||!('id'in next.shot))return;const key=JSON.stringify([next.project.id,next.shot.id]);selectionKey.current=next.sceneId+'|'+key;setOperationId(next.operationId);setSourceId(next.sceneId);setTargetKey(key)}}>{pkg.operations.filter((o):o is ConversionOperation=>o.type==='scene.convert_direct_to_recipe').map(o=><option key={o.operationId} value={o.operationId}>{o.title}</option>)}</select></label>}
   <label>New recipe title<input className="input" value={op.title} maxLength={100} onChange={e=>update({...op,title:e.target.value})}/></label>
   <RecipeMappingEditor input={pkg} operation={op} source={source} state={snapshot} resolved={resolved} onChange={update} onUnsubmittedChange={setHasUnsubmitted}/>
   <section className="card"><h3>Readiness</h3><p role="status">{busy?'Computing a read-only recipe preview…':!resolved?'Select valid inputs to compute a recipe preview.':blockers.length?`${blockers.length} mapping/input issue(s) to resolve before saving.`:resolved?.pendingInputs?.length?'Recipe inputs selected; production references remain pending.':'Review the assembled recipe before saving.'}</p>{blockers.length>0&&<details><summary>Show required corrections</summary><ul>{blockers.map((f,i)=><li key={i}>{f.message}</li>)}</ul></details>}<p>Required originals must be selected in Source Media. Optional reference frames may remain pending.</p></section>
   <footer className="card recipe-workspace-actions"><button className="btn btn-secondary" onClick={download}>Download mapping package</button><button className="btn btn-secondary" onClick={()=>{void copyRequest()}}>Prepare Codex mapping request</button><button className="btn btn-primary" onClick={()=>setReviewing(true)}>Review and save alternate take</button></footer>
  </>}
  {status&&<p role="status" aria-live="polite">{status}</p>}
 </section></>;
}
