import {expect,it} from 'vitest';
import {parseChangeSet} from '../domain/changeSetValidation';
import {keyframeChangeScenario} from './fixtures/keyframeChangeSetFixture';
it('accepts a strict v6 frame patch without altering old contracts',async()=>{const f=await keyframeChangeScenario();expect(parseChangeSet(f.input)).toEqual(f.input);});
it.each(['approval','rawPrompt','unknown','duplicate','digest','oversize'])('rejects unsafe v6 %s',async kind=>{
 const f=await keyframeChangeScenario(),op=f.op as any;
 if(kind==='approval')op.reviewed=true;if(kind==='rawPrompt')op.imagePromptSnapshots={middle:{full:'Invented approval'}};
 if(kind==='unknown')op.keyframes.frameUpserts[0].unknown=true;
 if(kind==='duplicate')op.keyframes.frameUpserts.push(structuredClone(op.keyframes.frameUpserts[0]));
 if(kind==='digest')delete op.expectedKeyframeDigest;
 if(kind==='oversize')f.input.description='x'.repeat(1024*1024);
 expect(()=>parseChangeSet(f.input)).toThrow();
});
it('accepts typed existing-media targets and refuses human image-review flags',async()=>{
 const f=await keyframeChangeScenario(),target={project:f.op.project,shot:f.op.shot,scene:{id:f.parent.id},frameId:'middle',expectedSceneRevision:f.parent.revision,expectedFrameDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0};
 const input={...f.input,operations:[{operationId:'link',type:'frame_image.link',...target,mediaId:f.state.media[0].id}]};
 expect(parseChangeSet(input)).toEqual(input);expect(()=>parseChangeSet({...input,operations:[{...input.operations[0],reviewStatus:'approved'}]})).toThrow();
});
