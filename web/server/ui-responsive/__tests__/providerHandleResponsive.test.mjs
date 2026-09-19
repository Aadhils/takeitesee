import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, entrySource, centerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/handle/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardHandleCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardHandleCenter.module.css', root), 'utf8'),
]);

test('legacy Provider Handle route returns to the Dashboard handle section', () => {
  assert.ok(routeSource.includes("redirect('/provider#provider-handle')"));
});

test('Provider Dashboard owns compact public handle controls', () => {
  assert.ok(entrySource.includes('ProviderDashboardHandleCenter'));
  assert.ok(centerSource.includes('id="provider-handle"'));
  assert.ok(centerSource.includes("t('provider.handle.title')"));
  assert.ok(centerSource.includes("t('provider.handle.change')"));
});

test('Dashboard handle workflow preserves the existing Provider handle API contract', () => {
  assert.ok(centerSource.includes("fetch('/api/identity-handle?context=provider'"));
  assert.ok(centerSource.includes("method: 'PATCH'"));
  assert.ok(centerSource.includes('public_profile_ready'));
  assert.ok(centerSource.includes('readiness_href'));
  assert.ok(centerSource.includes('https://www.takeitesee.com/@${handle}'));
  assert.ok(centerSource.includes('navigator.clipboard.writeText(publicUrl)'));
});

test('Dashboard handle controls remain phone and tablet safe', () => {
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});
