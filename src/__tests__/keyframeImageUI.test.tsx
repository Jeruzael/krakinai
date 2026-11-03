import React from 'react';
import {it,expect,afterEach,vi} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FrameImagePanel} from '../components/keyframes/FrameImagePanel';
import {seedKeyframeStorage} from './fixtures/keyframeStorageFixture';
import {getAllSnapshot} from '../storage/db';
import rasters from './fixtures/frame-raster-fixtures.json';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('rejects corrupt bytes, uploads valid images needing review, and preserves legacy associations',async()=>{
 const f=await seedKeyframeStorage(),before=await getAllSnapshot(),onChanged=vi.fn();const target={collectionId:f.projectId,expectedProjectRevision:before.collections[0].project!.revision,shotId:f.shotId,sceneId:f.parent.id,expectedSceneRevision:f.parent.revision,frameId:'middle',expectedVisualDigest:f.parent.imagePromptSnapshots!.middle.visualDigest,expectedAssociationRevision:0};
 render(<FrameImagePanel target={target} collection={before.collections[0]} mediaMap={new Map(before.media.map(m=>[m.id,m]))} onChanged={onChanged}/>);const user=userEvent.setup();
 await user.upload(screen.getByLabelText('Upload image for this frame'),new File(['bad'],'bad.png',{type:'image/png'}));expect(await screen.findByRole('alert')).toHaveTextContent(/image|raster|corrupt/i);expect(await getAllSnapshot()).toEqual(before);
 await user.upload(screen.getByLabelText('Upload image for this frame'),new File([Uint8Array.from(atob(rasters.files[0].base64),c=>c.charCodeAt(0))],'synthetic.png',{type:'image/png'}));await waitFor(()=>expect(onChanged).toHaveBeenCalledTimes(1));
 const after=await getAllSnapshot();expect(after.collections[0].project!.frameProduction!.imageEvents[0].reviewStatus).toBe('needs_review');expect(after.scenes).toEqual(before.scenes);
});
