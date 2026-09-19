import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/discovery/ExploreSmartFilters.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'explore.filters','explore.filterServices','explore.filterHelp','explore.showOneService','explore.showManyServices',
  'explore.updatingResults','explore.nearMe','explore.activeFilters','explore.closeFilterMenu','explore.closeSortMenu',
];

test('Explore Smart Filters uses shared localization with EN/TA parity', () => {
  assert.ok(source.includes('const { t } = useLanguage()'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.ok(!source.includes('const copy ='));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Explore Smart Filters preserves all authoritative filter and sort callbacks', () => {
  for (const callback of [
    'onCategoryChange','onLocationChange','onPriceChange','onRatingChange','onProviderChange',
    'onAvailabilityChange','onSortChange','onClearAll','onUseCurrentLocation','onClearCurrentLocation',
  ]) assert.ok(source.includes(callback), callback);
  assert.ok(source.includes("onCategoryChange('all')"));
  assert.ok(source.includes("onLocationChange('Anywhere')"));
  assert.ok(source.includes("onPriceChange('any')"));
  assert.ok(source.includes("onRatingChange('any')"));
  assert.ok(source.includes("onProviderChange('any')"));
  assert.ok(source.includes("onAvailabilityChange('any')"));
});

test('Explore Smart Filters preserves geo ranking, active chips and canonical category semantics', () => {
  assert.ok(source.includes("location === 'Anywhere' ? '' : location"));
  assert.ok(source.includes("option.value === category"));
  assert.ok(source.includes('value={option.value}'));
  assert.ok(source.includes('{option.label}'));
  assert.ok(source.includes("preciseNearbyActive ? [{ value: 'nearest'"));
  assert.ok(source.includes("label: t('explore.nearMe')"));
  assert.ok(source.includes('activeFilterCount'));
  assert.ok(source.includes('activeChips'));
});

test('Explore Smart Filters preserves drawer, sort and Escape accessibility behavior', () => {
  assert.ok(source.includes("if (event.key === 'Escape')"));
  assert.ok(source.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(source.includes('aria-controls="explore-filter-sheet"'));
  assert.ok(source.includes('aria-controls="explore-sort-menu"'));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('aria-modal="true"'));
  assert.ok(source.includes("aria-label={t('explore.closeFilterMenu')}"));
  assert.ok(source.includes("aria-label={t('explore.closeSortMenu')}"));
});

test('Explore Smart Filters preserves localized result-count and loading semantics', () => {
  assert.ok(source.includes("loading ? t('explore.updatingResults')"));
  assert.ok(source.includes("resultCount === 1 ? t('explore.showOneService')"));
  assert.ok(source.includes("t('explore.showManyServices').replace('{count}', String(resultCount))"));
});

test('Explore Smart Filters localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
