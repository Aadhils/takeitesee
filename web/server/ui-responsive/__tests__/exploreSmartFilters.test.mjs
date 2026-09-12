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

test('mobile and tablet filters use an adaptive bottom sheet with active filter count and removable chips', () => {
  assert.ok(filtersSource.includes('aria-controls="explore-filter-sheet"'));
  assert.ok(filtersSource.includes('role="dialog"'));
  assert.ok(filtersSource.includes('aria-modal="true"'));
  assert.ok(filtersSource.includes('activeFilterCount'));
  assert.ok(filtersSource.includes('activeChips'));
  assert.ok(stylesSource.includes('align-items:end'));
  assert.ok(stylesSource.includes('env(safe-area-inset-bottom)'));
  assert.ok(stylesSource.includes('width:min(100%,860px)'));
  assert.ok(stylesSource.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(stylesSource.includes('@media (max-width:540px)'));
  assert.ok(stylesSource.includes('.drawerFields { grid-template-columns:1fr'));
});

test('desktop filters wrap instead of clipping at the right edge', () => {
  assert.ok(filtersSource.includes('styles.desktopToolbar'));
  assert.ok(stylesSource.includes('.desktopToolbar { display:flex; flex-wrap:wrap'));
  assert.ok(stylesSource.includes('overflow:visible'));
  assert.ok(!stylesSource.includes('overflow-x:auto; padding:2px 1px 5px'));
  assert.ok(stylesSource.includes('min-height:44px'));
});

test('phone and tablet presentations switch at a tablet-safe breakpoint', () => {
  assert.ok(stylesSource.includes('@media (max-width:900px)'));
  assert.ok(stylesSource.includes('.desktopToolbar { display:none; }'));
  assert.ok(stylesSource.includes('.mobileToolbar { display:flex'));
  assert.ok(stylesSource.includes('@media (min-width:901px)'));
  assert.ok(stylesSource.includes('.drawerBackdrop { display:none; }'));
});

test('Sort uses an app-style chooser instead of a narrow native mobile select', () => {
  assert.ok(filtersSource.includes('aria-controls="explore-sort-menu"'));
  assert.ok(filtersSource.includes('id="explore-sort-menu"'));
  assert.ok(filtersSource.includes('sortChoices.map'));
  assert.ok(filtersSource.includes('role="option"'));
  assert.ok(filtersSource.includes('aria-selected={sort === option.value}'));
  assert.ok(stylesSource.includes('.sortPanel'));
  assert.ok(stylesSource.includes('.sortRadio'));
  assert.ok(stylesSource.includes('.mobileSortButton { flex:1 1 auto; min-width:0'));
  assert.ok(!filtersSource.includes('className={styles.mobileSort}'));
});

test('real-device polish compacts the Explore hero and location feedback without changing search semantics', () => {
  assert.ok(filtersSource.includes('explore-smart-filters'));
  assert.ok(stylesSource.includes(':has(.explore-smart-filters)'));
  assert.ok(stylesSource.includes('font-size:clamp(1.95rem,8.6vw,2.65rem)'));
  assert.ok(stylesSource.includes("p[role='alert']"));
  assert.ok(exploreSource.includes("{geoError ? <p role=\"alert\""));
  assert.ok(exploreSource.includes('buildServerSearchParams'));
  assert.ok(exploreSource.includes('nearbySearchBody'));
});
