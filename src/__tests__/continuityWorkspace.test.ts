import { describe, expect, it } from 'vitest';
import type { Collection, MediaAsset, SavedScene } from '../types/domain';
import { buildContinuityWorkspace } from '../domain/continuityWorkspace';
import { legacyScene } from './fixtures/legacyScene';
import { ensembleDraft } from './fixtures/ensembleFixture';

function fixture() {
  const scenes: SavedScene[] = ['s1','s2'].map(id => ({ ...structuredClone(legacyScene), id }));
  const collection: Collection = { id:'p', name:'Synthetic', description:'', members:[], createdAt:'', updatedAt:'', project:{version:1,revision:4,shots:[
    {id:'b',order:1,code:'09',title:'Second',takeSceneIds:['s2'],selectedSceneId:'s2',status:'planned'},
    {id:'a',order:0,code:'08',title:'First',takeSceneIds:['s1'],selectedSceneId:'s1',status:'planned'},
  ]}};
  return { collection, scenes };
}
const image = (): MediaAsset => ({id:'image',filename:'synthetic.png',safeFilename:'synthetic.png',mimeType:'image/png',byteSize:2,blob:new Blob(['ok'],{type:'image/png'}),createdAt:''});

describe('read-only continuity presentation', () => {
  it('keeps real storyboard order and leaves frozen sources byte-equivalent', () => {
    const {collection,scenes}=fixture(), before=JSON.stringify({collection,scenes});
    const model=buildContinuityWorkspace(collection,scenes,[]);
    expect(model.rows.map(r=>r.shot.id)).toEqual(['a','b']);
    expect(model.summary.selectedTakes).toBe(2);
    expect(model.matrix[0].appearances.map(a=>a.sameAsPrevious)).toEqual([false,true]);
    expect(JSON.stringify({collection,scenes})).toBe(before);
  });
  it('distinguishes optional, missing and invalid image records, counting unique actual files', () => {
    const {collection,scenes}=fixture();
    collection.project!.shots[0].firstFrameMediaId='gone';
    const initial=buildContinuityWorkspace(collection,scenes,[]);
    expect(initial.rows[0].frames.first.state).toBe('unassigned');
    expect(initial.rows[1].frames.first.state).toBe('missing');
    expect(initial.rows[0].attention).toBe(false);
    expect(initial.rows[1].attention).toBe(true);
    collection.project!.shots.forEach(s=>{s.firstFrameMediaId='image';});
    expect(buildContinuityWorkspace(collection,scenes,[image()]).summary.availableImages).toBe(1);
    expect(buildContinuityWorkspace(collection,scenes,[{...image(),mimeType:'video/mp4'}]).rows[0].frames.first.state).toBe('invalid');
  });
  it('never substitutes a different take for a missing or unselected saved take', () => {
    const {collection,scenes}=fixture();collection.project!.shots[0].selectedSceneId='missing';
    delete collection.project!.shots[1].selectedSceneId;
    const model=buildContinuityWorkspace(collection,scenes,[]);
    expect(model.rows.every(r=>!r.scene)).toBe(true);
    expect(model.summary).toMatchObject({selectedTakes:0,missingSelectedTakes:1,unselectedTakes:1});
  });
  it('keeps every participant binding, its own Outfit and off-camera presence', () => {
    const {collection}=fixture();const scene={...structuredClone(legacyScene),...ensembleDraft(),id:'s1'} as SavedScene;
    const clone=structuredClone(scene.ensemble!.participants[0]);clone.id='aya-double';clone.wardrobe={...clone.wardrobe!,sourceId:'second-gown',promptText:'Distinct saved gown'};
    scene.ensemble!.participants.push(clone);
    scene.ensemble!.participants.find(p=>p.id==='lucas')!.presence='off_camera';
    const model=buildContinuityWorkspace(collection,[scene],[]);
    const aya=model.matrix.find(g=>g.characterId===clone.character.sourceId)!;
    expect(aya.appearances.map(a=>a.participantId)).toEqual([scene.ensemble!.participants[0].id,'aya-double']);
    expect(aya.appearances.map(a=>a.wardrobeSourceId)).toEqual(['aya-outfit','second-gown']);
    expect(model.matrix.find(g=>g.characterId==='lucas')!.appearances[0].offCamera).toBe(true);
  });
  it('retains detached exact transition pairs after reorder, with optional adjacent gaps', () => {
    const {collection,scenes}=fixture();collection.project!.transitions=[{id:'edge',fromShotId:'b',toShotId:'a',type:'match_cut',description:'Keep the original pair',notes:''}];
    const model=buildContinuityWorkspace(collection,scenes,[]);
    expect(model.pairs.map(p=>[p.from.id,p.to.id,p.transition])).toEqual([['a','b',undefined]]);
    expect(model.detached.map(t=>[t.id,t.fromShotId,t.toShotId])).toEqual([['edge','b','a']]);
    expect(model.summary.detachedTransitions).toBe(1);
  });
  it('does not materialize a legacy project during inspection', () => {
    const {collection,scenes}=fixture();delete collection.project;collection.members=[{type:'scene',id:'s1',addedAt:''}];
    expect(buildContinuityWorkspace(collection,scenes,[]).rows[0].shot.id).toBe('p:legacy:s1');
    expect(collection).not.toHaveProperty('project');
  });
});
