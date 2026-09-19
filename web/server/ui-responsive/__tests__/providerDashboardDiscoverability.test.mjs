import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [entrySource, discoverabilitySource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderOfferingDiscoverabilityStatus.tsx', root), 'utf8'),
]);

test('Provider Dashboard surfaces real customer discoverability verification', () => {
  assert.ok(entrySource.includes('ProviderOfferingDiscoverabilityStatus'));
  assert.ok(entrySource.includes('mode="services"'));
  assert.ok(entrySource.includes('key={`discoverability-${workspaceVersion}`}'));
  assert.ok(discoverabilitySource.includes('/api/marketplace/services/reachability'));
});

test('discoverability verifies both public visibility and customer search reachability', () => {
  assert.ok(discoverabilitySource.includes('public_discoverable'));
  assert.ok(discoverabilitySource.includes("t('provider.discoverability.searchReachable')"));
  assert.ok(discoverabilitySource.includes("t('provider.discoverability.viewPublic')"));
  assert.ok(discoverabilitySource.includes("t('provider.discoverability.findServiceSearch')"));
});

test('discoverability check remains read-only and preserves catalog state', () => {
  assert.ok(discoverabilitySource.includes("fetch('/api/provider/services', { cache: 'no-store' })"));
  assert.ok(discoverabilitySource.includes("fetch('/api/provider/setup', { cache: 'no-store' })"));
  assert.ok(!discoverabilitySource.includes("method: 'PATCH'"));
  assert.ok(!discoverabilitySource.includes("method: 'PUT'"));
  assert.ok(!discoverabilitySource.includes("method: 'POST'"));
});
