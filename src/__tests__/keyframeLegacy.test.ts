import {logicalImportReceipt} from '../domain/changeSetLedger';
import {it,expect,vi,afterAll} from 'vitest';
import {makeBlockingFixture} from './fixtures/blockingFixture';
import {blockingChangeScenario} from './fixtures/blockingChangeSetFixture';
import {assembleScenePrompt} from '../domain/promptAssembler';
import {serializeSceneJson} from '../domain/sceneDocument';
import {serializeGenerationJson} from '../domain/generationDocument';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {replaceAllStoresTransactionally,getAllSnapshot} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {emptyChangeSetApproval} from '../types/changeSet';
import * as schemas from '../domain/changeSetSchema';
import type {SceneDraft} from '../types/domain';

const cryptoModule='node:crypto',fsModule='node:fs',pathModule='node:path',processModule='node:process';
const {webcrypto,createHash}=await import(/* @vite-ignore */ cryptoModule);
const {readFileSync,writeFileSync,existsSync}=await import(/* @vite-ignore */ fsModule);
const {resolve}=await import(/* @vite-ignore */ pathModule);
const {env}=await import(/* @vite-ignore */ processModule);
const sha=(value:unknown)=>createHash('sha256').update(canonicalStringify(value)).digest('hex');
const path=resolve('src/__tests__/fixtures/keyframe-legacy-baseline.json');
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

// Captured from the integrated B base before any C product change. Not an assembler-derived expectation.
it('keeps pre-C frozen video/document bytes, v1-v5 schemas and actual v5 receipt/replay unchanged',async()=>{
 vi.stubGlobal('crypto',webcrypto);let sequence=0;
 vi.spyOn(webcrypto,'randomUUID').mockImplementation(()=>`${(++sequence).toString(16).padStart(8,'0')}-0000-4000-8000-000000000000`);
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-03T00:00:00.000Z'));
 const f=makeBlockingFixture(),plain={...f.draft,blocking:undefined};
 const document=(draft:SceneDraft)=>({outputs:assembleScenePrompt(draft).outputs,sceneJson:serializeSceneJson(draft),generationJson:serializeGenerationJson(draft)});
 const schemaHashes=Object.fromEntries(['CHANGE_SET_SCHEMA','CHANGE_SET_V2_SCHEMA','CHANGE_SET_V3_SCHEMA','CHANGE_SET_V4_SCHEMA','CHANGE_SET_V5_SCHEMA'].map(key=>[key,sha(schemas[key as keyof typeof schemas])]));
 const scenario=await blockingChangeScenario();
 await replaceAllStoresTransactionally(scenario.state);
 const preview=await previewChangeSet(scenario.input,{...emptyChangeSetApproval(),storyboard:true,scenes:true,blocking:true});
 expect(preview.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
 const receipt=await applyApprovedChangeSet(preview,preview.approvedDigest),after=await getAllSnapshot();
 expect(await applyApprovedChangeSet(preview,preview.approvedDigest)).toEqual(receipt);
 expect(await getAllSnapshot()).toEqual(after);
 const captured={syntheticOnly:true,sourceCommit:'e3012123647d9989a923936090102fadd58378a5',legacyBaselineSha256:sha(JSON.parse(readFileSync(resolve('src/__tests__/fixtures/blocking-legacy-baseline.json'),'utf8'))),documents:{plain:document(plain),blocking:document(f.draft)},schemaHashes,v5:{packageDigest:preview.packageDigest,approvedDigest:preview.approvedDigest,receipt:logicalImportReceipt(receipt),receiptSha256:sha(logicalImportReceipt(receipt)),savedOutputs:after.scenes.map(s=>({id:s.id,outputs:s.outputs}))}};
 if(env.KRAKINAI_CAPTURE_KEYFRAME_BASELINE==='synthetic-before-implementation'){
  if(existsSync(path))throw Error('Refusing to overwrite the frozen C compatibility baseline.');
  writeFileSync(path,JSON.stringify(captured,null,2)+'\n');
 }
 expect(captured).toEqual(JSON.parse(readFileSync(path,'utf8')));
},30000);
