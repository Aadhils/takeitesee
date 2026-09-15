import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [centerSource, cssSource, entrySource, managerSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardLaunchCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardLaunchCenter.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
]);

test('Provider Dashboard owns the first-service marketplace launch journey', () => {
  assert.ok(entrySource.includes('ProviderDashboardLaunchCenter'));
  assert.ok(centerSource.includes('id="provider-marketplace-launch"'));
  assert.ok(centerSource.includes("fetch('/api/provider/services'"));
  assert.ok(centerSource.includes("fetch('/api/provider/setup'"));
  assert.ok(centerSource.includes("method: 'POST'"));
  assert.ok(centerSource.includes("status: 'draft'"));
});

test('Dashboard launch center preserves controlled approval and activation contracts', () => {
  assert.ok(centerSource.includes('application_id: category.application_id'));
  assert.ok(centerSource.includes('category_id: category.id'));
  assert.ok(centerSource.includes('location_id: locationId'));
  assert.ok(centerSource.includes("body: JSON.stringify({ status: 'active' })"));
  assert.ok(centerSource.includes("method: 'DELETE'"));
  assert.ok(centerSource.includes('marketplace_disclosure_complete'));
  assert.ok(centerSource.includes("trust_status === 'normal'"));
});

test('Provider Dashboard refreshes summary data after service workflow changes', () => {
  assert.ok(centerSource.includes("new Event('provider-services-refresh')"));
  assert.ok(entrySource.includes("window.addEventListener('provider-services-refresh'"));
  assert.ok(entrySource.includes('workspaceVersion={workspaceVersion}'));
  assert.ok(managerSource.includes('useEffect(() => { void load(); }, [load, workspaceVersion])'));
  assert.ok(!entrySource.includes('<ProviderDashboardManager key={workspaceVersion}'));
});

test('Marketplace launch center stays compact and phone safe', () => {
  assert.ok(cssSource.includes('grid-template-columns: repeat(4'));
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('@media (max-width: 440px)'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});