import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [exploreSource, filtersSource, stylesSource] = await Promise.all([
  readFile(new URL('app/explore/page.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/ExploreSmartFilters.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/ExploreSmartFilters.module.css', root), 'utf8'),
]);

test('Explore uses the compact smart filter component instead of the tall legacy filter grid', () => {
  assert.ok(exploreSource.includes("import ExploreSmartFilters from '../../components/discovery/ExploreSmartFilters';"));
  assert.ok(exploreSource.includes('<ExploreSmartFilters'));
  assert.ok(!exploreSource.includes('className="discovery-filter-fields"'));
  assert.ok(!exploreSource.includes('className="discovery-search-footer"'));
});

test('smart filters preserve every server-authoritative filter and sort callback', () => {
  for (const callback of [
    'onCategoryChange',
    'onLocationChange',
    'onPriceChange',
    'onRatingChange',
    'onProviderChange',
    'onAvailabilityChange',
    'onSortChange',
    'onUseCurrentLocation',
    'onClearCurrentLocation',
  ]) {
    assert.ok(filtersSource.includes(callback), `missing ${callback}`);
  }
  assert.ok(exploreSource.includes("update('category', value)"));
  assert.ok(exploreSource.includes("update('location', value)"));
  assert.ok(exploreSource.includes("update('price', value as PriceFilter)"));
  assert.ok(exploreSource.includes("update('rating', value as RatingFilter)"));
  assert.ok(exploreSource.includes("update('provider', value as ProviderFilter)"));
  assert.ok(exploreSource.includes("update('availability', value as AvailabilityFilter)"));
});

test('mobile filters use a bottom sheet with active filter count and removable chips', () => {
  assert.ok(filtersSource.includes('aria-controls="explore-filter-sheet"'));
  assert.ok(filtersSource.includes('role="dialog"'));
  assert.ok(filtersSource.includes('aria-modal="true"'));
  assert.ok(filtersSource.includes('activeFilterCount'));
  assert.ok(filtersSource.includes('activeChips'));
  assert.ok(stylesSource.includes('align-items:end'));
  assert.ok(stylesSource.includes('env(safe-area-inset-bottom)'));
  assert.ok(stylesSource.includes('max-height:min(82dvh,720px)'));
});

test('desktop filters stay in one compact horizontally scrollable toolbar', () => {
  assert.ok(filtersSource.includes('styles.desktopToolbar'));
  assert.ok(stylesSource.includes('.desktopToolbar { display:flex'));
  assert.ok(stylesSource.includes('overflow-x:auto'));
  assert.ok(stylesSource.includes('min-height:44px'));
});

test('mobile and desktop presentations switch at the existing phone breakpoint', () => {
  assert.ok(stylesSource.includes('@media (max-width:760px)'));
  assert.ok(stylesSource.includes('.desktopToolbar { display:none; }'));
  assert.ok(stylesSource.includes('.mobileToolbar { display:flex'));
  assert.ok(stylesSource.includes('@media (min-width:761px)'));
  assert.ok(stylesSource.includes('.drawerBackdrop { display:none; }'));
});
