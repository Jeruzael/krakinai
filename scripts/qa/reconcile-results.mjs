#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputDir = join(root, 'docs', 'qa');
const summaryFile = join(outputDir, 'phase5-summary.json');
const markdownFile = join(outputDir, 'phase5-summary.md');
const sourceRuns = [
  ['A', 'main', 'stage-a-browser-results.json', 36],
  ['A', 'two-tab', 'stage-a-multitab-results.json', 5],
  ['B', 'main', 'stage-b-browser-results.json', 46],
  ['C', 'final', 'stage-c-browser-results.json', 59],
  ['D', 'main-and-consolidated-followup', 'stage-d-browser-results.json', 61],
  ['D', 'followup-detail', 'stage-d-ui-refresh-results.json', 13],
];
const stageCommits = {
  baseline: '50492d719134c49137feb56d36dc5a775ff219c2',
  A: 'e072e909717e6ce53efd761afd3d2615b6edbe26',
  B: 'd1a98e7f990cdbcfb918611f7a7d4f3a1b0fce37',
  C: '4e3ebe85a7adbd1f8599d321dd980ac7cd99a18d',
  D: 'cb29312554687e48ca4ec880fd505719abbd10a1',
};
const expectedShots = { baseline: 9, A: 9, B: 6, C: 12, D: 9 };
const fail = (message) => { throw new Error(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safeName = (path) => {
  if (typeof path !== 'string') fail('Invalid screenshot path');
  const name = basename(path.replaceAll('\\', '/'));
  if (!/^(before|stage-[abcd])-[a-z0-9-]+\.png$/.test(name)) fail(`Unexpected screenshot name: ${name}`);
  return name;
};

export function validateSummary(summary) {
  if (summary.schema !== 'krakinai.phase5-qa-ledger.v1') fail('Wrong ledger schema');
  if (!Array.isArray(summary.runs) || summary.runs.length !== sourceRuns.length) fail('Missing runs');
  const ids = new Set();
  const stageCounts = { A: 0, B: 0, C: 0, D: 0 };
  let followupCount = 0;
  for (let i = 0; i < sourceRuns.length; i++) {
    const [stage, run, file, expected] = sourceRuns[i];
    const item = summary.runs[i];
    if (item.stage !== stage || item.run !== run || item.source !== file || !/^[0-9a-f]{64}$/.test(item.sourceSha256)) fail(`Bad source provenance: ${file}`);
    if (item.claimedStageCommit !== stageCommits[stage]) fail(`Bad stage commit claim: ${file}`);
    if (!Array.isArray(item.checks) || item.checks.length !== expected) fail(`Wrong check count: ${file}`);
    item.checks.forEach((check, index) => {
      const id = `${stage}/${run}/${String(index + 1).padStart(3, '0')}`;
      if (check.id !== id || ids.has(id)) fail(`Duplicate or invalid check ID: ${id}`);
      ids.add(id);
      if (typeof check.name !== 'string' || !check.name.trim() || check.passed !== true) fail(`Failed or invalid check: ${id}`);
    });
    if (run === 'followup-detail') followupCount += item.checks.length;
    else stageCounts[stage] += item.checks.length;
  }
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  if (JSON.stringify(stageCounts) !== JSON.stringify({ A: 41, B: 46, C: 59, D: 61 }) || total !== 207 || followupCount !== 13) fail('Canonical counts changed');
  if (JSON.stringify(summary.counts) !== JSON.stringify({ stages: stageCounts, canonicalChecks: total, followupDetailChecksExcluded: followupCount })) fail('Summary count mismatch');
  if (!Array.isArray(summary.screenshots) || summary.screenshots.length !== 45) fail('Wrong screenshot count');
  const shotNames = new Set();
  const shotCounts = { baseline: 0, A: 0, B: 0, C: 0, D: 0 };
  const shotSources = { baseline: 'before-results.json', A: 'stage-a-browser-results.json', B: 'stage-b-browser-results.json', C: 'stage-c-browser-results.json', D: 'stage-d-browser-results.json' };
  for (const shot of summary.screenshots) {
    if (!Object.hasOwn(shotCounts, shot.stage) || shotNames.has(shot.file) || safeName(shot.file) !== shot.file || shot.sourceResults !== shotSources[shot.stage] || shot.claimedStageCommit !== stageCommits[shot.stage] || !Number.isSafeInteger(shot.bytes) || shot.bytes <= 0 || !/^[0-9a-f]{64}$/.test(shot.sha256)) fail(`Invalid screenshot: ${shot.file}`);
    shotNames.add(shot.file);
    shotCounts[shot.stage]++;
  }
  if (JSON.stringify(shotCounts) !== JSON.stringify(expectedShots)) fail('Screenshot group counts changed');
  if (summary.screenshotCount !== 45) fail('Screenshot total mismatch');
  return summary;
}

export function buildSummary(evidenceDir) {
  const reads = new Map();
  const read = (name) => {
    const bytes = readFileSync(join(evidenceDir, name));
    const data = JSON.parse(bytes.toString('utf8'));
    reads.set(name, { data, hash: sha256(bytes) });
    return data;
  };
  const baseline = read('before-results.json');
  const runs = sourceRuns.map(([stage, run, source, expected]) => {
    const data = read(source);
    if (!Array.isArray(data.checks) || data.checks.length !== expected) fail(`Unexpected raw check count: ${source}`);
    if (Array.isArray(data.failures) && data.failures.length || Array.isArray(data.errors) && data.errors.length) fail(`Raw failures/errors: ${source}`);
    const names = new Map();
    for (const check of data.checks) {
      if (typeof check.name !== 'string' || !check.name.trim() || check.passed !== true) fail(`Failed or invalid raw check: ${source}`);
      if (names.has(check.name)) fail(`Duplicate check name within run: ${source}: ${check.name}`);
      names.set(check.name, check.passed);
    }
    return {
      stage, run, source, sourceSha256: reads.get(source).hash,
      claimedStageCommit: stageCommits[stage],
      checks: data.checks.map((check, index) => ({
        id: `${stage}/${run}/${String(index + 1).padStart(3, '0')}`,
        name: check.name,
        passed: check.passed,
      })),
    };
  });
  const mainD = reads.get('stage-d-browser-results.json').data;
  if (mainD.followup?.checks !== 13 || mainD.followup?.results !== 'stage-d-ui-refresh-results.json' || mainD.checks.at(-1)?.name !== 'Friendly association labels after UI update') fail('Stage D consolidated follow-up changed');
  const followupShots = reads.get('stage-d-ui-refresh-results.json').data.screenshots?.map(safeName);
  const mainShots = mainD.screenshots?.map(safeName);
  if (JSON.stringify(followupShots) !== JSON.stringify(mainShots)) fail('Stage D final screenshot provenance disagrees');
  const screenshots = [];
  const groups = [['baseline', 'before-results.json', baseline.screenshots], ...sourceRuns.filter(([, run]) => run !== 'two-tab' && run !== 'followup-detail').map(([stage, , source]) => [stage, source, reads.get(source).data.screenshots])];
  for (const [stage, sourceResults, paths] of groups) {
    if (!Array.isArray(paths)) fail(`Missing screenshots: ${stage}`);
    for (const path of paths) {
      const file = safeName(path);
      const bytes = readFileSync(join(evidenceDir, file));
      if (!statSync(join(evidenceDir, file)).isFile() || bytes.length === 0) fail(`Empty screenshot: ${file}`);
      screenshots.push({ stage, sourceResults, claimedStageCommit: stageCommits[stage], file, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  const counts = { stages: { A: 41, B: 46, C: 59, D: 61 }, canonicalChecks: 207, followupDetailChecksExcluded: 13 };
  const summary = {
    schema: 'krakinai.phase5-qa-ledger.v1',
    provenance: {
      scope: 'Local isolated Chromium results; not reproduced by GitHub CI',
      sourceDirectory: 'External private Phase 5 evidence directory; supply with --evidence to regenerate',
      baselineSource: 'before-results.json',
      baselineSourceSha256: reads.get('before-results.json').hash,
      commitBinding: 'Stage commits are report claims. The raw JSON and PNG files contain no embedded Git SHA, so cryptographic binding to those commits cannot be established retrospectively.',
      stageC56: 'Earlier Stage C documentation reports 56. Retained final JSON has 59. No 56-check intermediate machine-readable result is available for a direct three-check diff.',
    },
    runs, counts, screenshots, screenshotCount: screenshots.length,
  };
  return validateSummary(summary);
}

export function renderMarkdown(summary) {
  validateSummary(summary);
  const rows = Object.entries(summary.counts.stages).map(([stage, count]) => `| ${stage} | ${count} |`).join('\n');
  return `# Phase 5 browser QA reconciliation\n\nCanonical local result: **207 counted checks passed** across Stages A–D. These are isolated Chromium runs, not GitHub CI checks.\n\n| Stage | Counted checks |\n| --- | ---: |\n${rows}\n\nStage A is 36 main checks plus five separate two-tab checks. The QA task brief cited an earlier Stage C count of 56; the current Stage C document and retained final machine-readable run record 59. The 56-check intermediate JSON is not available, so the exact three additions cannot be established by a direct diff. Stage D's 61 comprises 60 main checks and one consolidated label follow-up; its 13 granular follow-up assertions are recorded in the ledger and excluded from the 207 total.\n\n**Screenshots:** 45 nonempty PNGs: nine baseline, nine A, six B, twelve C, nine D. The [JSON ledger](phase5-summary.json) lists every check name and screenshot filename, byte count and SHA-256, plus SHA-256 for each raw result JSON. The raw files and screenshots remain outside Git. Raw screenshots and result JSON contain no embedded Git commit SHA; reported stage commit associations are historical claims rather than cryptographic proof.\n\nHistorical runs were not all clean. Stage C had an asynchronous navigation wait increased to five seconds after a load-sensitive timeout; the final 270-test suite passed with 22 React \`act(...)\` warnings. Stage D had interim 297, 306 and 308-test passes and transient fixture type errors before the final 309-test pass, also with 22 React \`act(...)\` warnings. The warnings and interim outcomes are not counted as browser assertion failures.\n\nRegenerate from the retained local evidence with \`node scripts/qa/reconcile-results.mjs --evidence <directory>\`. Validate this committed, sanitized ledger without local evidence with \`node scripts/qa/reconcile-results.mjs --check\`.\n`;
}

function main(args) {
  if (args.length === 1 && args[0] === '--check') {
    const summary = validateSummary(JSON.parse(readFileSync(summaryFile, 'utf8')));
    if (readFileSync(markdownFile, 'utf8') !== renderMarkdown(summary)) fail('Markdown differs from JSON ledger');
    console.log(`QA ledger valid: ${summary.counts.canonicalChecks} counted checks, ${summary.screenshotCount} screenshots`);
    return;
  }
  if (args.length !== 2 || args[0] !== '--evidence') fail('Usage: node scripts/qa/reconcile-results.mjs --evidence <directory> | --check');
  const summary = buildSummary(resolve(args[1]));
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(markdownFile, renderMarkdown(summary));
  console.log(`Wrote QA ledger: ${summary.counts.canonicalChecks} counted checks, ${summary.screenshotCount} screenshots`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
