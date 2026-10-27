import { test, expect } from '@playwright/test';
import {
  seedMediaInspection,
  openInspectionPicker,
} from './media-inspection-fixture.mjs';
import { storedProof } from './storyboard-fixture.mjs';
const videoReady = async (video) => {
  await expect
    .poll(() => video.evaluate((v) => v.readyState))
    .toBeGreaterThanOrEqual(2);
};
test('camera and variant previews coordinate hover and explicit playback without selecting or writing', async ({
  page,
}) => {
  const ids = await seedMediaInspection(page);
  await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts');
    await db.savePromptAsset({
      category: 'camera',
      title: 'Second motion study',
      promptText: 'Pan right.',
      tags: [],
      mediaLinks: [
        { mediaId: id, role: 'sample', order: 0, altText: 'Second motion' },
      ],
    });
  }, ids.mediaId);
  await page.reload();
  const before = await storedProof(page);
  await openInspectionPicker(page, ids);
  const motion = page.locator('.asset-picker-card').filter({
    has: page.getByRole('heading', { name: ids.videoTitle, exact: true }),
  });
  const video = motion.locator('video');
  await videoReady(video);
  await video.hover();
  await expect
    .poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveJSProperty('playsInline', true);
  const second = page
    .locator('.asset-picker-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'Second motion study',
        exact: true,
      }),
    })
    .locator('video');
  await second.hover();
  await expect.poll(() => second.evaluate((v) => !v.paused)).toBe(true);
  await expect(video).toHaveJSProperty('paused', true);
  expect(
    await page
      .locator('.asset-picker-card video')
      .evaluateAll((videos) => videos.filter((v) => !v.paused).length)
  ).toBe(1);
  await page.getByRole('textbox', { name: 'Search Camera & Movement' }).hover();
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('currentTime', 0);
  await expect(second).toHaveJSProperty('paused', true);
  const trigger = motion.getByRole('button', { name: /^Preview media:/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Media: ' + ids.videoTitle });
  const enlarged = dialog.locator('video');
  await videoReady(enlarged);
  await expect(enlarged).toHaveJSProperty('controls', true);
  await expect(enlarged).toHaveJSProperty('paused', true);
  await expect(enlarged).toHaveJSProperty('muted', true);
  await enlarged.evaluate(async (v) => {
    await v.play();
  });
  await expect
    .poll(() => enlarged.evaluate((v) => v.currentTime))
    .toBeGreaterThan(0);
  await enlarged.evaluate((v) => {
    v.pause();
    v.currentTime = 0.25;
    v.volume = 0.4;
  });
  await expect
    .poll(() => enlarged.evaluate((v) => Math.abs(v.currentTime - 0.25) < 0.06))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(
    motion.getByRole('button', { name: /^Preview media:/ })
  ).toBeFocused();
  await page.getByRole('button', { name: /Character Variants/ }).click();
  const variant = page.locator('.asset-picker-card').filter({
    has: page.getByRole('heading', { name: 'Variant motion study' }),
  });
  await variant.locator('video').hover();
  await expect
    .poll(() => variant.locator('video').evaluate((v) => !v.paused))
    .toBe(true);
  await variant.getByRole('button', { name: /^Preview media:/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Media: Variant motion study' })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
  await variant.getByRole('button', { name: 'Select Variant' }).click();
  await expect
    .poll(async () => {
      const s = await storedProof(page);
      return s.drafts.find((d) => d.id === ids.draftId)?.slots.camera?.sourceId;
    })
    .toBe(ids.variantId);
});
test('image fit, zoom, scrolling, native size and reset preserve source dimensions and stored bytes', async ({
  page,
}) => {
  const ids = await seedMediaInspection(page);
  await page.evaluate(async () => {
    const db = await import('/src/storage/db.ts');
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 80;
    c.getContext('2d').fillRect(0, 0, 120, 80);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    const media = await db.saveMediaAsset({
      filename: 'small-source.png',
      mimeType: 'image/png',
      blob,
    });
    await db.savePromptAsset({
      category: 'camera',
      title: 'Small image study',
      promptText: 'Native pixels.',
      tags: [],
      mediaLinks: [
        {
          mediaId: media.id,
          role: 'sample',
          order: 0,
          altText: 'Small source',
        },
      ],
    });
  });
  await page.reload();
  const before = await storedProof(page);
  await openInspectionPicker(page, ids);
  await page
    .getByRole('button', { name: 'Preview media: Image study' })
    .click();
  const image = page.getByRole('dialog').locator('img'),
    viewport = page.getByRole('region', {
      name: 'Image viewport; scroll to pan when zoomed',
    });
  await expect
    .poll(() => image.evaluate((i) => i.complete && i.naturalWidth === 1600))
    .toBe(true);
  const fitted = await image.boundingBox();
  expect(fitted.width).toBeLessThanOrEqual(1600);
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: 'Zoom In' }).click();
  expect((await image.boundingBox()).width).toBeCloseTo(fitted.width * 4, 0);
  await expect(page.getByRole('button', { name: 'Zoom In' })).toBeDisabled();
  await viewport.evaluate((el) => {
    el.scrollLeft = 100;
    el.scrollTop = 100;
  });
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Actual Size' }).click();
  expect((await image.boundingBox()).width).toBe(1600);
  await page.getByRole('button', { name: 'Reset Zoom' }).click();
  expect((await image.boundingBox()).width).toBeCloseTo(fitted.width, 0);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', {
      name: 'Preview media: Small image study',
      exact: true,
    })
    .click();
  const small = page.getByRole('dialog').locator('img');
  await expect
    .poll(() => small.evaluate((i) => i.complete && i.naturalWidth === 120))
    .toBe(true);
  expect((await small.boundingBox()).width).toBe(120);
  expect((await small.boundingBox()).height).toBe(80);
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
});
test('fifty reference associations retain duplicate roles, paginate and preview independently of the featured item', async ({
  page,
}) => {
  const ids = await seedMediaInspection(page),
    before = await storedProof(page);
  await page.goto(`/#/output/${ids.sceneIds[0]}`);
  await page.getByRole('tab', { name: /^References/ }).click();
  const featured = await page
    .locator('.reference-caption > strong')
    .first()
    .textContent();
  await page.getByRole('button', { name: 'View All (50)' }).click();
  const gallery = page.getByRole('dialog', { name: 'All references' });
  await expect(gallery.getByRole('article')).toHaveCount(12);
  await expect(gallery.locator('video')).toHaveCount(6);
  await gallery
    .getByRole('button', { name: 'Preview 2 · motion: Association 1' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Media: Association 1' })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Preview 2 · motion: Association 1' })
  ).toBeFocused();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Next references page' }).click();
  await expect(gallery.getByRole('article')).toHaveCount(2);
  await expect(gallery.getByRole('button', { name: /^Download/ })).toHaveCount(
    2
  );
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'View All (50)' })
  ).toBeFocused();
  expect(
    await page.locator('.reference-caption > strong').first().textContent()
  ).toBe(featured);
  expect(await storedProof(page)).toEqual(before);
});
test('repeated image/video previews release URLs and pause detached players with heap observations', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const active = new Set(),
      create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    window.__inspectionUrls = active;
    URL.createObjectURL = (b) => {
      const url = create(b);
      active.add(url);
      return url;
    };
    URL.revokeObjectURL = (u) => {
      active.delete(u);
      revoke(u);
    };
  });
  const ids = await seedMediaInspection(page),
    before = await storedProof(page);
  await openInspectionPicker(page, ids);
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  const heap = async () => {
    await client.send('HeapProfiler.collectGarbage');
    const m = await client.send('Performance.getMetrics');
    return m.metrics.find((m) => m.name === 'JSHeapUsedSize').value;
  };
  const baselineUrls = await page.evaluate(() => window.__inspectionUrls.size),
    memoryBefore = await heap();
  const heapSamples = [memoryBefore];
  for (let i = 0; i < 12; i++) {
    const title = i % 2 === 0 ? 'Image study' : ids.videoTitle;
    await page
      .getByRole('button', { name: 'Preview media: ' + title, exact: true })
      .click();
    let player;
    if (i % 2) {
      const video = page.getByRole('dialog').locator('video');
      await videoReady(video);
      player = await video.elementHandle();
      await video.evaluate((v) => v.play());
      await expect
        .poll(() => video.evaluate((v) => v.currentTime))
        .toBeGreaterThan(0);
    } else await expect(page.getByRole('dialog').locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Preview media: ' + title, exact: true })
    ).toBeFocused();
    if (player) {
      expect(
        await player.evaluate((v) => ({
          connected: v.isConnected,
          paused: v.paused,
          time: v.currentTime,
        }))
      ).toEqual({ connected: false, paused: true, time: 0 });
      await player.dispose();
    }
    const sample = await client.send('Performance.getMetrics');
    heapSamples.push(
      sample.metrics.find((m) => m.name === 'JSHeapUsedSize').value
    );
  }
  await expect
    .poll(() => page.evaluate(() => window.__inspectionUrls.size))
    .toBe(baselineUrls);
  const memoryAfter = await heap();
  expect(memoryAfter - memoryBefore).toBeLessThan(8 * 1024 * 1024);
  expect(await storedProof(page)).toEqual(before);
  await info.attach('preview-resource-observation', {
    body: JSON.stringify({
      cycles: 12,
      imageCycles: 6,
      videoCycles: 6,
      observedJsHeapMaximum: Math.max(...heapSamples),
      activeUrlsBefore: baselineUrls,
      activeUrlsAfter: await page.evaluate(() => window.__inspectionUrls.size),
      jsHeapBefore: memoryBefore,
      jsHeapAfter: memoryAfter,
      note: 'Synthetic Chromium JS heap after forced GC; not whole-process or large-library certification.',
    }),
    contentType: 'application/json',
  });
});
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [720, 450],
])
  test(`eleven-shot List/Grid layout stays bounded at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const ids = await seedMediaInspection(page),
      before = await storedProof(page);
    await page.goto(
      `/#/collections/${ids.collectionId}?tab=storyboard&view=list`
    );
    const cards = page.locator('.cw-shot-card');
    await expect(cards).toHaveCount(11);
    const check = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      ).toBe(true);
      const first = cards.first(),
        header = await first.locator('.cw-shot-topline').boundingBox(),
        media = await first.locator('.cw-shot-image').boundingBox(),
        body = await first.locator('.cw-shot-body').boundingBox();
      expect(header.y + header.height).toBeLessThanOrEqual(media.y + 1);
      if (width > 768) {
        expect(media.width).toBeLessThanOrEqual(240);
        expect(media.x + media.width).toBeLessThanOrEqual(body.x + 1);
      } else expect(media.y + media.height).toBeLessThanOrEqual(body.y + 1);
    };
    await check();
    await cards.first().getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(cards.first().getByRole('checkbox')).toBeChecked();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await check();
    expect(await storedProof(page)).toEqual(before);
  });
test.describe('touch and reduced motion', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  test('camera media has explicit touch Preview with no hover playback', async ({
    page,
  }) => {
    const ids = await seedMediaInspection(page);
    await openInspectionPicker(page, ids);
    const video = page.locator('.asset-picker-card video').first();
    await videoReady(video);
    await video.dispatchEvent('pointerenter');
    await expect(video).toHaveJSProperty('paused', true);
    await page
      .getByRole('button', {
        name: 'Preview media: ' + ids.videoTitle,
        exact: true,
      })
      .tap();
    await expect(page.getByRole('dialog').locator('video')).toHaveJSProperty(
      'controls',
      true
    );
  });
});
