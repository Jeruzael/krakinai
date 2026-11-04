import {it,expect} from 'vitest';
import {seedImportHistoryBulk} from './fixtures/importHistoryFixture';
import {previewChangeSet,applyApprovedChangeSet} from '../storage/changeSets';
import {getAllSnapshot} from '../storage/db';
import {verifyImportEvidence} from '../domain/importEvidence';
import {canonicalStringify} from '../domain/changeSetCanonical';
import {keyframeReviewedProjection} from '../domain/keyframeChangeSet';
it('saves all 15 synthetic recipe takes and 33 complete frame prompts with exact mixed-history replay',async()=>{
 const f=await seedImportHistoryBulk(),before=await getAllSnapshot(),p=await previewChangeSet(f.input,f.approval);
 expect(p.plan.findings.filter(f=>f.severity==='blocking').map(f=>({code:f.code,message:f.message}))).toEqual([]);
 expect(p.plan.scenes).toHaveLength(15);expect(p.plan.scenes.reduce((n,s)=>n+s.keyframePlan!.frames.length,0)).toBe(33);
 const r:any=await applyApprovedChangeSet(p,p.approvedDigest),after=await getAllSnapshot(),newIds=new Set(Object.values(r.idMappings as Record<string,{kind:string;id:string}>).filter(v=>v.kind==='scene').map(v=>v.id));
 expect(newIds.size).toBe(15);expect(after.scenes.filter(s=>!newIds.has(s.id))).toEqual(before.scenes);expect(after.preferences.aiImports!.receipts.slice(0,3)).toEqual(before.preferences.aiImports!.receipts);
 for(const scene of after.scenes.filter(s=>newIds.has(s.id))){expect(scene.outputs.full.length).toBeGreaterThan(100);for(const frame of scene.keyframePlan!.frames){expect(scene.imagePromptSnapshots![frame.id].full.length).toBeGreaterThan(100);expect(scene.imagePromptSnapshots![frame.id].compact!.length).toBeGreaterThan(100);}}
 expect(await verifyImportEvidence(r.reviewedEvidence)).toBe(canonicalStringify(keyframeReviewedProjection(p.plan)));expect(p.capacity?.receiptBytes).toBeLessThan(r.reviewedEvidence.uncompressedBytes);
 const replay=await previewChangeSet(f.input);expect(await applyApprovedChangeSet(replay,replay.approvedDigest)).toEqual(r);expect(await getAllSnapshot()).toEqual(after);
},60000);
