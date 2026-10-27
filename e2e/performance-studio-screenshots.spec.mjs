import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  seedDialogueCoverFixture,
  openDialogue,
} from './dialogue-cover-fixture.mjs';
const phase = process.env.PERFORMANCE_STUDIO_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
]) {
  test(`Performance Studio ${phase} visual evidence ${width}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const ids = await seedDialogueCoverFixture(page);
    await openDialogue(page, ids);
    await page
      .locator('.performance-direction')
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      )
      .toBe(true);
    await mkdir(`qa-results/performance-studio/${phase}`, { recursive: true });
    await page.screenshot({
      path: `qa-results/performance-studio/${phase}/studio-${width}.png`,
    });
    if (phase === 'after') {
      const capture = async (name) => {
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1
            )
          )
          .toBe(true);
        await page.screenshot({
          path: `qa-results/performance-studio/${phase}/${name}-${width}.png`,
        });
      };
      const open = (name) =>
        page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
      await open('Emotions');
      await page
        .getByRole('combobox', { name: 'Primary emotion' })
        .selectOption('angry');
      await page
        .getByRole('combobox', { name: 'Secondary emotion' })
        .selectOption('sad');
      await page
        .getByRole('combobox', { name: 'Emotional intensity' })
        .selectOption('strong');
      await page
        .getByRole('region', { name: 'Emotions', exact: true })
        .scrollIntoViewIfNeeded();
      await capture('emotions');
      await open('Voice Characteristics');
      await page
        .getByRole('combobox', { name: 'Vocal tone' })
        .selectOption('stern');
      await page
        .getByRole('combobox', { name: 'Relative pitch' })
        .selectOption('mid');
      await page
        .getByRole('region', { name: 'Voice Characteristics', exact: true })
        .scrollIntoViewIfNeeded();
      await capture('voice');
      await open('Delivery Technique');
      await page
        .getByRole('checkbox', { name: 'Whispered', exact: true })
        .check();
      await page
        .getByRole('region', { name: 'Delivery Technique', exact: true })
        .scrollIntoViewIfNeeded();
      await capture('techniques');
      await open('Custom Instructions');
      const longText =
        '  “Sandali—wait!”😊景色'.repeat(40) + '\nHuwag baguhin.  ';
      await page
        .getByRole('textbox', { name: 'Custom Notes', exact: true })
        .fill(longText);
      await page.locator('.performance-preview > summary').click();
      await expect(page.getByTestId('delivery-preview')).toContainText(
        longText
      );
      await page.getByTestId('delivery-preview').scrollIntoViewIfNeeded();
      await capture('unicode-preview');
      if (width === 1440) {
        // 200% browser zoom presents 720 CSS pixels for a 1440px physical viewport.
        // Test reflow at that equivalent CSS viewport; this is not a browser chrome zoom action.
        await page.setViewportSize({ width: 720, height: 450 });
        await expect.poll(() => page.locator('.app-sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
        await page.locator('.performance-direction').scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1
            )
          )
          .toBe(true);
        await page.screenshot({
          path: 'qa-results/performance-studio/after/reflow-200-percent.png',
        });
      }
    }
  });
}
