import {expect,it} from 'vitest';
import {makeKeyframeFixture} from './fixtures/keyframeFixture';
import {collectReferencedMediaIds} from '../storage/db';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {uploadFrameImage} from '../storage/frameImages';
import {removeProjectTake,removeProjectShot} from '../storage/projects';
import {deleteSavedScene,getAllSnapshot} from '../storage/db';
import rasters from './fixtures/frame-raster-fixtures.json';
it('retains draft attachments, captured frame references and cleared history even without active pointers',()=>{
 const f=makeKeyframeFixture(),collection=structuredClone(f.state.collections[0]),draft=structuredClone(f.draft),hash='a'.repeat(64),basis={promptDigest:hash,visualDigest:hash,bindingDigest:hash,referenceDigest:hash};
 collection.project!.frameProduction={version:1,revision:2,active:[],videoReviews:[],imageEvents:[{id:'historical-image',revision:1,kind:'linked',shotId:f.shotId,sceneId:'deleted-take',frameId:'start',mediaId:'history-only',sha256:hash,...basis,provenance:{kind:'existing_media'},reviewStatus:'needs_review',createdAt:draft.updatedAt},{id:'clear-image',revision:2,kind:'cleared',shotId:f.shotId,sceneId:'deleted-take',frameId:'start',...basis,provenance:{kind:'existing_media'},reviewStatus:'needs_review',createdAt:draft.updatedAt}]};
 draft.frameImageAssignments={middle:{mediaId:'draft-only',sha256:hash,...basis,provenance:{kind:'external_upload'},updatedAt:draft.updatedAt}};
 draft.imagePromptSnapshots={middle:{schema:'krakinai.image-prompt.v1',assemblerVersion:1,full:'Captured text',visualDigest:hash,sourceDigest:hash,referenceProvenance:[{association:{...draft.referencePack!.entries[0],mediaId:'captured-frame-reference-only'},sha256:hash}]}};
 for(const includeOptionalMetadata of [true,false]){const refs=collectReferencedMediaIds({assets:[],variants:[],templates:[],scenes:[],drafts:[draft],collections:[collection]},{includeOptionalMetadata});for(const id of ['history-only','draft-only','captured-frame-reference-only'])expect(refs.has(id)).toBe(true);}
});
it.each(['take','shot','scene'])('retires an active pointer when its %s is explicitly removed while preserving all history and bytes',async kind=>{
 const f=await seedKeyframeStorage(),row=rasters.files[0],file=new File([Uint8Array.from(atob(row.base64),c=>c.charCodeAt(0))],row.filename,{type:row.mime});
 const collection=await uploadFrameImage({target:{collectionId:f.projectId,expectedProjectRevision:f.state.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0},file}),before=await getAllSnapshot();
 if(kind==='take')await removeProjectTake({collectionId:f.projectId,shotId:f.shotId,sceneId:f.parent.id});if(kind==='shot')await removeProjectShot({collectionId:f.projectId,shotId:f.shotId});if(kind==='scene')await deleteSavedScene(f.parent.id);
 const after=await getAllSnapshot(),production=after.collections.find(c=>c.id===f.projectId)!.project!.frameProduction!;expect(production.active).toEqual([]);expect(production.imageEvents).toEqual(collection.project!.frameProduction!.imageEvents);expect(after.media).toEqual(before.media);
});
