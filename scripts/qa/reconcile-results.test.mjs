import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateSummary, renderMarkdown } from './reconcile-results.mjs';

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
