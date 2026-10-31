// Export the exact pre-feature Git tree to a NEW ignored directory. Never
// switch/reset an existing checkout or open a user's browser/profile.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { seedChangeSet } from '../../e2e/change-set-fixture.mjs';
const execute=promisify(execFile), base='6530c0eda04809c603930a4b106b7f774bc1dd8d';
const directory=resolve('qa-results/local-mcp/baseline',randomUUID()),source=resolve(directory,'source'),profile=resolve(directory,'profile');
await mkdir(source,{recursive:true});await mkdir(profile,{recursive:true});
const archive=resolve(directory,'baseline.tar');
await execute('git',['archive','--format=tar',`--output=${archive}`,base]);
await execute('tar',['-xf',archive,'-C',source]);
await symlink(resolve('node_modules'),resolve(source,'node_modules'),process.platform==='win32'?'junction':'dir');
const port=4183,origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:source,windowsHide:true,stdio:['ignore','pipe','pipe']});
server.stdout.resume();server.stderr.resume();
let context;
try {
  let ready=false;
  for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error('Baseline-only server exited');try{const response=await fetch(origin,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('Baseline-only server was not ready');
  context=await chromium.launchPersistentContext(profile,{headless:true,baseURL:origin,viewport:{width:1440,height:900},executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
  await seedChangeSet(page);await page.goto('/#/imports/ai');
  if(await page.getByText('AI Connections',{exact:true}).count())throw Error('Baseline unexpectedly includes Stage C');
  const images=resolve('qa-results/local-mcp/screenshots');await mkdir(images,{recursive:true});const files=[];
  for(const[width,height]of[[1440,900],[1366,768],[768,1024],[390,844],[720,450]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    if(width<768)await page.locator('.app-sidebar').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
    const path=resolve(images,`before-manual-import-${width}x${height}.png`);await page.screenshot({path,fullPage:true,animations:'disabled'});files.push(path);
  }
  await writeFile(resolve(directory,'result.json'),JSON.stringify({baseCommit:base,origin,syntheticProfile:profile,files,retained:true},null,2));
  console.log(JSON.stringify({baseCommit:base,screenshots:files.length,retainedDirectory:directory},null,2));
}finally{await context?.close();if(server.exitCode===null)server.kill();}
