import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/setup/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderSetupManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderSetupResponsive.module.css', root), 'utf8'),
]);

test('Provider Setup route uses the scoped responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderSetupResponsive.module.css'));
  assert.ok(routeSource.includes('className={styles.setupJourney}'));
  assert.ok(routeSource.includes('ProviderSetupManager'));
});

test('Provider Setup responsive styles protect narrow layouts and touch targets', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('grid-template-columns: minmax(0, 1fr)'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Provider Setup launch controls stay usable on phones', () => {
  assert.ok(cssSource.includes(':global(.section-heading)'));
  assert.ok(cssSource.includes(':global(.provider-profile-grid)'));
  assert.ok(cssSource.includes(':global(.summary-note)'));
  assert.ok(cssSource.includes(':global(.text-link)'));
  assert.ok(cssSource.includes('width: 100%'));
});

test('Existing Provider Setup readiness and controlled-launch semantics remain present', () => {
  assert.ok(managerSource.includes("fetch('/api/provider/setup'"));
  assert.ok(managerSource.includes("method: 'POST'"));
  assert.ok(managerSource.includes("method: 'DELETE'"));
  assert.ok(managerSource.includes('marketplace_disclosure_complete'));
  assert.ok(managerSource.includes('trust_status'));
  assert.ok(managerSource.includes('Approve category & location'));
  assert.ok(managerSource.includes('Request platform approval'));
  assert.ok(managerSource.includes('Withdraw request'));
  assert.ok(managerSource.includes("href=\"/provider/services\""));
});
