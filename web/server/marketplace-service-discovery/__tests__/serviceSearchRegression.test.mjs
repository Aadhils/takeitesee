import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadTypeScriptModule(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText, 'utf8').toString('base64')}`;
  return import(moduleUrl);
}

const intentModule = await loadTypeScriptModule('../../../components/discovery/marketplaceSearchIntent.ts');
const semanticsModule = await loadTypeScriptModule('../searchSemantics.ts');
const parsingModule = await loadTypeScriptModule('../requestParsing.ts');
const responseMappingModule = await loadTypeScriptModule('../responseMapping.ts');

const { parseMarketplaceSearchIntent } = intentModule;
const { resolveMarketplaceServiceSearchSemantics } = semanticsModule;
const {
  boundedMarketplaceServiceInteger,
  marketplaceServiceDefaultPageSize,
  marketplaceServiceFallbackNormalSort,
  marketplaceServiceMaxPageSize,
  marketplaceServiceNearbySortModes,
  marketplaceServiceNormalSortModes,
  marketplaceServicePriceFilters,
  marketplaceServiceProviderFilters,
  marketplaceServiceRatingFilters,
  normalizeMarketplaceServiceCategory,
  normalizeMarketplaceServiceLocation,
  normalizeMarketplaceServiceQuery,
  parseMarketplaceServiceFilter,
  resolveMarketplaceServicePage,
} = parsingModule;
const { mapMarketplaceServiceDiscoveryServices } = responseMappingModule;

function resolvePipeline(rawQuery) {
  const intent = parseMarketplaceSearchIntent(rawQuery);
  const semantics = resolveMarketplaceServiceSearchSemantics(intent.serviceQuery);
  return {
    ...intent,
    tokens: semantics.tokens,
    semanticQuery: semantics.semanticQuery,
  };
}

function serviceCandidate(overrides = {}) {
  return {
    id: 'service-1',
    provider_type: 'professional',
    professional_id: 'professional-1',
    business_id: null,
    service_name: 'Plumbing Repair',
    description: 'Leak and pipe repair',
    service_location: null,
    duration_minutes: 60,
    base_price: '499.50',
    currency: 'INR',
    category: 'Plumbing Services',
    provider_name: null,
    service_area: 'Trichy',
    category_code: 'HOME_REPAIR_PLUMBING',
    category_group: 'Home Services',
    category_aliases: ['plumber', 'பிளம்பர்'],
    rating: '4.7',
    review_count: '12',
    live_work_mode: 'available',
    business_shop_state: null,
    distance_band: '3_7km',
    distance_priority: '18',
    nearby_match_mode: 'at_customer',
    total_count: 1,
    ...overrides,
  };
}

test('current-location intent stays near-me in English and Tamil', () => {
  assert.deepEqual(resolvePipeline('best plumber near me'), {
    serviceQuery: 'plumber',
    locationQuery: '',
    nearMe: true,
    tokens: ['plumber'],
    semanticQuery: 'plumber',
  });

  assert.deepEqual(resolvePipeline('எனக்கு அருகில் பிளம்பர்'), {
    serviceQuery: 'பிளம்பர்',
    locationQuery: '',
    nearMe: true,
    tokens: ['பிளம்பர்'],
    semanticQuery: 'பிளம்பர்',
  });

  assert.deepEqual(resolvePipeline('சிறந்த பிளம்பர் என் அருகில்'), {
    serviceQuery: 'பிளம்பர்',
    locationQuery: '',
    nearMe: true,
    tokens: ['பிளம்பர்'],
    semanticQuery: 'பிளம்பர்',
  });
});

test('named-location intent stays named-location in English and Tamil', () => {
  assert.deepEqual(resolvePipeline('best plumber in Trichy'), {
    serviceQuery: 'plumber',
    locationQuery: 'Trichy',
    nearMe: false,
    tokens: ['plumber'],
    semanticQuery: 'plumber',
  });

  assert.deepEqual(resolvePipeline('plumber near Trichy'), {
    serviceQuery: 'plumber',
    locationQuery: 'Trichy',
    nearMe: false,
    tokens: ['plumber'],
    semanticQuery: 'plumber',
  });

  assert.deepEqual(resolvePipeline('திருச்சி அருகில் பிளம்பர்'), {
    serviceQuery: 'பிளம்பர்',
    locationQuery: 'திருச்சி',
    nearMe: false,
    tokens: ['பிளம்பர்'],
    semanticQuery: 'பிளம்பர்',
  });

  assert.deepEqual(resolvePipeline('பிளம்பர் திருச்சி அருகில்'), {
    serviceQuery: 'பிளம்பர்',
    locationQuery: 'திருச்சி',
    nearMe: false,
    tokens: ['பிளம்பர்'],
    semanticQuery: 'பிளம்பர்',
  });
});

test('semantic tokenization preserves Tamil graphemes and removes search-intent noise', () => {
  assert.deepEqual(
    resolveMarketplaceServiceSearchSemantics('எனக்கு அருகில் பிளம்பர் இப்போது கிடைக்கும் சேவை'),
    { tokens: ['பிளம்பர்'], semanticQuery: 'பிளம்பர்' },
  );

  assert.deepEqual(
    resolveMarketplaceServiceSearchSemantics('nearest ＡＣ repair service near me'),
    { tokens: ['ac', 'repair'], semanticQuery: 'ac repair' },
  );
});

test('shared request normalization keeps production limits and wildcard cleanup stable', () => {
  assert.equal(normalizeMarketplaceServiceQuery(`  ${'x'.repeat(200)}  `).length, 180);
  assert.equal(normalizeMarketplaceServiceCategory(undefined), 'all');
  assert.equal(normalizeMarketplaceServiceCategory('   '), 'all');
  assert.equal(normalizeMarketplaceServiceLocation('  Trichy%__\\ Cantonment   '), 'Trichy Cantonment');

  assert.equal(
    parseMarketplaceServiceFilter('nearest', marketplaceServiceNormalSortModes, 'relevance'),
    null,
  );
  assert.equal(
    parseMarketplaceServiceFilter('nearest', marketplaceServiceNearbySortModes, 'relevance'),
    'nearest',
  );
  assert.equal(
    parseMarketplaceServiceFilter('professional', marketplaceServiceProviderFilters, 'any'),
    'professional',
  );
  assert.equal(
    parseMarketplaceServiceFilter('business', marketplaceServiceProviderFilters, 'any'),
    'business',
  );

  assert.equal(
    boundedMarketplaceServiceInteger(null, marketplaceServiceDefaultPageSize, 1, marketplaceServiceMaxPageSize),
    24,
  );
  assert.equal(
    boundedMarketplaceServiceInteger(999, marketplaceServiceDefaultPageSize, 1, marketplaceServiceMaxPageSize),
    48,
  );
  assert.equal(
    boundedMarketplaceServiceInteger(0, marketplaceServiceDefaultPageSize, 1, marketplaceServiceMaxPageSize),
    1,
  );
});

test('normal and nearby Service filter catalogs stay in parity with nearby-only nearest sorting', () => {
  assert.deepEqual([...marketplaceServicePriceFilters], ['any', 'under-1000', '1000-5000', 'over-5000']);
  assert.deepEqual([...marketplaceServiceRatingFilters], ['any', '4-plus', '4.5-plus']);
  assert.deepEqual([...marketplaceServiceProviderFilters], ['any', 'professional', 'business']);
  assert.deepEqual([...marketplaceServiceNormalSortModes], ['relevance', 'rating', 'price', 'price-desc']);
  assert.deepEqual([...marketplaceServiceNearbySortModes], ['relevance', 'nearest', 'rating', 'price', 'price-desc']);

  for (const value of marketplaceServicePriceFilters) {
    assert.equal(parseMarketplaceServiceFilter(value, marketplaceServicePriceFilters, 'any'), value);
  }
  for (const value of marketplaceServiceRatingFilters) {
    assert.equal(parseMarketplaceServiceFilter(value, marketplaceServiceRatingFilters, 'any'), value);
  }
  for (const value of marketplaceServiceProviderFilters) {
    assert.equal(parseMarketplaceServiceFilter(value, marketplaceServiceProviderFilters, 'any'), value);
  }
  for (const value of marketplaceServiceNormalSortModes) {
    assert.equal(parseMarketplaceServiceFilter(value, marketplaceServiceNormalSortModes, 'relevance'), value);
  }

  assert.equal(parseMarketplaceServiceFilter(undefined, marketplaceServicePriceFilters, 'any'), 'any');
  assert.equal(parseMarketplaceServiceFilter('', marketplaceServiceRatingFilters, 'any'), 'any');
  assert.equal(parseMarketplaceServiceFilter('invalid', marketplaceServiceProviderFilters, 'any'), null);
  assert.equal(parseMarketplaceServiceFilter('nearest', marketplaceServiceNormalSortModes, 'relevance'), null);
  assert.equal(parseMarketplaceServiceFilter('nearest', marketplaceServiceNearbySortModes, 'relevance'), 'nearest');

  assert.equal(marketplaceServiceFallbackNormalSort('nearest'), 'relevance');
  assert.equal(marketplaceServiceFallbackNormalSort('relevance'), 'relevance');
  assert.equal(marketplaceServiceFallbackNormalSort('rating'), 'rating');
  assert.equal(marketplaceServiceFallbackNormalSort('price'), 'price');
  assert.equal(marketplaceServiceFallbackNormalSort('price-desc'), 'price-desc');
});

test('shared Service pagination keeps cursor and limit boundaries deterministic', () => {
  assert.equal(boundedMarketplaceServiceInteger(undefined, 0, 0, 1_000_000_000), 0);
  assert.equal(boundedMarketplaceServiceInteger(-50, 0, 0, 1_000_000_000), 0);
  assert.equal(boundedMarketplaceServiceInteger('27abc', 0, 0, 1_000_000_000), 27);
  assert.equal(boundedMarketplaceServiceInteger(2_000_000_000, 0, 0, 1_000_000_000), 1_000_000_000);
  assert.equal(boundedMarketplaceServiceInteger('not-a-number', 0, 0, 1_000_000_000), 0);

  assert.equal(boundedMarketplaceServiceInteger(undefined, 24, 1, 48), 24);
  assert.equal(boundedMarketplaceServiceInteger(-5, 24, 1, 48), 1);
  assert.equal(boundedMarketplaceServiceInteger('12items', 24, 1, 48), 12);
  assert.equal(boundedMarketplaceServiceInteger(99, 24, 1, 48), 48);
});

test('shared Service pagination returns the same has-more, total, and next-cursor contract for both routes', () => {
  const rows = [
    { id: 'service-1', total_count: '37' },
    { id: 'service-2', total_count: '37' },
    { id: 'service-3', total_count: '37' },
  ];

  assert.deepEqual(resolveMarketplaceServicePage(rows, 24, 2), {
    pageRows: rows.slice(0, 2),
    total: 37,
    page: {
      limit: 2,
      next_cursor: '26',
      has_more: true,
    },
  });

  assert.deepEqual(resolveMarketplaceServicePage(rows.slice(0, 2), 24, 2), {
    pageRows: rows.slice(0, 2),
    total: 37,
    page: {
      limit: 2,
      next_cursor: null,
      has_more: false,
    },
  });

  assert.deepEqual(resolveMarketplaceServicePage([], 0, 24), {
    pageRows: [],
    total: 0,
    page: {
      limit: 24,
      next_cursor: null,
      has_more: false,
    },
  });
});

test('normal Service response mapping locks canonical Professional output and strips geo fields', () => {
  const [service] = mapMarketplaceServiceDiscoveryServices([serviceCandidate()], { nearby: false });

  assert.deepEqual(service, {
    id: 'service-1',
    service_name: { en: 'Plumbing Repair' },
    description: { en: 'Leak and pipe repair' },
    provider_name: 'Professional provider',
    provider_type: 'professional',
    provider_id: 'professional-1',
    location: 'Trichy',
    service_area: 'Trichy',
    category_id: 'home-repair-plumbing',
    category_slug: 'home-repair-plumbing',
    category_code: 'HOME_REPAIR_PLUMBING',
    category_group: 'Home Services',
    category_aliases: ['plumber', 'பிளம்பர்'],
    pricing: {
      base_price: {
        amount: 49950,
        currency: 'INR',
      },
    },
    duration_minutes: 60,
    rating: 4.7,
    review_count: 12,
    live_work_mode: 'available',
    availability: 'Available now',
    business_shop_state: null,
    distance_band: null,
    distance_priority: 0,
    nearby_match_mode: null,
    verified: true,
  });
});

test('nearby Service response mapping locks Business provider identity and valid geo sanitization', () => {
  const [service] = mapMarketplaceServiceDiscoveryServices([
    serviceCandidate({
      id: 'service-2',
      provider_type: 'business',
      professional_id: null,
      business_id: 'business-1',
      service_name: 'AC Repair',
      description: null,
      service_location: 'Cantonment',
      service_area: null,
      duration_minutes: null,
      base_price: 1200,
      currency: null,
      category: 'AC Repair & Service',
      category_code: null,
      category_group: null,
      category_aliases: null,
      provider_name: 'Cool Air Services',
      rating: null,
      review_count: null,
      live_work_mode: 'busy',
      business_shop_state: 'open',
      distance_band: '3_7km',
      distance_priority: '99',
      nearby_match_mode: 'at_provider',
    }),
  ], { nearby: true });

  assert.equal(service.provider_type, 'business');
  assert.equal(service.provider_id, 'business-1');
  assert.equal(service.provider_name, 'Cool Air Services');
  assert.equal(service.location, 'Cantonment');
  assert.equal(service.service_area, 'Cantonment');
  assert.equal(service.category_id, 'ac-repair-service');
  assert.equal(service.category_slug, 'ac-repair-service');
  assert.equal(service.category_code, null);
  assert.deepEqual(service.category_aliases, []);
  assert.deepEqual(service.pricing, { base_price: { amount: 120000, currency: 'INR' } });
  assert.equal(service.duration_minutes, 0);
  assert.equal(service.rating, 0);
  assert.equal(service.review_count, 0);
  assert.equal(service.live_work_mode, 'busy');
  assert.equal(service.availability, 'Busy now');
  assert.equal(service.business_shop_state, 'open');
  assert.equal(service.distance_band, '3_7km');
  assert.equal(service.distance_priority, 24);
  assert.equal(service.nearby_match_mode, 'at_provider');
  assert.equal(service.verified, true);
});

test('nearby Service response mapping rejects invalid geo values and preserves safe fallbacks', () => {
  const [service] = mapMarketplaceServiceDiscoveryServices([
    serviceCandidate({
      distance_band: 'unknown-band',
      distance_priority: 'not-a-number',
      nearby_match_mode: 'somewhere-else',
      live_work_mode: 'unexpected-mode',
      business_shop_state: 'unexpected-state',
      category_aliases: 'not-an-array',
    }),
  ], { nearby: true });

  assert.equal(service.live_work_mode, 'offline');
  assert.equal(service.availability, 'Offline');
  assert.deepEqual(service.category_aliases, []);
  assert.equal(service.distance_band, null);
  assert.equal(service.distance_priority, 0);
  assert.equal(service.nearby_match_mode, null);
});
