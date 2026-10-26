import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { collectReferenceCandidates, buildReferencePackZip } from '../domain/referencePack';
import { legacyDraft } from './fixtures/legacyScene';
import type { MediaAsset } from '../types/domain';
const media = {id:'same',filename:'../../face.png',safeFilename:'face.png',mimeType:'image/png',blob:new Blob(['original']),byteSize:8,createdAt:''} satisfies MediaAsset;
it('preserves role associations and stable IDs across unrelated reorder/title edits',()=>{
 const s=structuredClone(legacyDraft); s.slots.character!.mediaLinks=[{mediaId:'same',role:'reference',altText:'face',order:0},{mediaId:'same',role:'sample',altText:'face',order:1}];
 const first=collectReferenceCandidates(s,new Map()); s.slots.character!.sourceTitle='New title'; s.slots.character!.mediaLinks.reverse();
 expect(collectReferenceCandidates(s,new Map()).map(e=>e.associationId).sort()).toEqual(first.map(e=>e.associationId).sort()); expect(first.filter(e=>e.mediaId==='same')).toHaveLength(2);
});
it('ZIP keeps ordered associations, deduplicates binaries, and preserves bytes safely',async()=>{
 const s=structuredClone(legacyDraft); s.slots={character:{...s.slots.character!,mediaLinks:[{mediaId:'same',role:'reference',altText:'face',order:0},{mediaId:'same',role:'sample',altText:'sample',order:1}]}};
 const entries=collectReferenceCandidates(s,new Map([['same',media]])); const files=unzipSync(await buildReferencePackZip({version:1,entries},new Map([['same',media]])));
 const manifest=JSON.parse(strFromU8(files['manifest.json'])); expect(manifest.entries).toHaveLength(2); expect(manifest.entries[0].binaryPath).toBe(manifest.entries[1].binaryPath); expect(Object.keys(files)).toHaveLength(2); expect(strFromU8(files[manifest.entries[0].binaryPath])).toBe('original'); expect(Object.keys(files).join('')).not.toContain('..');
 await expect(buildReferencePackZip({version:1,entries},new Map())).rejects.toThrow(/same/);
});
it('collects only unmatched legacy checklist occurrences and retains explicit result origins',()=>{
 const draft=structuredClone(legacyDraft);draft.slots={character:{...draft.slots.character!,mediaLinks:[{mediaId:'a',role:'reference',altText:'face',order:0}]}};
 const saved={...draft,references:[...draft.slots.character!.mediaLinks,{mediaId:'b',role:'sample' as const,altText:'old association',order:1}],outputs:{full:'',structured:'',compact:''},revision:1,createdAt:''};saved.resultMediaLinks=[{mediaId:'a',role:'result',altText:'generated',order:0}];
 const entries=collectReferenceCandidates(saved,new Map());expect(entries.map(entry=>entry.sourceSlot)).toEqual(['character','legacy','result']);expect(entries.map(entry=>entry.mediaId)).toEqual(['a','b','a']);
});
it('keeps otherwise identical duplicate associations distinct',()=>{const source=structuredClone(legacyDraft);const link={mediaId:'duplicate',role:'reference' as const,altText:'same',order:0};source.slots={character:{...source.slots.character!,mediaLinks:[link,{...link,order:1}]}};const entries=collectReferenceCandidates(source,new Map());expect(entries).toHaveLength(2);expect(new Set(entries.map(entry=>entry.associationId)).size).toBe(2);});
it('retains a distinct view-label association from the saved checklist',()=>{const source=structuredClone(legacyDraft);const link={mediaId:'same',role:'reference' as const,altText:'face',viewLabel:'front',order:0};source.slots={character:{...source.slots.character!,mediaLinks:[link]}};const saved={...source,references:[{...link,viewLabel:'side'}],outputs:{full:'',structured:'',compact:''},revision:1,createdAt:''};expect(collectReferenceCandidates(saved,new Map()).map(entry=>entry.sourceSlot)).toEqual(['character','legacy']);});
