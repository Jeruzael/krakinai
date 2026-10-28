import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seedShotTypes } from '../../e2e/shot-types-fixture.mjs';

// Explicit immutable source snapshot, isolated browser, separate port. Never uses :5173.
const root=resolve(process.argv[2]??'qa-results/shot-types-master');
const revision=(await readFile(resolve(root,'baseline-revision.txt'),'utf8')).trim();
if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('Expected pinned baseline revision.');
const hash=data=>createHash('sha256').update(data).digest('hex');
const sourceHashes={};
for(const file of ['src/screens/SceneBuilderScreen.tsx','src/domain/promptAssembler.ts','src/types/domain.ts']) {
  const expected=execFileSync('git',['show',`${revision}:${file}`]);
  const actual=await readFile(resolve(root,file));
  if(hash(actual)!==hash(expected))throw new Error(`Baseline source mismatch: ${file}`);
  sourceHashes[file]=hash(actual);
}
await mkdir('qa-results/shot-types/before',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const screenshots=[];
try {
  for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4174',viewport:{width,height}});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:4174/#/');
    const ids=await seedShotTypes(page);
    await page.evaluate(()=>document.fonts.ready);
    if(await page.getByLabel('Shot Type',{exact:true}).count())throw new Error('Baseline unexpectedly contains Shot Type UI.');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw new Error(`Baseline has horizontal overflow at ${width}.`);
    const path=`qa-results/shot-types/before/builder-${width}.png`;
    await page.screenshot({path,fullPage:true});
    screenshots.push({path,width,height,sha256:hash(await readFile(path)),sourceSha256:ids.sourceSha256??ids.originalSha256});
    await context.close();
  }
}finally{await browser.close();}
const result={baselineCommit:revision,sourceHashes,screenshots,syntheticContextsOnly:true};
await writeFile('qa-results/shot-types/before/results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
