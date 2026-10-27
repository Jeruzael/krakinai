import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedStoryboardFixture } from './storyboard-fixture.mjs';

const phase = process.env.STORYBOARD_SCREENSHOT_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
]) {
  test(`storyboard visual evidence ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const ids = await seedStoryboardFixture(page);
    const directory = `qa-results/storyboard-cleanup/${phase}`;
    await mkdir(directory, { recursive: true });
    const shot = async (name) => {
      if (phase === 'after') {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          ),
          name
        ).toBe(true);
        for (const el of await page.getByRole('dialog').all()) {
          expect(
            await el.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            name
          ).toBe(true);
          expect(
            await el
              .locator('.modal-body')
              .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            name
          ).toBe(true);
        }
      }
      await page.screenshot({ path: `${directory}/${name}-${width}.png` });
    };
    await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
    const cards = page.locator('.cw-shot-card');
    await expect(cards).toHaveCount(11);
    await cards.first().scrollIntoViewIfNeeded();
    await expect(cards.first().locator('video')).toHaveJSProperty(
      'readyState',
      4
    );
    await shot('storyboard');
    await page.locator('.cw-continuity-review > summary').click();
    await page
      .getByRole('heading', { name: 'Wardrobe continuity', exact: true })
      .evaluate(element=>element.scrollIntoView({block:'start'}));
    await shot('continuity');
    await page
      .getByRole('button', { name: 'Review wardrobe', exact: true })
      .first()
      .click();
    await shot('wardrobe');
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Add transition', exact: true })
      .first()
      .click();
    await shot('transition');
    await page.keyboard.press('Escape');
    await page.goto(`/#/output/${ids.sceneIds[0]}`);
    await page.getByRole('button', { name: /Preflight ·/ }).click();
    await expect(
      page.getByRole('dialog', { name: 'Scene Preflight' })
    ).toBeVisible();
    await shot('preflight');
  });
}
