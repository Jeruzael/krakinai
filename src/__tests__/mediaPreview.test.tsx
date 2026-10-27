import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { PromptCard } from '../components/PromptCard';
import type { MediaAsset, PromptAsset } from '../types/domain';

const media = {
  id: 'video',
  mimeType: 'video/mp4',
  filename: 'clip.mp4',
  blob: new Blob(['video']),
} as MediaAsset;
let fine = true;
let reduced = false;
let changes: (() => void)[] = [];
beforeEach(() => {
  fine = true;
  reduced = false;
  changes = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query.includes('reduced-motion') ? reduced : fine;
      },
      addEventListener: (_: string, fn: () => void) => changes.push(fn),
      removeEventListener: vi.fn(),
    }))
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('media previews', () => {
  it('starts on a real pointer entry even before a stale offscreen observation catches up with scrolling', () => {
    let observe!: (entries:{isIntersecting:boolean}[])=>void;
    vi.stubGlobal('IntersectionObserver',class { constructor(callback:typeof observe){observe=callback;} observe(){} disconnect(){} });
    const {container}=render(<MediaThumbnail media={media} enableHoverPreview />);
    const video=container.querySelector('video')!;
    observe([{isIntersecting:false}]);
    fireEvent.pointerEnter(video.parentElement!);
    expect(video.play).toHaveBeenCalledOnce();
    observe([{isIntersecting:true}]);
  });
  it('allows only one active hover preview across multiple thumbnails', () => {
    const {container}=render(<><MediaThumbnail media={media} enableHoverPreview /><MediaThumbnail media={{...media,id:'second-video'}} enableHoverPreview /></>);
    const [first,second]=[...container.querySelectorAll('video')];
    fireEvent.pointerEnter(first.parentElement!);
    first.currentTime=3;
    vi.mocked(first.pause).mockClear();
    fireEvent.pointerEnter(second.parentElement!);
    expect(first.pause).toHaveBeenCalled();
    expect(first.currentTime).toBe(0);
  });

  it('stops a hover preview when the page becomes hidden', () => {
    const {container}=render(<MediaThumbnail media={media} enableHoverPreview />);
    const video=container.querySelector('video')!;
    fireEvent.pointerEnter(video.parentElement!);
    video.currentTime=3;
    const visible=vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
    fireEvent(document,new Event('visibilitychange'));
    expect(video.currentTime).toBe(0);
    visible.mockRestore();
  });
  it('opts in to muted inline looping playback and resets on exit and unmount', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { container, unmount } = render(
      <MediaThumbnail media={media} enableHoverPreview />
    );
    const video = container.querySelector('video')!;
    fireEvent.pointerEnter(video.parentElement!);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.controls).toBe(false);
    video.currentTime = 3;
    fireEvent.pointerLeave(video.parentElement!);
    expect(video.currentTime).toBe(0);
    expect(video.pause).toHaveBeenCalled();
    unmount();
    expect(revoke).toHaveBeenCalled();
  });
  it.each(['default', 'touch', 'reduced'])(
    'does not autoplay in %s mode',
    (mode) => {
      fine = mode !== 'touch';
      reduced = mode === 'reduced';
      const { container } = render(
        <MediaThumbnail media={media} enableHoverPreview={mode !== 'default'} />
      );
      fireEvent.pointerEnter(container.querySelector('video')!.parentElement!);
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    }
  );
  it('stops and releases the previous cover when media changes', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { container, rerender } = render(
      <MediaThumbnail media={media} enableHoverPreview />
    );
    const previousUrl = container.querySelector('video')!.getAttribute('src');
    fireEvent.pointerEnter(container.querySelector('video')!.parentElement!);
    rerender(
      <MediaThumbnail
        media={{ ...media, id: 'replacement' }}
        enableHoverPreview
      />
    );
    expect(revoke).toHaveBeenCalledWith(previousUrl);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
  it('stops when preferences change, handles rejected play and corrupt media', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new Error('blocked')
    );
    const { container } = render(
      <MediaThumbnail media={media} enableHoverPreview />
    );
    const video = container.querySelector('video')!;
    fireEvent.pointerEnter(video.parentElement!);
    await Promise.resolve();
    reduced = true;
    changes.forEach((fn) => fn());
    expect(video.pause).toHaveBeenCalled();
    fireEvent.error(video);
    expect(
      screen.getByText('Media file unavailable or corrupted.')
    ).toBeInTheDocument();
  });
  it('stops an active preview when disabled for expansion and ignores late play resolution', async () => {
    let finish!: () => void;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const { container, rerender } = render(
      <MediaThumbnail media={media} enableHoverPreview />
    );
    const video = container.querySelector('video')!;
    fireEvent.pointerEnter(video.parentElement!);
    vi.mocked(video.pause).mockClear();
    rerender(<MediaThumbnail media={media} enableHoverPreview={false} />);
    expect(video.pause).toHaveBeenCalled();
    video.currentTime = 3;
    finish();
    await Promise.resolve();
    expect(video.currentTime).toBe(0);
  });
  it('does not let an older play promise stop a newly entered preview', async () => {
    const finishes: (() => void)[] = [];
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(
      () => new Promise<void>((resolve) => finishes.push(resolve))
    );
    const { container } = render(
      <MediaThumbnail media={media} enableHoverPreview />
    );
    const video = container.querySelector('video')!;
    fireEvent.pointerEnter(video.parentElement!);
    fireEvent.pointerLeave(video.parentElement!);
    fireEvent.pointerEnter(video.parentElement!);
    vi.mocked(video.pause).mockClear();
    finishes[0]();
    await Promise.resolve();
    expect(video.pause).not.toHaveBeenCalled();
  });
  it('allows user-controlled expanded playback to continue on pointer exit', () => {
    const { container } = render(
      <MediaThumbnail media={media} showVideoControls />
    );
    const video = container.querySelector('video')!;
    vi.mocked(video.pause).mockClear();
    fireEvent.pointerLeave(video.parentElement!);
    expect(video.pause).not.toHaveBeenCalled();
  });
  it('never plays images and opens an image expansion with a keyboard-trapped close control', async () => {
    const user = userEvent.setup();
    const image = {
      ...media,
      id: 'image',
      filename: 'still.png',
      mimeType: 'image/png',
    };
    const item = {
      id: 'p',
      title: 'Still',
      category: 'camera',
      mediaLinks: [{ mediaId: image.id }],
      tags: [],
      promptText: 'Pan',
      favorite: false,
    } as unknown as PromptAsset;
    const { container } = render(
      <PromptCard
        item={item}
        kind="asset"
        mediaMap={new Map([[image.id, image]])}
        onOpen={() => {}}
        onCopy={() => {}}
        onToggleFavorite={() => {}}
        onAddToScene={() => {}}
      />
    );
    expect(container.querySelector('button button')).toBeNull();
    fireEvent.pointerEnter(container.querySelector('img')!.parentElement!);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Expand media: Still' })
    );
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute(
      'alt',
      'Still'
    );
    const close = screen.getByRole('button', { name: 'Close Media: Still' });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('keeps navigation separate from image/video expansion and restores keyboard focus', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const item = {
      id: 'p',
      title: 'Camera',
      category: 'camera',
      mediaLinks: [{ mediaId: media.id }],
      tags: [],
      promptText: 'Pan',
      favorite: false,
    } as unknown as PromptAsset;
    render(
      <PromptCard
        item={item}
        kind="asset"
        mediaMap={new Map([[media.id, media]])}
        onOpen={open}
        onCopy={() => {}}
        onToggleFavorite={() => {}}
        onAddToScene={() => {}}
      />
    );
    const trigger = screen.getByRole('button', {
      name: 'Expand media: Camera',
    });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('video')).toHaveAttribute('controls');
    expect(dialog.querySelector('video')).not.toHaveAttribute('autoplay');
    expect(open).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Open Prompt' }));
    expect(open).toHaveBeenCalledOnce();
  });
});
