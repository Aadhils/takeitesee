import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [entrySource, managerSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
]);

test('Provider Dashboard composes the complete home inside one LiveProviderShell', () => {
  assert.ok(managerSource.includes('return <LiveProviderShell active="/provider">'));
  assert.ok(managerSource.includes('{children}'));
  assert.ok(entrySource.includes('<ProviderDashboardManager workspaceVersion={workspaceVersion}>'));
  assert.ok(entrySource.includes('</ProviderDashboardManager>'));
});

test('Dashboard marketplace and role-aware sections remain children of the unified workspace', () => {
  const managerOpen = entrySource.indexOf('<ProviderDashboardManager workspaceVersion={workspaceVersion}>');
  const managerClose = entrySource.indexOf('</ProviderDashboardManager>');
  assert.ok(managerOpen >= 0 && managerClose > managerOpen);
  const home = entrySource.slice(managerOpen, managerClose);
  for (const component of [
    'ProviderDashboardHandleCenter',
    'ProviderDashboardLaunchCenter',
    'ProviderDashboardAvailabilityCenter',
    'ProviderDashboardReachCenter',
    'ProviderOfferingDiscoverabilityStatus',
    'ProviderDashboardBookingInbox',
    'BusinessProductOrderAttention',
    'BusinessProductCatalogShortcut',
    'BusinessShopStatusControl',
    'ProviderLiveAvailabilityControl',
  ]) assert.ok(home.includes(`<${component}`), `${component} should stay inside the unified Provider workspace`);
});

test('service refresh updates Dashboard data without remounting the whole workspace shell', () => {
  assert.ok(managerSource.includes('workspaceVersion?: number'));
  assert.ok(managerSource.includes('useEffect(() => { void load(); }, [load, workspaceVersion])'));
  assert.ok(!entrySource.includes('<ProviderDashboardManager key={workspaceVersion}'));
  assert.ok(entrySource.includes('key={`availability-${workspaceVersion}`}'));
  assert.ok(entrySource.includes('key={`reach-${workspaceVersion}`}'));
  assert.ok(entrySource.includes('key={`discoverability-${workspaceVersion}`}'));
});
