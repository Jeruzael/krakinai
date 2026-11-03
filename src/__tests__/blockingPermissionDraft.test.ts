import {it,expect} from 'vitest';
import {makeBlockingFixture} from './fixtures/blockingFixture';
import {emptyMcpScope,emptyMcpScopeV2} from '../domain/mcpScope';
import {changeSelection,normalizePermissionDraft,permissionFingerprint,selectAllRecords,presetPermissionDraft,scopeDiff,buildPermissionInventory,validatePermissionDraft} from '../domain/mcpPermissionDraft';
it('keeps bulk selection and full presets from granting Blocking access',()=>{
 const f=makeBlockingFixture(),v1=selectAllRecords(emptyMcpScope(),f.state);expect(v1).not.toHaveProperty('blockingSceneIds');
 const v2={...emptyMcpScopeV2(),projectIds:[f.projectId]};for(const result of [selectAllRecords(v2,f.state),presetPermissionDraft('full',v2,f.state)]){expect(result.version).toBe(2);expect(result).toMatchObject({blockingSceneIds:[],allowBlockingProposals:false});}
});
it('requires an explicit v2 selection and removes dependent unavailable Blocking IDs',()=>{
 const f=makeBlockingFixture(),v1={...emptyMcpScope(),projectIds:[f.projectId]};expect(()=>changeSelection(v1,'blockingSceneIds',[f.parentSceneId],true)).toThrow(/fresh|Blocking|format/i);
 const v2={...emptyMcpScopeV2(),projectIds:[f.projectId]},selected=changeSelection(v2,'blockingSceneIds',[f.parentSceneId],true);expect(selected).toMatchObject({blockingSceneIds:[f.parentSceneId]});expect(validatePermissionDraft(selected,f.state)).toEqual(selected);
 expect(normalizePermissionDraft({...selected,projectIds:[]},f.state)).toMatchObject({blockingSceneIds:[]});
});
it('binds both new grants and format in dirty/review state without changing legacy fingerprints',()=>{
 const f=makeBlockingFixture(),old=emptyMcpScope(),next={...emptyMcpScopeV2(),projectIds:[f.projectId],blockingSceneIds:[f.parentSceneId],allowBlockingProposals:true};
 expect(permissionFingerprint(old)).not.toBe(permissionFingerprint(emptyMcpScopeV2()));const diff=scopeDiff(old,next,buildPermissionInventory(f.state,next));expect(diff).toContainEqual(expect.objectContaining({field:'blockingSceneIds',kind:'sensitive',after:1}));expect(diff).toContainEqual(expect.objectContaining({field:'allowBlockingProposals',kind:'capability',after:true}));
});
