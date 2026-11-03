import {it,expect} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {buildProjectExport,planProjectExport,PROJECT_EXPORT_MEDIA_LIMIT,PROJECT_EXPORT_TEXT_LIMIT,PROJECT_EXPORT_ENTRY_LIMIT} from '../domain/projectExport';
import {applyFrameImageCommand} from '../storage/frameImages';
import {getAllSnapshot} from '../storage/db';
it('exports C selected takes as v3 with complete per-frame modes, frozen metadata and original references',async()=>{
 const f=await seedKeyframeStorage(),result=await buildProjectExport(f.state.collections[0],f.state,{includeGenerationJson:true}),manifest:any=result.manifest,files=unzipSync(result.bytes),row=manifest.shots.find((s:any)=>s.selectedSceneId===f.parent.id);
 expect(manifest.schema).toBe('krakinai.project-export.v3');expect(row.selectedTake.keyframePlan).toEqual(f.parent.keyframePlan);expect(row.selectedTake.imagePromptSnapshots).toEqual(f.parent.imagePromptSnapshots);
 for(const frame of f.plan.frames){expect(strFromU8(files[row.imageFrameFiles[frame.id].full])).toBe(f.parent.imagePromptSnapshots![frame.id].full);expect(JSON.parse(strFromU8(files[row.imageFrameFiles[frame.id].document])).schema).toBe('krakinai.image-prompt.v1');}
 expect(strFromU8(files[row.files.prompt])).toBe(f.parent.outputs.full);expect(manifest.associations.length).toBeGreaterThanOrEqual(f.parent.referencePack!.entries.length);expect([PROJECT_EXPORT_MEDIA_LIMIT,PROJECT_EXPORT_TEXT_LIMIT,PROJECT_EXPORT_ENTRY_LIMIT]).toEqual([128*1024**2,16*1024**2,2000]);
});
it('preserves cleared history and all original files, and rejects a changed captured image',async()=>{
 const f=await seedKeyframeStorage(),target={collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0};
 const linked=await applyFrameImageCommand({kind:'link',target,mediaId:f.state.media[0].id});await applyFrameImageCommand({kind:'clear',target:{...target,expectedProjectRevision:linked.project!.revision,expectedAssociationRevision:1}});
 const state=await getAllSnapshot(),project=state.collections[0];project.project!.shots[1].selectedSceneId=undefined;const result=await buildProjectExport(project,state),manifest:any=result.manifest;expect(manifest.schema).toBe('krakinai.project-export.v3');expect(manifest.frameProduction).toEqual(project.project!.frameProduction);expect(manifest.associations.some((a:any)=>a.frameEventId&&a.sha256&&a.archivePath&&!a.excluded)).toBe(true);
 const file=state.media[0];file.blob=new Blob([new Uint8Array(file.byteSize).fill(42)],{type:file.mimeType});await expect(buildProjectExport(project,state)).rejects.toThrow(/captured SHA-256/);
 state.media=[];expect(planProjectExport(project,state).associations.some(a=>a.frameEventId&&a.missing&&!a.excluded)).toBe(true);await expect(buildProjectExport(project,state)).rejects.toThrow(/Missing selected original media/);
});
it('exports exact manual still buffers without reassembly or a canonical claim',async()=>{
 const f=await seedKeyframeStorage(),text='  文字 manual still\r\n\tbuffer  ';f.parent.manualImageOutputs={start:{full:{text,basedOnVisualDigest:f.parent.imagePromptSnapshots!.start.visualDigest,updatedAt:f.parent.updatedAt}}};const result=await buildProjectExport(f.state.collections[0],f.state),row:any=result.manifest.shots.find(s=>s.selectedSceneId===f.parent.id),files=unzipSync(result.bytes);expect(strFromU8(files[row.imageFrameFiles.start.full])).toBe(text);expect(JSON.parse(strFromU8(files[row.imageFrameFiles.start.document]))).toMatchObject({correspondence:'unverified',effectiveOutputs:{full:text}});
});
