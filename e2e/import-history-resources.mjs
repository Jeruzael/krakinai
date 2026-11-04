import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const exec=promisify(execFile);
/** Observes only processes belonging to the test's own Chromium instance. */
export async function observeImportMemory(browser,work,options={}){
 const cdp=await browser.newBrowserCDPSession(),info=await cdp.send('SystemInfo.getProcessInfo'),ids=info.processInfo.map(p=>p.id).filter(Number.isSafeInteger),version=await cdp.send('Browser.getVersion');
 let peak=0,samples=0,pending,busy=false;const started=performance.now();
 const sample=async()=>{let bytes=0;
  if(options.readMemory)bytes=await options.readMemory(ids);
  else if(process.platform==='win32'){
   const command=`$krakinaiMeasured = Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue; ($krakinaiMeasured | Measure-Object -Property WorkingSet64 -Sum).Sum`;
   const result=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000});bytes=Number(result.stdout.trim());
  }else if(process.platform==='linux'){
   for(const id of ids){try{const status=await readFile('/proc/'+id+'/status','utf8'),match=status.match(/^VmRSS:\s+(\d+) kB/m);bytes+=Number(match?.[1]??0)*1024;}catch{/* A short-lived owned process can exit. */}}
  }
  if(!Number.isFinite(bytes)||bytes<=0)throw Error('Owned Chromium memory observation is unavailable.');peak=Math.max(peak,bytes);samples++;
 };
 let error;await sample();const interval=setInterval(()=>{if(busy)return;busy=true;pending=sample().catch(e=>{error=e;}).finally(()=>{busy=false;});},options.intervalMs??500);
 try{const value=await work();clearInterval(interval);await pending;if(error)throw error;await sample();return{value,observation:{kind:'Observed aggregate working set/RSS; not an allocation proof or total-system peak',peakObservedBytes:peak,sampleCount:samples,samplingIntervalMs:options.intervalMs??500,processCount:ids.length,durationMs:Math.round(performance.now()-started),browser:version.product,platform:process.platform}};}finally{clearInterval(interval);await pending;await cdp.detach();}
}
