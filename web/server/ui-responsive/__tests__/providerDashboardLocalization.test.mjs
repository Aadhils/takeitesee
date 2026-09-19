import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [dashboardSource, catalogSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

const dashboardKeys = [
  'provider.dashboard.workspaceToolbar',
  'provider.dashboard.priorityNow',
  'provider.dashboard.nextBestAction',
  'provider.dashboard.continueNow',
  'provider.dashboard.also',
  'provider.dashboard.allCaughtUp',
  'provider.dashboard.needsAction',
  'provider.dashboard.upcoming',
  'provider.dashboard.activeServices',
  'provider.dashboard.quickActions',
  'provider.dashboard.moreBusinessTools',
  'provider.dashboard.moreCareerTools',
  'provider.dashboard.bookingRefresh',
  'provider.dashboard.nextService',
  'provider.dashboard.viewService',
];

test('Provider dashboard uses the shared identity workspace translation catalog', () => {
  assert.ok(dashboardSource.includes('useIdentityWorkspaceTranslations'));
  assert.ok(dashboardSource.includes('const { t } = useIdentityWorkspaceTranslations()'));
  for (const key of dashboardKeys) {
    assert.ok(dashboardSource.includes(`t('${key}')`), `dashboard should consume ${key}`);
  }
});

test('Provider dashboard localization keys exist in both English and Tamil catalogs', () => {
  for (const key of dashboardKeys) {
    const occurrences = catalogSource.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Provider dashboard no longer hardcodes the newly localized primary UX copy', () => {
  const forbidden = [
    '>Priority now<',
    '>Next best action<',
    '>Continue now<',
    '>Also<',
    '>Go where you need<',
    '>Booking activity needs a refresh<',
    '>Open bookings<',
    '>View service<',
  ];
  for (const phrase of forbidden) {
    assert.ok(!dashboardSource.includes(phrase), `localized copy should not remain hardcoded: ${phrase}`);
  }
});
