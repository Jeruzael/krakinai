export function summarizeBrowserSmoke(result) {
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
  // Allow the expanded UI suite while retaining a finite count bound. The
  // caller also enforces the unchanged 64 KiB limit on the complete artifact.
  if (cases.length > 512) throw new Error('Browser smoke report exceeded its 512-case artifact bound.');
  return {
    tests: result.stats?.expected + result.stats?.unexpected + result.stats?.flaky + result.stats?.skipped,
    passed: result.stats?.expected,
    failed: result.stats?.unexpected,
    flaky: result.stats?.flaky,
    skipped: result.stats?.skipped,
    durationMs: result.stats?.duration,
    cases,
  };
}
