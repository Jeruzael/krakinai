import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedPolishFixture } from './uiux-fixture.mjs';
const phase = process.env.QA_SCREENSHOT_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`polish visual evidence ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const ids = await seedPolishFixture(page),
      dir = `qa-results/uiux-polish/${phase}`;
    await mkdir(dir, { recursive: true });
    const shot = async (name) => {
      if (phase === 'after') {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          ),
          `${name}: document overflow`
        ).toBe(true);
        const dialog = page.getByRole('dialog');
        if (await dialog.count()) {
          expect(
            await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            `${name}: dialog overflow`
          ).toBe(true);
          expect(
            await dialog
              .locator('.modal-body')
              .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            `${name}: body overflow`
          ).toBe(true);
        }
      }
      await page.screenshot({
        path: `${dir}/${name}-${width}.png`,
        fullPage: false,
      });
    };
    await page.goto(`/#/prompts/${ids.characterId}/edit`);
    await expect(page.getByLabel('Title *', { exact: true })).toBeVisible();
    await shot('editor');
    const metadata = page.getByText('Rename / Details', { exact: true });
    if (await metadata.count()) await metadata.first().click();
    await page
      .getByLabel('Original Filename', { exact: true })
      .first()
      .scrollIntoViewIfNeeded();
    await shot('media-metadata');
    await page.goto(`/#/variants/${ids.variantId}/edit`);
    await expect(page.getByLabel('Title *', { exact: true })).toBeVisible();
    await shot('variant');
    await page.goto('/#/library');
    await expect(
      page.getByRole('heading', { name: 'All Prompts', exact: true })
    ).toBeVisible();
    await shot('library');
    if (phase === 'after') {
      await page
        .getByRole('group', { name: 'Tag filters' })
        .getByRole('button', { name: /more tags/ })
        .click();
      await shot('tag-picker');
      await page.keyboard.press('Escape');
    }
    await page.goto(`/#/prompts/${ids.characterId}`);
    await page.locator('.identity-anchor-panel > summary').click();
    await page.getByLabel('Identity Anchor text').scrollIntoViewIfNeeded();
    await shot('identity-anchor');
    await page.goto(`/#/output/${ids.draftId}`);
    await page
      .getByLabel('Character Identity Source', { exact: true })
      .scrollIntoViewIfNeeded();
    await shot('generation-identity');
    await page.getByRole('tab', { name: 'References', exact: true }).click();
    await page
      .getByRole('button', { name: 'Manage Reference Pack', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Reference Pack Manager' })
    ).toBeVisible();
    await shot('reference-pack');
    await page.keyboard.press('Escape');
    await page.goto(`/#/collections/${ids.collectionId}?tab=storyboard`);
    await page
      .getByRole('button', { name: /Manage takes/i })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: /Takes for/ })).toBeVisible();
    await shot('takes');
    await page
      .getByRole('button', { name: 'Compare takes', exact: true })
      .click();
    await shot('take-compare');
  });
