import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  seedMediaInspection,
  openInspectionPicker,
} from './media-inspection-fixture.mjs';
const phase = process.env.MEDIA_INSPECTION_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`media inspection visual evidence ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const ids = await seedMediaInspection(page),
      dir = `qa-results/performance-media/${phase}`;
    await mkdir(dir, { recursive: true });
    const shot = async (name) => {
      if (phase === 'after') {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          )
        ).toBe(true);
      }
      await page.screenshot({ path: `${dir}/${name}-${width}.png` });
    };
    await page.goto(
      `/#/collections/${ids.collectionId}?tab=storyboard&view=list`
    );
    const card = page.locator('.cw-shot-card').first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('video')).toHaveJSProperty('readyState', 4);
    await shot('list');
    await openInspectionPicker(page, ids);
    await shot('picker');
    if (phase === 'after') {
      await page
        .getByRole('button', {
          name: 'Preview media: Image study',
          exact: true,
        })
        .click();
      await expect(page.getByRole('img')).toBeVisible();
      await page.getByRole('button', { name: 'Zoom In' }).click();
      await shot('zoom');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.goto(`/#/output/${ids.sceneIds[0]}`);
      await page.getByRole('tab', { name: /^References/ }).click();
      await page.getByRole('button', { name: 'View All (50)' }).click();
      await shot('gallery');
    }
  });
