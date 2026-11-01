import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sameHelperBody, assertReleaseDestination } from './launcher-release.mjs';
test('only an identical helper body can reuse an existing signature', () => {
  assert(sameHelperBody('safe\n', '\uFEFFsafe\r\n# SIG # Begin signature block\r\nopaque signature'));
  assert(!sameHelperBody('changed\n', 'safe\n# SIG # Begin signature block\nopaque signature'));
});
test('release builds refuse existing or external destinations', () => {
  const root = resolve('.');
  for (const path of [root, resolve(root, 'bridge/dist'), resolve(root, 'qa-results/desktop-bridge-launcher/releases')]) assert.throws(() => assertReleaseDestination(root, path));
  assert.doesNotThrow(() => assertReleaseDestination(root, resolve(root, 'qa-results/desktop-bridge-launcher/releases/new-test-absent-destination')));
});
