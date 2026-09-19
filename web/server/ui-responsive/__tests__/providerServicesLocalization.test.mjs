import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderCatalogManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

const catalogKeys = [
  'catalog.categoryFallback',
  'catalog.categoryRequired',
  'catalog.loadServicesFallback',
  'catalog.loadReadinessFallback',
  'catalog.activationCheckingTitle',
  'catalog.activationCheckingDetail',
  'catalog.openProviderSetup',
  'catalog.suspendedTitle',
  'catalog.suspendedDetail',
  'catalog.openPlatformSupport',
  'catalog.reverifyTitle',
  'catalog.reverifyDetail',
  'catalog.continueReverification',
  'catalog.profileIncompleteTitle',
  'catalog.profileIncompleteDetail',
  'catalog.completeProfileShort',
  'catalog.providerVerificationTitle',
  'catalog.providerVerificationDetail',
  'catalog.openVerificationShort',
  'catalog.disclosureIncompleteTitle',
  'catalog.disclosureIncompleteDetail',
  'catalog.completeDisclosure',
  'catalog.scopeApprovalTitle',
  'catalog.scopeApprovalDetail',
  'catalog.reviewLaunchScope',
  'catalog.launchIncompleteTitle',
  'catalog.launchIncompleteDetail',
  'catalog.reactivationReadyTitle',
  'catalog.reactivationReadyDetail',
  'catalog.reviewService',
  'catalog.legacyCategoryNotice',
  'catalog.saveFallback',
  'catalog.categoryChangedNotice',
  'catalog.editSavedNotice',
  'catalog.createSavedNotice',
  'catalog.suspendedActivationError',
  'catalog.reverifyActivationError',
  'catalog.notLaunchReadyError',
  'catalog.statusUpdateFallback',
  'catalog.statusUpdatedPrefix',
  'catalog.platformCategoriesRequired',
  'catalog.noSelectableCategories',
  'catalog.requestCategoryNeeded',
  'catalog.disclosureServicesDetail',
  'catalog.adminManagedCategories',
  'catalog.adminManagedCategoriesHelp',
  'catalog.registryHelp',
  'catalog.platformCategory',
  'catalog.platformCategoryHint',
  'catalog.selectSpecificCategory',
  'catalog.missingCategoryHelp',
  'catalog.requestCategoryReview',
  'catalog.minutesShort',
  'catalog.reactivate',
];

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Services uses the shared workspace catalog instead of local Tamil branching', () => {
  assert.ok(source.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
  for (const key of catalogKeys) {
    assert.ok(source.includes(`t('${key}')`), `missing shared key usage: ${key}`);
  }
});

test('Provider Services catalog additions stay in English and Tamil parity', () => {
  for (const key of catalogKeys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Services keeps CRUD, lifecycle, reach and launch-gate contracts unchanged', () => {
  assert.ok(source.includes("fetch('/api/provider/services', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/setup', { cache: 'no-store' })"));
  assert.ok(source.includes("method: editingId ? 'PATCH' : 'POST'"));
  assert.ok(source.includes("fetch(\`/api/provider/services/\${id}\`"));
  assert.ok(source.includes("void setStatus(item.id, 'active')"));
  assert.ok(source.includes("void setStatus(item.id, 'paused')"));
  assert.ok(source.includes("void setStatus(item.id, 'draft')"));
  assert.ok(source.includes('ProviderServiceReachControl'));
  assert.ok(source.includes("readiness.trust_status === 'suspended'"));
  assert.ok(source.includes("readiness.trust_status === 'reverification_required'"));
  assert.ok(source.includes('!readiness.profile_complete'));
  assert.ok(source.includes('!readiness.verified'));
  assert.ok(source.includes('!readiness.marketplace_disclosure_complete'));
  assert.ok(source.includes('!service?.scope_enabled'));
  assert.ok(source.includes('!service.launch_ready'));
  assert.ok(source.includes('categoryChanged'));
  assert.ok(source.includes("href=\"/provider/category-requests\""));
});
