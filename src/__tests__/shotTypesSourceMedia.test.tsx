import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SourceMediaPicker } from '../components/SourceMediaPicker';
import { ReferencePackManager } from '../components/ReferencePackManager';
import { clearAllStoresForTesting, getAllSnapshot, initializeDatabase } from '../storage/db';
import type { MediaAsset, MediaLink } from '../types/domain';
import { legacyDraft } from './fixtures/legacyScene';

beforeEach(async()=>{await clearAllStoresForTesting();await initializeDatabase();});
afterEach(cleanup);
const media: MediaAsset = {id:'original',filename:'original.png',safeFilename:'original.png',mimeType:'image/png',blob:new Blob(['original'],{type:'image/png'}),byteSize:8,createdAt:'2026-10-28'};
const links: MediaLink[] = [{mediaId:media.id,filename:media.filename,mimeType:media.mimeType,role:'reference',order:0,altText:'Original'}];

it('keeps originals selected and required when suggesting a reference pack',async()=>{
  const source={...legacyDraft,shotType:'graphic_motion' as const,sourceMediaLinks:links};
  const apply=vi.fn();
  render(<ReferencePackManager source={source} mediaMap={new Map([[media.id,media]])} onApply={apply} onClose={vi.fn()} />);
  const checkbox=screen.getByRole('checkbox',{name:/original\.png/});
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeDisabled();
  expect(screen.queryByRole('heading',{name:'Character Identity'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Apply Suggested Pack'}));
  expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Apply Reference Pack'}));
  await waitFor(()=>expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0][0].entries[0]).toMatchObject({mediaId:media.id,sourceSlot:'source',role:'reference'});
});

it('rejects wrong MIME before storing a new source and preserves the existing link', async()=>{
  const change = vi.fn(), error=vi.fn();
  render(<SourceMediaPicker kind="image" links={links} mediaMap={new Map([[media.id,media]])} onChange={change} onUploaded={vi.fn()} onError={error} />);
  fireEvent.change(screen.getByLabelText('Replace original source image'),{target:{files:[new File(['video'],'wrong.mp4',{type:'video/mp4'})]}});
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Choose an original source image with a supported MIME type.'));
  expect(change).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
  expect((await getAllSnapshot()).media).toHaveLength(0);
  expect(screen.getByLabelText('Existing source media')).toHaveValue(media.id);
});

it('uploads original bytes and name through existing media persistence',async()=>{
  const change=vi.fn().mockResolvedValue(undefined),uploaded=vi.fn();
  render(<SourceMediaPicker kind="video" links={[]} mediaMap={new Map()} onChange={change} onUploaded={uploaded}/>);
  const file=new File(['original-video-bytes'],'Original unedited footage.webm',{type:'video/webm'});
  fireEvent.change(screen.getByLabelText('Upload original source video'),{target:{files:[file]}});
  await waitFor(()=>expect(change).toHaveBeenCalledOnce());
  const stored=(await getAllSnapshot()).media[0];
  expect(stored).toMatchObject({filename:file.name,mimeType:file.type,byteSize:file.size});
  expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));
  expect(change.mock.calls[0][0]).toEqual([{mediaId:stored.id,role:'reference',order:0,filename:file.name,mimeType:file.type,altText:'Original source video'}]);
  expect(uploaded).toHaveBeenCalledOnce();
});

it('shows missing sources and failed association saves without clearing a previous selection',async()=>{
  const change=vi.fn().mockRejectedValue(new Error('Draft storage unavailable'));
  const {rerender}=render(<SourceMediaPicker kind="image" links={links} mediaMap={new Map()} onChange={change} onUploaded={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Original source file is missing from storage');
  expect(screen.getByRole('button',{name:'Preview original source'})).toBeDisabled();
  rerender(<SourceMediaPicker kind="image" links={links} mediaMap={new Map([[media.id,media]])} onChange={change} onUploaded={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'Remove source media'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Draft storage unavailable'));
  expect(screen.getByLabelText('Existing source media')).toHaveValue(media.id);
  expect(screen.getByText('original.png',{selector:'strong'})).toBeInTheDocument();
});
