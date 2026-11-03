// Opt-in, synthetic-only artifact writer. Application builds never import this module.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
export async function writeFlowFixture(bytes,{manifest,texts,originalHashes}){
 if(!process.env.KRAKINAI_C_QA_ARTIFACTS)return;
 const dir=resolve(process.env.KRAKINAI_C_QA_ARTIFACTS),allowed=resolve('.superpowers/sdd/2026-11-03-multi-frame-image-prompt-studio-c/task13-archives');
 if(dir!==allowed)throw Error('Synthetic QA output must use this plan-specific directory.');
 await mkdir(dir,{recursive:true});await writeFile(join(dir,'flow.zip'),bytes);
 await writeFile(join(dir,'expectations.json'),JSON.stringify({syntheticOnly:true,archives:{'flow.zip':{sha256:createHash('sha256').update(bytes).digest('hex'),manifest,texts,originalHashes}}},null,2));
}
