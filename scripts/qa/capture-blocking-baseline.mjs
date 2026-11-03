import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
// Trusted, synthetic fixtures only. Capture once before changing production code.
const target=resolve('src/__tests__/fixtures/blocking-legacy-baseline.json');
if(process.argv.slice(2).join(' ')!=='--write'||existsSync(target))throw Error('Use --write once; the frozen baseline must not be overwritten.');
const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','src/__tests__/blockingLegacy.test.ts'],{
 cwd:process.cwd(),windowsHide:true,stdio:'inherit',env:{...process.env,KRAKINAI_CAPTURE_BLOCKING_BASELINE:'synthetic-before-implementation'},
});
process.exitCode=result.status??1;
