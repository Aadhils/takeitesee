import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, translations] = await Promise.all([
  readFile(new URL('components/account/SavedServicesPage.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Saved Services page uses shared account-workspace localization', () => {
  assert.ok(page.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!page.includes('useLanguage'));
  assert.ok(!page.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(page));
  for (const key of [
    'savedServices.eyebrow',
    'savedServices.title',
    'savedServices.intro',
    'savedServices.signInTitle',
    'savedServices.signInHelp',
    'savedServices.signIn',
    'savedServices.createAccount',
    'savedServices.loading',
    'savedServices.emptyTitle',
    'savedServices.emptyHelp',
    'savedServices.explore',
    'savedServices.unavailableEyebrow',
    'savedServices.unavailableTitle',
    'savedServices.unavailableBadge',
    'savedServices.unavailableHelp',
    'savedServices.remove',
    'savedServices.categoryFallback',
    'savedServices.provider.business',
    'savedServices.provider.professional',
    'savedServices.savedBadge',
    'savedServices.location',
    'savedServices.flexible',
    'savedServices.duration',
    'savedServices.minutes',
    'savedServices.price',
    'savedServices.savedDate',
    'savedServices.open',
    'savedServices.unsave',
    'savedServices.error.load',
    'savedServices.error.remove',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Saved Services preserves load, auth and remove API semantics', () => {
  assert.ok(page.includes("fetch('/api/account/saved-services', { cache: 'no-store' })"));
  assert.ok(page.includes('response.status === 401'));
  assert.ok(page.includes('setAuthenticated(false)'));
  assert.ok(page.includes('setItems([])'));
  assert.ok(page.includes("fetch('/api/account/saved-services', {"));
  assert.ok(page.includes("method: 'DELETE'"));
  assert.ok(page.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(page.includes('JSON.stringify({ service_id: serviceId })'));
  assert.ok(page.includes('current.filter((item) => item.service_id !== serviceId)'));
  assert.ok(page.includes('if (busyId) return'));
});

test('Saved Services preserves API error precedence and localized fallbacks', () => {
  assert.ok(page.includes("payload.error || t('savedServices.error.load')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('savedServices.error.load')"));
  assert.ok(page.includes("payload.error || t('savedServices.error.remove')"));
  assert.ok(page.includes("cause instanceof Error ? cause.message : t('savedServices.error.remove')"));
  assert.ok(page.includes('const load = useCallback(async () => {'));
  assert.ok(page.includes('}, [t]);'));
  assert.ok(page.includes('useEffect(() => { void load(); }, [load])'));
});

test('Saved Services preserves availability, provider, money and date contracts', () => {
  assert.ok(page.includes('!item.available || !item.service'));
  assert.ok(page.includes("service.provider_type === 'business'"));
  assert.ok(page.includes("t('savedServices.provider.business')"));
  assert.ok(page.includes("t('savedServices.provider.professional')"));
  assert.ok(page.includes('new Intl.NumberFormat(locale'));
  assert.ok(page.includes("new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })"));
  assert.ok(page.includes("service.location || t('savedServices.flexible')"));
  assert.ok(page.includes('/services/${encodeURIComponent(service.id)}'));
});

test('Saved Services preserves account destinations and responsive wrapper', () => {
  assert.ok(page.includes('CustomerSavedItemsResponsive.module.css'));
  assert.ok(page.includes('savedItemsJourney'));
  assert.ok(page.includes('active="/saved-services"'));
  assert.ok(page.includes('/login?returnTo=%2Fsaved-services'));
  assert.ok(page.includes('href="/signup"'));
  assert.ok(page.includes('href="/explore"'));
});
