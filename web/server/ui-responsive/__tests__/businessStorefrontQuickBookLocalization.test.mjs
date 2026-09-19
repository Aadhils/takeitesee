import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/detail/BusinessStorefrontQuickBook.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Business storefront Quick Book uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { locale, t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [
    'publicProvider.businessQuickBook.availableNow',
    'publicProvider.businessQuickBook.busyNow',
    'publicProvider.businessQuickBook.livePaused',
    'publicProvider.businessQuickBook.liveOffline',
    'publicProvider.businessQuickBook.atBusiness',
    'publicProvider.businessQuickBook.travelsToYou',
    'publicProvider.businessQuickBook.remote',
    'publicProvider.businessQuickBook.serviceAreaConfirmed',
    'publicProvider.businessQuickBook.scheduledTimes',
    'publicProvider.businessQuickBook.chooseTime',
    'publicProvider.businessQuickBook.scheduledNote',
    'publicProvider.businessQuickBook.flexibleBooking',
    'publicProvider.businessQuickBook.bookService',
    'publicProvider.businessQuickBook.flexibleNote',
    'publicProvider.businessQuickBook.businessConfirmsTime',
    'publicProvider.businessQuickBook.requestBooking',
    'publicProvider.businessQuickBook.requestNote',
    'publicProvider.businessQuickBook.priceFallback',
    'publicProvider.businessQuickBook.storefront',
    'publicProvider.businessQuickBook.title',
    'publicProvider.businessQuickBook.intro',
    'publicProvider.businessQuickBook.postRequirement',
    'publicProvider.businessQuickBook.statusNote',
    'publicProvider.businessQuickBook.price',
    'publicProvider.businessQuickBook.duration',
    'publicProvider.businessQuickBook.durationUnit',
    'publicProvider.businessQuickBook.serviceDelivery',
    'publicProvider.businessQuickBook.area',
    'publicProvider.businessQuickBook.viewDetails',
    'publicProvider.businessQuickBook.emptyTitle',
    'publicProvider.businessQuickBook.emptyHelp',
  ];

  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Business storefront Quick Book preserves live status and booking-mode semantics', () => {
  for (const mode of ["mode === 'available'", "mode === 'busy'", "mode === 'paused'", "mode === 'scheduled'", "mode === 'always_available'"]) {
    assert.ok(source.includes(mode));
  }
  assert.ok(source.includes('service.live_work_mode'));
  assert.ok(source.includes('service.availability_mode'));
  assert.ok(source.includes('service.fulfillment_modes'));
});

test('Business storefront Quick Book preserves service booking and detail destinations', () => {
  assert.ok(source.includes('/services/'));
  assert.ok(source.includes('/booking'));
  assert.ok(source.includes('encodeURIComponent(service.id)'));
  assert.ok(source.includes('href="/requirements"'));
});

test('Business storefront Quick Book preserves locale-aware money formatting and service facts', () => {
  assert.ok(source.includes('new Intl.NumberFormat(locale'));
  assert.ok(source.includes("currency: currency || 'INR'"));
  assert.ok(source.includes('service.base_price'));
  assert.ok(source.includes('service.duration_minutes'));
  assert.ok(source.includes('service.location || businessLocation'));
});

test('Business storefront Quick Book keeps locale-safe business-name interpolation', () => {
  assert.ok(source.includes("t('publicProvider.businessQuickBook.title').replace('{businessName}', businessName)"));
});
