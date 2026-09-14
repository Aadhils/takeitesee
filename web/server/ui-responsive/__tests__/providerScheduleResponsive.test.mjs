import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/schedule/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderAvailabilityManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderScheduleResponsive.module.css', root), 'utf8'),
]);

test('Provider Schedule route uses the scoped responsive wrapper', () => {
  assert.ok(routeSource.includes('ProviderScheduleResponsive.module.css'));
  assert.ok(routeSource.includes('className={styles.scheduleJourney}'));
  assert.ok(routeSource.includes('ProviderAvailabilityManager'));
});

test('Provider Schedule responsive styles protect narrow layouts and touch targets', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Provider Schedule save and availability semantics remain present', () => {
  assert.ok(managerSource.includes("fetch('/api/provider/services'"));
  assert.ok(managerSource.includes('/availability`, { method: \'PUT\''));
  assert.ok(managerSource.includes("value=\"scheduled\""));
  assert.ok(managerSource.includes('addWindow(dayIndex)'));
  assert.ok(managerSource.includes('removeWindow(index)'));
  assert.ok(managerSource.includes('addBlackout'));
  assert.ok(managerSource.includes('blackout_periods'));
});
