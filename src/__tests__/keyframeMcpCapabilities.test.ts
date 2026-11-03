import {it,expect} from 'vitest';
import * as scopes from '../domain/mcpScope';
import * as capabilities from '../domain/mcpCapabilities';
import {ProposalBroker} from '../connections/proposalBroker';
import {selectAllRecords,presetPermissionDraft} from '../domain/mcpPermissionDraft';
import {changeSelection,normalizePermissionDraft,permissionFingerprint,permissionScopeFormat} from '../domain/mcpPermissionDraft';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
const factory=()=> (scopes as any).emptyMcpScopeV3();
it('starts scope3 with no C grants or capabilities and validates exact pair bounds',()=>{
 const s=factory();expect(s).toMatchObject({version:3,keyframeSceneIds:[],imagePromptFrameGrants:[],allowKeyframeProposals:false,allowFrameImageProposals:false,allowImagePromptDerivation:false});
 s.keyframeSceneIds=Array.from({length:250},(_,i)=>'scene'+i);s.imagePromptFrameGrants=s.keyframeSceneIds.map((sceneId:string)=>({sceneId,frameId:'middle'}));expect(()=>scopes.validateMcpScope(s)).not.toThrow();
 expect(()=>scopes.validateMcpScope({...s,imagePromptFrameGrants:[...s.imagePromptFrameGrants,s.imagePromptFrameGrants[0]]})).toThrow();
 expect(()=>scopes.validateMcpScope({...s,keyframeSceneIds:[...s.keyframeSceneIds,'overflow']})).toThrow();
 expect(()=>scopes.validateMcpScope({...s,imagePromptFrameGrants:[{sceneId:'scene0',frameId:'middle',approved:true}]})).toThrow();
});
it('removes dependent exact-frame grants when metadata or frame-plan access is removed',async()=>{
 const f=await keyframeChangeScenario();let s={...factory(),projectIds:[f.projectId]};s=changeSelection(s,'keyframeSceneIds',[f.parent.id],true);s=changeSelection(s,'imagePromptFrameGrants',[JSON.stringify([f.parent.id,'middle'])],true);
 expect(permissionFingerprint(s)).not.toBe(permissionFingerprint(factory()));
 expect(normalizePermissionDraft({...s,projectIds:[]},f.state)).toMatchObject({keyframeSceneIds:[],imagePromptFrameGrants:[]});
 expect(permissionScopeFormat(s,2)).not.toHaveProperty('keyframeSceneIds');expect(permissionScopeFormat(s,1)).not.toHaveProperty('blockingSceneIds');expect(permissionScopeFormat(s,3)).toMatchObject({keyframeSceneIds:[],imagePromptFrameGrants:[]});
});
it('requires proof-bound C capabilities and a fresh pairing for scope format changes',()=>{
 const b=new ProposalBroker(),s=factory();expect(()=>b.connect('old',s,Date.now()+60000,capabilities.MCP_BLOCKING_CAPABILITIES)).toThrow();
 b.connect('c',s,Date.now()+60000,(capabilities as any).MCP_KEYFRAME_CAPABILITIES);expect(b.getState().scope.version).toBe(3);
 expect(()=>b.setScope(scopes.emptyMcpScopeV2())).toThrow(/Disconnect/);b.disconnect();
});
it('does not promote C grants through full presets or select-all',async()=>{
 const f=await keyframeChangeScenario(),s={...factory(),projectIds:[f.projectId]};
 for(const result of [selectAllRecords(s,f.state),presetPermissionDraft('full',s,f.state)])expect(result).toMatchObject({version:3,keyframeSceneIds:[],imagePromptFrameGrants:[],allowKeyframeProposals:false,allowFrameImageProposals:false,allowImagePromptDerivation:false});
});
