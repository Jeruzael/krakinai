import { test, expect } from '@playwright/test';
import { seedStoryboardFixture, storedProof } from './storyboard-fixture.mjs';

test.use({ viewport: { width: 1440, height: 900 } });
const route = (ids) =>
  `/#/collections/${ids.collectionId}?tab=storyboard&sort=order`;
const noOverflow = async (page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1
    )
  ).toBe(true);
const playback = (video) =>
  video.evaluate((v) => ({
    paused: v.paused,
    time: v.currentTime,
    muted: v.muted,
    loop: v.loop,
    inline: v.playsInline,
  }));

test('eleven real video shots hover, reset, expand and preserve all records and media hashes', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await seedStoryboardFixture(page),
    before = await storedProof(page);
  expect(ids.decoded).toEqual({ width: 320, height: 180 });
  expect(ids.videoBytes).toBeGreaterThan(1000);
  await page.goto(route(ids));
  const cards = page.locator('.cw-shot-card');
  await expect(cards).toHaveCount(11);
  const originalURL = page.url();
  for (let i = 0; i < 11; i++) {
    const video = cards.nth(i).locator('video');
    await video.evaluate((v) => {
      v.qaEvents = [];
      for (const name of [
        'play',
        'playing',
        'pause',
        'pointerenter',
        'pointerleave',
        'error',
      ])
        v.addEventListener(name, () =>
          v.qaEvents.push({ name, time: v.currentTime, ready: v.readyState })
        );
    });
    await video.hover();
    await expect
      .poll(
        () =>
          video.evaluate((v) => ({
            playing: !v.paused && v.currentTime > 0,
            ready: v.readyState,
            events: v.qaEvents,
            error: v.error?.message,
          })),
        { message: `Hover shot ${i + 1}` }
      )
      .toMatchObject({ playing: true });
    expect(await playback(video)).toMatchObject({
      paused: false,
      muted: true,
      loop: true,
      inline: true,
    });
    expect(
      await page
        .locator('video')
        .evaluateAll((videos) => videos.filter((v) => !v.paused).length)
    ).toBe(1);
    await page.mouse.move(1, 1);
    await expect
      .poll(() => playback(video))
      .toMatchObject({ paused: true, time: 0 });
  }
  expect(page.url()).toBe(originalURL);
  const first = cards.first(),
    trigger = first.getByRole('button', {
      name: 'Preview media: Arrival at the station',
    });
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Media: Arrival at the station',
  });
  await expect(dialog.locator('video')).toHaveAttribute('controls', '');
  await expect(dialog.locator('video')).toHaveJSProperty('muted', true);
  await expect(first.locator('video')).toHaveCount(0);
  await expect(dialog.locator('video')).not.toHaveAttribute('autoplay', '');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  // Cover in workspace, results gallery, then collection overview use the same player.
  for (const [url, selector] of [
    [route(ids), '.cw-cover'],
    [`/#/collections/${ids.collectionId}?tab=results`, '.cw-result-preview'],
    ['/#/collections', '.prompt-card-media'],
  ]) {
    await page.goto(url);
    const surface = page.locator(selector).first(),
      video = surface.locator('video');
    await video.hover();
    await expect
      .poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0))
      .toBe(true);
    await surface.getByRole('button', { name: /Preview media:/ }).click();
    await expect(page.getByRole('dialog').locator('video')).toHaveAttribute(
      'controls',
      ''
    );
    await page.keyboard.press('Escape');
  }
  await expect.poll(() => storedProof(page)).toEqual(before);
  await page.reload();
  expect(await storedProof(page)).toEqual(before);
  expect(errors).toEqual([]);
  await info.attach('video-and-preservation-proof', {
    body: JSON.stringify({
      video: ids.decoded,
      bytes: ids.videoBytes,
      shots: 11,
      media: before.media,
      allStoresEqual: true,
      errors,
    }),
    contentType: 'application/json',
  });
});

test('reduced motion disables hover and explicit Preview stays usable', async ({
  page,
}) => {
  const ids = await seedStoryboardFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route(ids));
  const first = page.locator('.cw-shot-card').first(),
    video = first.locator('video');
  await video.hover();
  expect(await playback(video)).toMatchObject({ paused: true, time: 0 });
  await expect(
    page.getByRole('button', { name: 'Preview media: Arrival at the station' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Preview media: Arrival at the station' })
    .click();
  await expect(page.getByRole('dialog').locator('video')).toHaveAttribute(
    'controls',
    ''
  );
});

test.describe('touch collection media', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test('uses visible Preview rather than hover and never navigates on playback', async ({
    page,
  }) => {
    const ids = await seedStoryboardFixture(page);
    await page.goto(route(ids));
    expect(
      await page.evaluate(
        () => matchMedia('(hover: hover) and (pointer: fine)').matches
      )
    ).toBe(false);
    const video = page.locator('.cw-shot-card').first().locator('video');
    await video.dispatchEvent('pointerenter', { pointerType: 'touch' });
    expect(await playback(video)).toMatchObject({ paused: true, time: 0 });
    const url = page.url();
    await page
      .getByRole('button', { name: 'Preview media: Arrival at the station' })
      .tap();
    await expect(page.getByRole('dialog').locator('video')).toHaveAttribute(
      'controls',
      ''
    );
    expect(page.url()).toBe(url);
    await noOverflow(page);
  });
});

test('secondary actions, drag grip and keyboard ordering preserve saved takes', async ({
  page,
}, testInfo) => {
  const ids = await seedStoryboardFixture(page),
    before = await storedProof(page);
  await page.goto(route(ids));
  const card = page.locator('.cw-shot-card').first(),
    more = card.getByLabel('More actions for Arrival at the station');
  await expect(
    card.getByRole('button', { name: 'Edit Arrival at the station' })
  ).not.toBeVisible();
  await more.focus();
  await page.keyboard.press('Enter');
  for (const name of [
    'Edit Arrival at the station',
    'New take for Arrival at the station',
    'Move Arrival at the station up',
    'Move Arrival at the station down',
    'Insert Before',
    'Insert After',
    'Remove Arrival at the station',
  ])
    await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await more.click();
  await card
    .getByRole('button', { name: 'Edit Arrival at the station' })
    .click();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  // A video itself cannot start a shot drag.
  expect(
    await card.locator('video').evaluate((v) => {
      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      v.dispatchEvent(event);
      return event.defaultPrevented;
    })
  ).toBe(true);
  const order = () =>
    page.evaluate(async (id) => {
      const { getAllSnapshot } = await import('/src/storage/db.ts');
      return (await getAllSnapshot()).collections
        .find((c) => c.id === id)
        .project.shots.map((s) => s.id);
    }, ids.collectionId);
  await page.evaluate(() => {
    window.qaDragTrace = [];
    for (const name of ['dragstart', 'dragover', 'drop', 'dragend'])
      document.addEventListener(name, (event) => {
        if (window.qaDragTrace.length < 100)
          window.qaDragTrace.push({
            name,
            target: event.target.className,
            types: [...(event.dataTransfer?.types ?? [])],
            prevented: event.defaultPrevented,
            x: event.clientX,
            y: event.clientY,
          });
      });
  });
  // Center both adjacent headers before taking coordinates. Restored menu focus
  // can otherwise leave the source grip at the viewport edge. Two target moves
  // deliver Chromium's native dragover before release on every supported OS.
  await card
    .locator('.cw-shot-topline')
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const grip = await card
    .getByRole('button', { name: 'Drag Arrival at the station to reorder' })
    .boundingBox();
  const target = await page
    .locator('.cw-shot-card')
    .nth(1)
    .locator('.cw-shot-topline')
    .boundingBox();
  expect(grip).not.toBeNull();
  expect(target).not.toBeNull();
  const sourceX = grip.x + grip.width / 2,
    sourceY = grip.y + grip.height / 2;
  const targetX = target.x + target.width / 2,
    targetY = target.y + target.height / 2;
  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX + 10, sourceY + 5, { steps: 3 });
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.move(targetX + 2, targetY);
  await page.mouse.up();
  const moved = [ids.shotIds[1], ids.shotIds[0], ...ids.shotIds.slice(2)];
  try {
    await expect.poll(order).toEqual(moved);
  } finally {
    await testInfo.attach('storyboard-drag-trace', {
      body: JSON.stringify(await page.evaluate(() => window.qaDragTrace)),
      contentType: 'application/json',
    });
  }
  const movedCard = page.locator('.cw-shot-card').nth(1);
  await movedCard.getByLabel('More actions for Arrival at the station').click();
  const up = movedCard.getByRole('button', {
    name: 'Move Arrival at the station up',
  });
  await up.focus();
  await page.keyboard.press('Enter');
  await expect.poll(order).toEqual(ids.shotIds);
  const after = await storedProof(page);
  for (const key of Object.keys(before).filter((k) => k !== 'collections'))
    expect(after[key]).toEqual(before[key]);
  await page.getByLabel('More actions for Arrival at the station').click();
  await page
    .getByRole('button', { name: 'Remove Arrival at the station', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Source saved scenes and their prompts are kept'
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await storedProof(page)).scenes).toEqual(before.scenes);
});

for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
  [720, 450],
]) {
  test(`continuity forms stack, footer and focus remain reachable at ${width}x${height}`, async ({
    page,
  }) => {
    const ids = await seedStoryboardFixture(page);
    await page.evaluate(async (ids) => {
      const { updateProjectShot } = await import('/src/storage/projects.ts');
      await updateProjectShot({
        collectionId: ids.collectionId,
        shotId: ids.shotIds[0],
        patch: { title: 'LongUnbrokenShotTitle'.repeat(5).slice(0, 100) },
      });
    }, ids);
    await page.setViewportSize({ width, height });
    await page.goto(route(ids));
    const before = await storedProof(page);
    await page.locator('.cw-continuity-review > summary').click();
    const details = page.locator('.pc-wardrobe-details').first();
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details.locator('.pc-prewrap')).toHaveText(
      ids.wardrobeText.trim()
    );
    const trigger = page
      .getByRole('button', { name: 'Review wardrobe', exact: true })
      .first();
    await trigger.click();
    const dialog = page.getByRole('dialog');
    const assertStack = async () => {
      const bounds = await dialog
        .locator('.pc-form-field')
        .evaluateAll((fields) =>
          fields.map((label) => {
            const c = label.querySelector('input,select,textarea'),
              l = label.getBoundingClientRect(),
              r = c.getBoundingClientRect();
            return {
              top: l.y,
              bottom: r.bottom,
              controlTop: r.y,
              labelWidth: l.width,
              controlWidth: r.width,
            };
          })
        );
      for (let i = 0; i < bounds.length; i++) {
        expect(bounds[i].controlTop).toBeGreaterThan(bounds[i].top + 14);
        expect(bounds[i].controlWidth).toBeGreaterThan(
          bounds[i].labelWidth * 0.98
        );
        if (i) expect(bounds[i].top).toBeGreaterThan(bounds[i - 1].bottom + 8);
      }
      await noOverflow(page);
      expect(
        await dialog
          .locator('.modal-body')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      ).toBe(true);
      const footer = await dialog.locator('.modal-footer').boundingBox();
      expect(footer.y + footer.height).toBeLessThanOrEqual(height + 1);
    };
    await assertStack();
    await page
      .getByLabel('Continuity notes', { exact: true })
      .fill('Unsaved synthetic review');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await page
      .getByRole('button', { name: 'Add transition', exact: true })
      .first()
      .click();
    await assertStack();
    await page
      .getByLabel('Description', { exact: true })
      .fill('Unsaved transition');
    await page.keyboard.press('Escape');
    expect(await storedProof(page)).toEqual(before);
    await page.goto(`/#/output/${ids.sceneIds[0]}`);
    await page.getByRole('button', { name: /Preflight ·/ }).click();
    const preflight = page.getByRole('dialog');
    await preflight.getByText('Show Evidence', { exact: true }).first().click();
    await noOverflow(page);
    expect(
      await preflight
        .locator('.modal-body')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    ).toBe(true);
    await expect(
      preflight.getByRole('button', { name: 'Close', exact: true })
    ).toBeVisible();
  });
}

test('Preflight keeps Aya/Joy P005, exact expandable evidence, source selection and saved-scene edit copy', async ({
  page,
}) => {
  const ids = await seedStoryboardFixture(page),
    before = await storedProof(page);
  await page.goto(`/#/output/${ids.sceneIds[0]}`);
  const findings = await page.evaluate(async (id) => {
    const db = await import('/src/storage/db.ts'),
      { runScenePreflight } = await import('/src/domain/scenePreflight.ts');
    const s = (await db.getAllSnapshot()).scenes.find((s) => s.id === id);
    return runScenePreflight(s);
  }, ids.sceneIds[0]);
  expect(findings.map((f) => f.ruleId)).toEqual(
    expect.arrayContaining(['P001', 'P004', 'P005'])
  );
  const trigger = page.getByRole('button', { name: /Preflight ·/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Scene Preflight' }),
    cards = dialog.locator('.preflight-finding');
  await expect(cards).toHaveCount(findings.length);
  for (const f of findings) {
    const card = cards.filter({
      has: page.getByText(f.ruleId, { exact: true }),
    });
    await expect(card.locator('details')).not.toHaveAttribute('open', '');
    await card.getByText('Show Evidence', { exact: true }).click();
    expect(await card.locator('blockquote').allTextContents()).toEqual(
      f.evidence.map((e) => e.text || '(empty source)')
    );
  }
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await storedProof(page)).toEqual(before);
  await trigger.click();
  const mismatch = page
    .locator('.preflight-finding')
    .filter({ has: page.getByText('P005', { exact: true }) });
  await mismatch.getByRole('combobox').selectOption('dialogue');
  await mismatch.getByRole('button', { name: 'View source: dialogue' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Preserved source: dialogue' })
  ).toContainText('Joy');
  await page.keyboard.press('Escape');
  await trigger.click();
  await page
    .locator('.preflight-finding')
    .filter({ has: page.getByText('P005', { exact: true }) })
    .getByRole('button', { name: /Edit a Copy:/ })
    .click();
  await expect(page).toHaveURL(/#\/builder\//);
  const after = await storedProof(page);
  expect(after.scenes).toEqual(before.scenes);
  expect(after.assets).toEqual(before.assets);
  expect(after.media).toEqual(before.media);
  expect(after.drafts).toHaveLength(before.drafts.length + 1);
});

test('corrupt video stays recoverable through an explicit preview without browser errors or writes', async ({
  page,
}) => {
  const ids = await seedStoryboardFixture(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(async (id) => {
    const { openDatabase } = await import('/src/storage/db.ts');
    const db = await openDatabase(),
      tx = db.transaction('media', 'readwrite'),
      store = tx.objectStore('media'),
      req = store.get(id);
    req.onsuccess = () =>
      store.put({
        ...req.result,
        blob: new Blob(['corrupted synthetic video'], { type: 'video/webm' }),
        byteSize: 25,
      });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }, ids.mediaId);
  await page.goto(route(ids));
  const before = await storedProof(page),
    card = page.locator('.cw-shot-card').first();
  await expect(card).toContainText('Media file unavailable or corrupted.');
  await card
    .getByRole('button', { name: 'Preview media: Arrival at the station' })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Media file unavailable or corrupted.'
  );
  await page.keyboard.press('Escape');
  expect(await storedProof(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('rejected hover playback is handled and unmount pauses, resets and revokes the original object URL', async ({
  page,
}) => {
  const ids = await seedStoryboardFixture(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(route(ids));
  const video = page.locator('.cw-shot-card').first().locator('video');
  await video.evaluate((v) => {
    v.originalPlay = v.play;
    v.play = () =>
      Promise.reject(
        new DOMException(
          'Synthetic playback policy rejection',
          'NotAllowedError'
        )
      );
  });
  await video.hover();
  await expect(video).toHaveJSProperty('paused', true);
  await page.mouse.move(1, 1);
  await video.evaluate((v) => {
    v.play = v.originalPlay;
  });
  await video.hover();
  await expect
    .poll(() => video.evaluate((v) => v.currentTime > 0 && !v.paused))
    .toBe(true);
  await video.evaluate((v) => {
    window.qaDetachedVideo = v;
    window.qaRevoked = [];
    window.qaOriginalSrc = v.src;
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.qaRevoked.push(url);
      original(url);
    };
  });
  await page.getByRole('tab', { name: 'Characters', exact: true }).click();
  expect(
    await page.evaluate(() => ({
      paused: qaDetachedVideo.paused,
      time: qaDetachedVideo.currentTime,
      revoked: qaRevoked.includes(qaOriginalSrc),
    }))
  ).toEqual({ paused: true, time: 0, revoked: true });
  expect(errors).toEqual([]);
});

test('wardrobe and transition saves change only explicit project metadata, preserving all frozen scenes and media', async ({
  page,
}) => {
  const ids = await seedStoryboardFixture(page);
  await page.goto(route(ids));
  const before = await storedProof(page);
  await page.locator('.cw-continuity-review > summary').click();
  await page
    .getByRole('button', { name: 'Review wardrobe', exact: true })
    .first()
    .click();
  await page
    .getByRole('combobox', { name: 'Intentional change reason', exact: true })
    .selectOption('costume_change');
  await page
    .getByLabel('Continuity notes', { exact: true })
    .fill('Intentional synthetic wardrobe review');
  await page.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Add transition', exact: true })
    .first()
    .click();
  await page
    .getByRole('combobox', { name: 'Type', exact: true })
    .selectOption('match_cut');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Match the doorway silhouette.');
  await page
    .getByRole('button', { name: 'Save transition', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await storedProof(page);
  for (const key of Object.keys(before).filter((k) => k !== 'collections'))
    expect(after[key]).toEqual(before[key]);
  const project = after.collections.find(
    (c) => c.id === ids.collectionId
  ).project;
  expect(project.shots[0]).toMatchObject({
    intentionalWardrobeChange: 'costume_change',
    continuityNotes: 'Intentional synthetic wardrobe review',
  });
  expect(project.transitions[0]).toMatchObject({
    fromShotId: ids.shotIds[0],
    toShotId: ids.shotIds[1],
    type: 'match_cut',
    description: 'Match the doorway silhouette.',
  });
  await page.reload();
  expect((await storedProof(page)).collections).toEqual(after.collections);
});
