import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const target=resolve('src/__tests__/fixtures/keyframe-legacy-baseline.json');
if(process.argv.slice(2).join(' ')!=='--write'||existsSync(target))throw Error('Use --write once; never overwrite a frozen baseline.');
const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
if(head.status!==0||head.stdout.trim()!=='e3012123647d9989a923936090102fadd58378a5')throw Error('Capture requires the approved integrated B base.');
const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','src/__tests__/keyframeLegacy.test.ts'],{windowsHide:true,stdio:'inherit',env:{...process.env,KRAKINAI_CAPTURE_KEYFRAME_BASELINE:'synthetic-before-implementation'}});
process.exitCode=result.status??1;
