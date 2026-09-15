import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [centerSource, cssSource, entrySource, reachSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardReachCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardReachCenter.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderServiceReachControl.tsx', root), 'utf8'),
]);

test('Provider Dashboard exposes compact service reach controls', () => {
  assert.ok(entrySource.includes('ProviderDashboardReachCenter'));
  assert.ok(centerSource.includes('id="provider-service-reach"'));
  assert.ok(centerSource.includes("fetch('/api/provider/services'"));
  assert.ok(centerSource.includes('ProviderServiceReachControl'));
  assert.ok(centerSource.includes('MAX_DASHBOARD_SERVICES = 4'));
});

test('Dashboard reach reuses the existing precise-location contract', () => {
  assert.ok(reachSource.includes('/reach`'));
  assert.ok(reachSource.includes("action: 'save_modes'"));
  assert.ok(reachSource.includes("action: 'set_location'"));
  assert.ok(reachSource.includes("action: 'remove_location'"));
  assert.ok(reachSource.includes('navigator.geolocation.getCurrentPosition'));
});

test('service reach remains compact and phone safe', () => {
  assert.ok(cssSource.includes('grid-template-columns: repeat(2'));
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('@media (max-width: 440px)'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('new services refresh the reach center in the same workspace', () => {
  assert.ok(entrySource.includes('key={`reach-${workspaceVersion}`}'));
  assert.ok(entrySource.includes("window.addEventListener('provider-services-refresh'"));
});
