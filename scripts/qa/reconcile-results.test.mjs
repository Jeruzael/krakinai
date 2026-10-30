import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateSummary, renderMarkdown } from './reconcile-results.mjs';
import { summarizeBrowserSmoke } from './ci-browser-summary.mjs';

const summaryPath = fileURLToPath(new URL('../../docs/qa/phase5-summary.json', import.meta.url));
const getSummary = () => JSON.parse(readFileSync(summaryPath, 'utf8'));

test('committed ledger counts unique canonical checks and excludes follow-up detail', () => {
  const summary = validateSummary(getSummary());
  assert.equal(summary.counts.canonicalChecks, 207);
  assert.equal(summary.counts.followupDetailChecksExcluded, 13);
  assert.equal(summary.screenshotCount, 45);
  assert.match(renderMarkdown(summary), /207 counted checks passed/);
});

test('duplicate check identities fail validation', () => {
  const summary = getSummary();
  summary.runs[0].checks[1].id = summary.runs[0].checks[0].id;
  assert.throws(() => validateSummary(summary), /Duplicate or invalid check ID/);
});

test('contradictory result and screenshot count fail validation', () => {
  const failed = getSummary();
  failed.runs[2].checks[0].passed = false;
  assert.throws(() => validateSummary(failed), /Failed or invalid check/);
  const missing = getSummary();
  missing.screenshots.pop();
  assert.throws(() => validateSummary(missing), /Wrong screenshot count/);
});

const browserReport = count => ({
  stats: { expected: count - 3, unexpected: 1, flaky: 1, skipped: 1, duration: 1000 },
  suites: [{ suites: [{ specs: Array.from({ length: count }, (_, index) => ({
    title: `Synthetic browser case ${index + 1}`,
    tests: [{ status: ['skipped', 'unexpected', 'flaky'][index] ?? 'expected',
      expectedStatus: index === 0 ? 'skipped' : 'passed',
      annotations: index === 0 ? [{ type: 'skip', description: 'Synthetic skip evidence' }] : [] }],
  })) }] }],
});

test('CI summary retains every case in the expanded 72-case browser report', () => {
  const summary = summarizeBrowserSmoke(browserReport(72));
  assert.equal(summary.tests, 72);
  assert.equal(summary.passed, 69);
  assert.equal(summary.failed, 1);
  assert.equal(summary.flaky, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.cases.length, 72);
  assert.equal(summary.cases[0].skipReason, 'Synthetic skip evidence');
  assert.equal(summary.cases[1].status, 'unexpected');
  assert.equal(summary.cases[2].status, 'flaky');
  assert.equal(summary.cases[71].name, 'Synthetic browser case 72');
});

test('CI summary retains all cases from the previous 128-case suite bound', () => {
  assert.equal(summarizeBrowserSmoke(browserReport(128)).cases.length, 128);
});

test('CI summary retains all 135 Stage B browser cases without losing outcome evidence', () => {
  const summary = summarizeBrowserSmoke(browserReport(135));
  assert.equal(summary.tests, 135);
  assert.equal(summary.passed, 132);
  assert.equal(summary.cases.length, 135);
  assert.equal(summary.cases[134].name, 'Synthetic browser case 135');
  assert.equal(summary.failed, 1);
  assert.equal(summary.flaky, 1);
  assert.equal(summary.skipped, 1);
});

test('CI summary retains all cases at its finite 512-case bound', () => {
  assert.equal(summarizeBrowserSmoke(browserReport(512)).cases.length, 512);
});

test('CI summary rejects oversized case counts rather than silently truncating', () => {
  assert.throws(() => summarizeBrowserSmoke(browserReport(513)), /512-case artifact bound/);
});
