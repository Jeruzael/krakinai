import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  seedDialogueCoverFixture,
  openDialogue,
  openCoverPicker,
} from './dialogue-cover-fixture.mjs';
const phase = process.env.DIALOGUE_COVER_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`dialogue and cover visual evidence ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const ids = await seedDialogueCoverFixture(page);
    const dir = `qa-results/dialogue-cover/${phase}`;
    await mkdir(dir, { recursive: true });
    const capture = async (name) => {
      if (name.startsWith('cover'))
        await expect
          .poll(() =>
            page
              .getByRole('dialog')
              .locator('img')
              .first()
              .evaluate((img) => img.complete && img.naturalWidth > 0)
          )
          .toBe(true);
      if (phase === 'after') {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          ),
          name
        ).toBe(true);
        const dialog = page.getByRole('dialog');
        if (await dialog.count()) {
          expect(
            await dialog
              .locator('.modal-body')
              .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            name
          ).toBe(true);
          const footer = await dialog.locator('.modal-footer').boundingBox();
          expect(footer.y + footer.height).toBeLessThanOrEqual(height + 1);
        }
      }
      await page.screenshot({ path: `${dir}/${name}-${width}.png` });
    };
    await openDialogue(page, ids);
    if (phase === 'after') {
      for (const name of ['Angry', 'Energetic', 'Lecturing'])
        await page.getByRole('checkbox', { name, exact: true }).check();
      await page
        .getByRole('combobox', { name: 'Speaking Pace', exact: true })
        .selectOption('fast');
      await page
        .getByRole('combobox', { name: 'Body Language', exact: true })
        .selectOption('strong_pointing');
      await page
        .locator('.performance-direction')
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await capture('performance');
      await page.locator('.performance-preview > summary').click();
      await page.getByTestId('delivery-preview').scrollIntoViewIfNeeded();
      await capture('custom-preview');
    } else {
      await page
        .getByLabel('Delivery Notes (Optional)')
        .scrollIntoViewIfNeeded();
      await capture('performance');
    }
    await openCoverPicker(page, ids);
    if (phase === 'after') {
      await capture('cover-project');
      const active = page.getByRole('tab', { name: /Project Media/ });
      await active.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { name: /All Images/ })).toBeFocused();
      await page
        .getByRole('searchbox', { name: 'Search cover images' })
        .fill('景色');
      await capture('cover-search');
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('dialog', { name: 'Edit Project Details' })
      ).toBeVisible();
    } else {
      await capture('cover-project');
    }
  });
