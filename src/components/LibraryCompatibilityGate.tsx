import {useEffect,useRef,useState,type ReactNode} from 'react';
import {enableBlockingLibrary,inspectLibraryCompatibility} from '../storage/libraryCompatibility';
import {downloadBlobAsFile} from '../hooks/useObjectUrl';

/** Deliberately outside LibraryProvider: inspection cannot initialize or rewrite records. */
export function LibraryCompatibilityGate({children}:{children:ReactNode}){
 const [state,setState]=useState<'checking'|'legacy'|'enabling'|'blocked'|'ready'|'error'>('checking');
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 const [backingUp,setBackingUp]=useState(false);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>{let current=true;
  void inspectLibraryCompatibility().then(result=>{if(!current)return;
   if(result==='unsupported'){setError('This library requires a newer or compatible KRAKINAI build. It cannot be downgraded here.');setState('error');}
   else setState(result==='legacy-v1'?'legacy':'ready');
  },cause=>{if(current){setError(cause instanceof Error?cause.message:String(cause));setState('error');}});
  return()=>{current=false;pending.current?.abort();};
 },[]);
 const enable=async()=>{
  if(pending.current)return;
  const controller=new AbortController();pending.current=controller;setState('enabling');setError('');setMessage('Updating the library header. Existing records stay in place.');
  try{await enableBlockingLibrary({signal:controller.signal,onBlocked:()=>{setState('blocked');setMessage('Save your work and close older KRAKINAI tabs or windows using this library. This update will continue when they close. You can cancel while waiting.');}});setState('ready');}
  catch(cause){setState('legacy');if(cause instanceof DOMException&&cause.name==='AbortError')setMessage('The library was not changed. You can keep using the previous build or enable later.');else{setMessage('');setError(cause instanceof Error?cause.message:String(cause));}}
  finally{pending.current=null;}
 };
 const cancel=()=>{if(pending.current)pending.current.abort();else setMessage('The library was not changed. You can keep using the previous build or enable later.');};
 const backup=async()=>{if(backingUp||state!=='legacy')return;setBackingUp(true);setError('');setMessage('Reading and checking a pre-upgrade backup. No library records are changed.');
  try{const {exportLegacyBackupBeforeUpgrade}=await import('../storage/backup');const bytes=await exportLegacyBackupBeforeUpgrade();downloadBlobAsFile(new Blob([bytes as BlobPart],{type:'application/zip'}),`krakinai-pre-blocking-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`);setMessage('Backup records and media hashes checked. Download requested; make sure the file was saved before enabling.');}
  catch(cause){setMessage('');setError(cause instanceof Error?cause.message:String(cause));}finally{setBackingUp(false);}
 };
 if(state==='ready')return <>{children}</>;
 return <main className="container" style={{maxWidth:760,margin:'40px auto',padding:20}}>
  {state==='checking'?<p role="status">Checking this browser’s local library…</p>:<section className="card">
   <h1>Enable the blocking-compatible library?</h1>
   <p>Existing data stays. Older KRAKINAI builds will no longer open this library after you enable it. Keep using your current build until you are ready.</p>
   <p>This applies only to this browser profile and application address. For returning to an older build, keep a pre-upgrade full backup and restore it in a separate profile or address.</p>
   <p>Before enabling, save a pre-upgrade full backup below or use the previous build’s Settings &amp; Local Data Backup. This uses the existing in-memory backup tools; large-library restore remains limited to independently verified capacity. This update does not extend it.</p>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   {state!=='error'&&<div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <button type="button" className="btn btn-secondary" disabled={state!=='legacy'||backingUp} onClick={()=>void backup()}>{backingUp?'Checking backup…':'Download pre-upgrade full backup'}</button>
    <button type="button" className="btn btn-primary" disabled={state!=='legacy'||backingUp} onClick={()=>void enable()}>Enable blocking-compatible library</button>
    <button type="button" className="btn btn-secondary" disabled={backingUp} onClick={cancel}>Cancel</button>
   </div>}
  </section>}
 </main>;
}
