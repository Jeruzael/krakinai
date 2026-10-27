import { beforeEach, expect, it, vi } from 'vitest';
import type { Collection } from '../types/domain';
import { getProjectSaveTarget, carryProjectTarget, startProjectShotDraft } from '../domain/projectRoutes';
import * as db from '../storage/db';
import * as projects from '../storage/projects';
vi.mock('../storage/db',()=>({getAllSnapshot:vi.fn(),createDraftFromSavedScene:vi.fn(),saveSceneDraft:vi.fn()}));
vi.mock('../storage/projects',()=>({initializeProject:vi.fn()}));
const collection={id:'project / café',members:[{type:'scene',id:'scene_one'}],project:{version:1,revision:1,shots:[{id:'shot / 03A',order:0,code:'03A',title:'Marco enters',takeSceneIds:['scene_one'],selectedSceneId:'scene_one',status:'prompt_ready'},{id:'planned',order:1,code:'04',title:'Planned confrontation',takeSceneIds:[],status:'planned'}]}} as unknown as Collection;
beforeEach(()=>vi.clearAllMocks());
it('validates explicit target IDs and preserves encoded context without treating ordinary collection visits as a save target',()=>{
 const path='/builder/d?collection=project%20%2F%20caf%C3%A9&shot=shot%20%2F%2003A&takeTarget=1';
 expect(getProjectSaveTarget(path,[collection])).toEqual({requested:true,target:{collectionId:collection.id,shotId:'shot / 03A'}});
 expect(getProjectSaveTarget('/output/scene_one?collection=x&shot=y',[])).toEqual({requested:false});
 const output=carryProjectTarget('/output/d',path);
 expect(new URLSearchParams(output.split('?')[1]).get('collection')).toBe(collection.id);
 expect(getProjectSaveTarget(output,[collection]).target?.shotId).toBe('shot / 03A');
});
it.each(['?collection=missing&shot=x&takeTarget=1','?collection=project%20%2F%20caf%C3%A9&shot=deleted&takeTarget=1','?takeTarget=invalid'])('keeps invalid targets explicit so a save cannot silently detach: %s',query=>{
 expect(getProjectSaveTarget('/builder/d'+query,[collection])).toMatchObject({requested:true,error:expect.any(String)});
});
it('creates a new draft from the selected existing take and keeps target context',async()=>{
 vi.mocked(db.getAllSnapshot).mockResolvedValue({collections:[collection],scenes:[{id:'scene_one'}]} as never);
 vi.mocked(db.createDraftFromSavedScene).mockResolvedValue({id:'draft_copy'} as never);
 const route=await startProjectShotDraft(collection.id,'shot / 03A');
 expect(projects.initializeProject).toHaveBeenCalledWith(collection.id);
 expect(db.createDraftFromSavedScene).toHaveBeenCalledWith('scene_one');
 expect(route).toContain('/builder/draft_copy?');
 expect(getProjectSaveTarget(route,[collection]).target?.collectionId).toBe(collection.id);
});
it('creates an independent planned draft without overwriting another active draft or inventing a duration',async()=>{
 vi.mocked(db.getAllSnapshot).mockResolvedValue({collections:[collection],scenes:[]} as never);
 vi.mocked(db.saveSceneDraft).mockResolvedValue({id:'draft_planned'} as never);
 await startProjectShotDraft(collection.id,'planned');
 expect(db.createDraftFromSavedScene).not.toHaveBeenCalled();
 expect(db.saveSceneDraft).toHaveBeenCalledWith(expect.objectContaining({title:'04 — Planned confrontation',slots:{},settings:{}}));
 expect(vi.mocked(db.saveSceneDraft).mock.calls[0][0]).not.toHaveProperty('id');
});
