import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [centerSource, cssSource, entrySource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardAvailabilityCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardAvailabilityCenter.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
]);

test('Provider Dashboard owns simple per-service booking availability controls', () => {
  assert.ok(entrySource.includes('ProviderDashboardAvailabilityCenter'));
  assert.ok(centerSource.includes('id="provider-booking-availability"'));
  assert.ok(centerSource.includes("fetch('/api/provider/services'"));
  assert.ok(centerSource.includes('/availability`'));
  assert.ok(centerSource.includes("method: 'PUT'"));
});

test('quick mode changes preserve detailed availability state', () => {
  assert.ok(centerSource.includes('timezone: current.timezone'));
  assert.ok(centerSource.includes('weekly_windows: current.weekly_windows'));
  assert.ok(centerSource.includes('blackout_periods: current.blackout_periods'));
  assert.ok(centerSource.includes("mode === 'scheduled' && current.weekly_windows.length === 0"));
  assert.ok(centerSource.includes('href="/provider/schedule"'));
});

test('Dashboard availability center remains compact and responsive', () => {
  assert.ok(cssSource.includes('grid-template-columns: repeat(2'));
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('@media (max-width: 440px)'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('service workflow refresh remounts booking availability summary', () => {
  assert.ok(entrySource.includes('key={`availability-${workspaceVersion}`}'));
  assert.ok(entrySource.includes("window.addEventListener('provider-services-refresh'"));
});
