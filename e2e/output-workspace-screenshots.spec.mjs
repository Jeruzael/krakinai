import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  seedOutputWorkspace,
  outputBaseline,
} from './output-workspace-fixture.mjs';
const phase = process.env.OUTPUT_WORKSPACE_PHASE ?? 'after';
for (const [width, height] of [
  [1440, 900],
  [768, 1024],
  [390, 844],
])
  test(`output workspace ${phase} screenshots ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    const ids = await seedOutputWorkspace(page);
    await page.goto('/#/output/' + ids.sceneId);
    await expect(
      page.getByRole('heading', {
        name: 'Synthetic Scene — Café',
        exact: true,
        level: 1,
      })
    ).toBeVisible();
    const root = `qa-results/output-workspace/${phase}`;
    await mkdir(root, { recursive: true });
    if (phase === 'before') {
      // Never relabel the redesigned UI as the historical baseline.
      execFileSync('git', [
        'diff',
        '--quiet',
        '10aaa84877c4b182c42ef3fd395173dbaa823223',
        '--',
        'src/screens/PromptOutputScreen.tsx',
        'src/screens/promptOutput.css',
        'src/components/FormattedPrompt.tsx',
        'src/domain/promptAssembler.ts',
        'src/domain/sceneDocument.ts',
        'src/domain/generationDocument.ts',
        'src/domain/exportPresets.ts',
      ]);
      await page.screenshot({ path: `${root}/output-${width}.png` });
      if (width === 1440) {
        await mkdir('e2e/fixtures', { recursive: true });
        await writeFile(
          'e2e/fixtures/output-workspace-baseline.json',
          JSON.stringify(
            {
              baselineCommit: '10aaa84877c4b182c42ef3fd395173dbaa823223',
              draft: await outputBaseline(page, ids.draftId),
              saved: await outputBaseline(page, ids.sceneId),
            },
            null,
            2
          ) + '\n'
        );
      }
      return;
    }
    const capture = async (name) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1
        )
      ).toBe(true);
      await page.screenshot({ path: `${root}/${name}-${width}.png` });
    };
    await page
      .getByLabel('Workspace Layout', { exact: true })
      .selectOption('split');
    if (width === 1440)
      await expect(
        page.getByRole('button', { name: 'Show Prompt', exact: true })
      ).toBeInViewport();
    if (width === 1440) {
      const button = page.getByRole('button', {
        name: 'Show Prompt',
        exact: true,
      });
      expect(
        await button.evaluate((el) => el.getBoundingClientRect().bottom)
      ).toBeLessThanOrEqual(
        await page
          .getByRole('tabpanel', { name: 'Prompt', exact: true })
          .evaluate((el) => el.getBoundingClientRect().bottom - 8)
      );
    }
    await capture('split');
    await page
      .getByRole('button', { name: 'Show Prompt', exact: true })
      .click();
    await capture('viewer-formatted');
    await page.getByRole('button', { name: 'Raw', exact: true }).click();
    await capture('viewer-raw');
    await page.keyboard.press('Escape');
    await page
      .getByLabel('Workspace Layout', { exact: true })
      .selectOption('tabs');
    await capture('studio-configuration');
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    await capture('studio-preview');
    await page.getByRole('tab', { name: 'Sections', exact: true }).click();
    await capture('studio-sections');
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await capture('studio-tools');
    if (width < 1024)
      await page.screenshot({
        path: `${root}/studio-full-${width}.png`,
        fullPage: true,
      });
    await page.goto('/#/output/' + ids.draftId);
    await page.getByRole('tab', { name: 'Configuration', exact: true }).click();
    await capture('draft');
    await page.getByRole('tab', { name: 'Project JSON', exact: true }).click();
    await page
      .getByRole('button', { name: 'Show Prompt', exact: true })
      .click();
    await capture('viewer-json');
    await page.keyboard.press('Escape');
    await page.evaluate(async (id) => {
      const db = await import('/src/storage/db.ts'),
        s = await db.getAllSnapshot(),
        draft = s.drafts.find((d) => d.id === id);
      for (const slot of Object.values(draft.slots)) slot.mediaLinks = [];
      await db.replaceAllStoresTransactionally(s);
    }, ids.draftId);
    await page.reload();
    await page
      .getByLabel('Workspace Layout', { exact: true })
      .selectOption('split');
    await capture('missing-media');
    await page.evaluate(async (id) => {
      const db = await import('/src/storage/db.ts'),
        draft = (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
      await db.saveSceneDraft({
        ...draft,
        manualOutputs: {
          structured: {
            text: '  A preserved older manual output.\n“Sandali—wait!” 😊  ',
            basedOnInputRevision: 0,
            updatedAt: '2026-10-27T00:00:00.000Z',
          },
        },
        bumpInputRevision: false,
      });
    }, ids.draftId);
    await page.reload();
    await capture('stale-override');
    await page.evaluate(async (id) => {
      const db = await import('/src/storage/db.ts'),
        draft = (await db.getAllSnapshot()).drafts.find((d) => d.id === id);
      await db.saveSceneDraft({
        ...draft,
        manualOutputs: {
          structured: {
            text: '  Very long preserved prompt.\n“Sandali—wait!” 😊 雨  '.repeat(
              1200
            ),
            basedOnInputRevision: draft.inputRevision,
            updatedAt: '2026-10-28T00:00:00.000Z',
          },
        },
        bumpInputRevision: false,
      });
    }, ids.draftId);
    await page.reload();
    await page
      .getByRole('button', { name: 'Show Prompt', exact: true })
      .click();
    await page.getByRole('button', { name: 'Raw', exact: true }).click();
    await capture('long-prompt');
  });
