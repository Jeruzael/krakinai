import {it,expect} from 'vitest';
import {assertKeyframeSavedState} from '../../scripts/qa/keyframe-mcp-workflow.mjs';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot} from '../storage/db';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
it('native evidence validator accepts the real Stage B v6 transaction and only its exact ledger/member deltas',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),preview=await previewChangeSet(f.input,f.approval),receipt=await applyApprovedChangeSet(preview,preview.approvedDigest),after=await getAllSnapshot();
 expect(()=>assertKeyframeSavedState({before,after,target:{projectId:f.projectId,sceneId:f.parent.id,shotId:f.shotId},changeSet:f.input,newSceneId:receipt.idMappings['new-take'].id})).not.toThrow();
});
