import {it,expect,vi,afterAll} from 'vitest';
import {ensembleLegacyDraft,ensembleDraft} from './fixtures/ensembleFixture';
import {ensembleState} from './fixtures/ensemblePlanningFixture';
import {ensembleChangeSet} from './fixtures/ensembleChangeSetFixture';
import {recipeChangeSet,recipeState,recipeApproval} from './fixtures/recipeChangeSetFixture';
import {midoriChangeSet,allContentApproval,emptyState} from './fixtures/changeSetFixture';
import {conversionScenario,conversionSourceText} from './fixtures/recipeConversionFixture';
import {assembleScenePrompt} from '../domain/promptAssembler';
import {serializeSceneJson} from '../domain/sceneDocument';
import {serializeGenerationJson} from '../domain/generationDocument';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {replaceAllStoresTransactionally,getAllSnapshot} from '../storage/db';
import * as schemas from '../domain/changeSetSchema';
import type {LibrarySnapshot} from '../storage/db';
import type {ChangeSetState} from '../types/changeSet';

// Match the existing testSetup runtime-import pattern; the browser project has no Node type dependency.
const cryptoModule='node:crypto',fsModule='node:fs',pathModule='node:path',processModule='node:process';
const {webcrypto,createHash}=await import(/* @vite-ignore */ cryptoModule);
const {readFileSync,writeFileSync,existsSync}=await import(/* @vite-ignore */ fsModule);
const {resolve}=await import(/* @vite-ignore */ pathModule);
const {env}=await import(/* @vite-ignore */ processModule);

const sha=(value:unknown)=>createHash('sha256').update(canonicalStringify(value)).digest('hex');
const path=resolve('src/__tests__/fixtures/blocking-legacy-baseline.json');
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

// Catches any accidental old-format output, schema, approval/durable-receipt or replay change.
it('preserves pre-blocking canonical bytes and actual v1-v4 atomic receipt/replay identities',async()=>{
 vi.stubGlobal('crypto',webcrypto);let sequence=0;
 vi.spyOn(webcrypto,'randomUUID').mockImplementation(()=>`${(++sequence).toString(16).padStart(8,'0')}-0000-4000-8000-000000000000`);
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-03T00:00:00.000Z'));
 const single=ensembleLegacyDraft(),ensemble=ensembleDraft();
 const document=(draft:typeof single)=>({outputs:assembleScenePrompt(draft).outputs,sceneJson:serializeSceneJson(draft),generationJson:serializeGenerationJson(draft)});
 const captured:{syntheticOnly:true;documents:unknown;schemaHashes:Record<string,string>;imports:Record<string,unknown>}={syntheticOnly:true,documents:{single:document(single),ensemble:document(ensemble),direct:conversionSourceText},schemaHashes:{},imports:{}};
 for(const key of ['CHANGE_SET_SCHEMA','CHANGE_SET_V2_SCHEMA','CHANGE_SET_V3_SCHEMA','CHANGE_SET_V4_SCHEMA'] as const)captured.schemaHashes[key]=sha(schemas[key]);
 const v1=midoriChangeSet();v1.operations=v1.operations.slice(0,3);
 const conversion=await conversionScenario();
 const cases=[{name:'v1',input:v1,state:emptyState(),approval:allContentApproval()},{name:'v2',input:recipeChangeSet(),state:recipeState(),approval:recipeApproval()},{name:'v3',input:ensembleChangeSet(),state:ensembleState(),approval:recipeApproval()},{name:'v4',...conversion}];
 for(const item of cases){
  const state:ChangeSetState=item.state;
  await replaceAllStoresTransactionally({...state,drafts:[],variants:state.variants??[],schemaVersion:1} as LibrarySnapshot);
  const preview=await previewChangeSet(item.input,item.approval);
  expect(preview.plan.findings.filter(f=>f.severity==='blocking')).toEqual([]);
  const receipt=await applyApprovedChangeSet(preview,preview.approvedDigest),before=await getAllSnapshot();
  captured.imports[item.name]={packageDigest:preview.packageDigest,approvedDigest:preview.approvedDigest,receipt,receiptSha256:sha(receipt),outputs:before.scenes.map(s=>({id:s.id,outputs:s.outputs}))};
  const replay=await previewChangeSet(item.input,item.approval);
  expect(await applyApprovedChangeSet(replay,replay.approvedDigest)).toEqual(receipt);
  expect(await getAllSnapshot()).toEqual(before);
 }
 if(env.KRAKINAI_CAPTURE_BLOCKING_BASELINE==='synthetic-before-implementation'){
  if(existsSync(path))throw Error('Refusing to overwrite a frozen compatibility baseline.');
  writeFileSync(path,JSON.stringify(captured,null,2)+'\n');
 }
 expect(captured).toEqual(JSON.parse(readFileSync(path,'utf8')));
},30000);
