import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/services/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderCatalogManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderServicesResponsive.module.css', root), 'utf8'),
]);

test('Provider Services route uses the scoped responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderServicesResponsive.module.css'));
  assert.ok(routeSource.includes('className={styles.servicesJourney}'));
  assert.ok(routeSource.includes('ProviderCatalogManager'));
});

test('Provider Services responsive styles protect narrow layouts and touch targets', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Provider Services form and actions stay usable on narrow phones', () => {
  assert.ok(cssSource.includes('textarea'));
  assert.ok(cssSource.includes(':global(.provider-heading-action)'));
  assert.ok(cssSource.includes(':global(.text-link)'));
  assert.ok(cssSource.includes('width: 100% !important'));
  assert.ok(cssSource.includes('white-space: normal !important'));
});

test('Existing Provider Services lifecycle and reach behavior remain present', () => {
  assert.ok(managerSource.includes("fetch('/api/provider/services'"));
  assert.ok(managerSource.includes("method: editingId ? 'PATCH' : 'POST'"));
  assert.ok(managerSource.includes("void setStatus(item.id, 'active')"));
  assert.ok(managerSource.includes("void setStatus(item.id, 'paused')"));
  assert.ok(managerSource.includes("void setStatus(item.id, 'draft')"));
  assert.ok(managerSource.includes('ProviderServiceReachControl'));
  assert.ok(managerSource.includes('activationState(serviceReady)'));
  assert.ok(managerSource.includes("href=\"/provider/category-requests\""));
});
