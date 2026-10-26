import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;
const bundledChromium = JSON.parse(readFileSync(new URL('../../node_modules/playwright-core/browsers.json', import.meta.url)))
  .browsers.find(browser => browser.name === 'chromium');
const summary = {
  testedCommit: gitSha,
  workingTreeDirty,
  workflowRun: runUrl,
  node: process.version,
  playwright: JSON.parse(readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url))).version,
  browser: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? 'Custom Chromium executable (version not independently reported)'
    : `Chromium ${bundledChromium.browserVersion} (Playwright revision ${bundledChromium.revision})`,
  vitest: null,
  browserSmoke: null,
};

if (existsSync('qa-results/vitest.xml')) {
  const xml = readFileSync('qa-results/vitest.xml', 'utf8');
  const tests = [...xml.matchAll(/<testcase\b/g)].length;
  const failures = [...xml.matchAll(/<failure\b/g)].length;
  const skipped = [...xml.matchAll(/<skipped\b/g)].length;
  summary.vitest = { tests, failures, skipped, passed: tests - failures - skipped };
}
if (existsSync('qa-results/playwright.json')) {
  const result = JSON.parse(readFileSync('qa-results/playwright.json', 'utf8'));
  const cases = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) {
      for (const entry of spec.tests ?? []) {
        cases.push({ name: spec.title, status: entry.status, expectedStatus: entry.expectedStatus,
          skipReason: entry.annotations?.find(annotation => annotation.type === 'skip')?.description ?? null });
      }
    }
    for (const nested of suite.suites ?? []) walk(nested);
  };
  for (const suite of result.suites ?? []) walk(suite);
  if (cases.length > 20) throw new Error('Browser smoke report exceeded its 20-case artifact bound.');
  summary.browserSmoke = {
    tests: result.stats?.expected + result.stats?.unexpected + result.stats?.flaky + result.stats?.skipped,
    passed: result.stats?.expected,
    failed: result.stats?.unexpected,
    flaky: result.stats?.flaky,
    skipped: result.stats?.skipped,
    durationMs: result.stats?.duration,
    cases,
  };
}

mkdirSync('qa-results', { recursive: true });
const summaryJson = `${JSON.stringify(summary, null, 2)}\n`;
if (Buffer.byteLength(summaryJson) > 64 * 1024) throw new Error('Synthetic summary exceeded its 64 KiB artifact bound.');
writeFileSync('qa-results/summary.json', summaryJson);
const lines = [
  '### Synthetic CI evidence',
  `Tested commit: \`${gitSha}\``,
  `Working tree dirty: ${workingTreeDirty}`,
  `Workflow run: ${runUrl ?? 'local'}`,
  `Node: ${process.version}; Playwright: ${summary.playwright}; browser: ${summary.browser}`,
  `Vitest: ${JSON.stringify(summary.vitest ?? 'report unavailable')}`,
  `Browser smoke: ${JSON.stringify(summary.browserSmoke ?? 'report unavailable')}`,
];
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n\n')}\n`);
} else {
  process.stdout.write(`${lines.join('\n')}\n`);
}
