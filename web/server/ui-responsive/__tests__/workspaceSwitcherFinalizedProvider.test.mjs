import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [switcherSource, switcherCss] = await Promise.all([
  readFile(new URL('components/account/WorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.module.css', root), 'utf8'),
]);

test('finalized provider accounts keep workspace finality as the hide signal', () => {
  assert.ok(switcherSource.includes('const providerWorkspace = workspaces.find'));
  assert.ok(switcherSource.includes('className={styles.finalityNote}'));
});

test('customer workspace cards collapse once a finalized provider workspace exists', () => {
  assert.match(switcherCss, /\.section:has\(\.finalityNote\)\s*\{\s*display:\s*none\s*\}/);
});

test('provider onboarding and pending-review content remain available before finality', () => {
  assert.ok(switcherSource.includes("t('workspace.switcher.startEarning')"));
  assert.ok(switcherSource.includes("t('workspace.switcher.reviewHeading')"));
});
