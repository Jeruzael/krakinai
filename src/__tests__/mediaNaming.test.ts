import { expect, it } from 'vitest';
import { captureMediaNames, getMediaDisplayName, getDownloadFilename, validateExportFilename } from '../domain/mediaNaming';
import type { MediaAsset, MediaLink } from '../types/domain';
const media = {id:'m',filename:'original.png',safeFilename:'original.png',mimeType:'image/png',displayName:'Portrait',exportFilename:'portrait.png'} as MediaAsset;
it('freezes overrides and explicit absence without changing source identity',()=>{
 const links:MediaLink[]=[{mediaId:'m',role:'reference',altText:'Accessibility',order:0}];
 const captured=captureMediaNames(links,new Map([['m',media]]));
 expect(captured[0]).toMatchObject({displayName:'Portrait',exportFilename:'portrait.png',namesCaptured:true,altText:'Accessibility'});
 expect(captureMediaNames(captured,new Map([['m',{...media,displayName:'Later'}]]))).toEqual(captured);
 expect(getMediaDisplayName(media,links[0],true)).toBe('original.png');
 expect(getDownloadFilename(media,captured[0],true)).toBe('portrait.png');
 const absent=captureMediaNames(links,new Map([['m',{...media,displayName:undefined,exportFilename:undefined}]]));
 expect(getMediaDisplayName({...media,displayName:'Later'},absent[0],true)).toBe('original.png');
});
it.each(['../a.png','a/b.png','CON.png','nul.png','a.jpg','a.png ','a..png','a\u0000.png'])('rejects unsafe or incompatible name %s',name=>expect(()=>validateExportFilename(name,'image/png')).toThrow());
it('accepts actual MIME extensions and Unicode',()=>{expect(validateExportFilename('Aya face.png','image/png')).toBe('Aya face.png');expect(validateExportFilename('portrait.jpeg','image/jpeg')).toBe('portrait.jpeg');});
