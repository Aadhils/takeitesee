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

const { buildMarketplaceServiceSearchObservation } = await loadTypeScriptModule('../observability.ts');

function baseObservation(overrides = {}) {
  return {
    mode: 'normal',
    queryPresent: true,
    queryTokenCount: 2,
    locationPresent: true,
    categoryFilterApplied: true,
    price: 'under-1000',
    rating: '4-plus',
    provider: 'professional',
    availableNow: true,
    sort: 'relevance',
    cursor: 0,
    limit: 24,
    returnedCount: 0,
    total: 0,
    hasMore: false,
    geoStatus: 'not_requested',
    nearMe: false,
    fallbackUsed: false,
    durationMs: 37,
    ...overrides,
  };
}

test('normal zero-result observation exposes only bounded aggregate search signals', () => {
  assert.deepEqual(buildMarketplaceServiceSearchObservation(baseObservation()), {
    event: 'marketplace_service_search',
    schema_version: 1,
    mode: 'normal',
    query_present: true,
    query_token_count: 2,
    location_present: true,
    category_filter_applied: true,
    price_filter: 'under-1000',
    rating_filter: '4-plus',
    provider_filter: 'professional',
    availability_now: true,
    sort: 'relevance',
    first_page: true,
    page_limit: 24,
    returned_count: 0,
    total_count: 0,
    zero_result: true,
    has_more: false,
    geo_status: 'not_requested',
    near_me: false,
    geo_fallback_used: false,
    duration_ms: 37,
  });
});

test('nearby observation captures geo fallback and result state without coordinates', () => {
  const observation = buildMarketplaceServiceSearchObservation(baseObservation({
    mode: 'nearby',
    queryTokenCount: 1,
    price: 'any',
    rating: 'any',
    provider: 'business',
    availableNow: false,
    sort: 'nearest',
    cursor: 24,
    limit: 48,
    returnedCount: 12,
    total: 72,
    hasMore: true,
    geoStatus: 'unavailable',
    nearMe: true,
    fallbackUsed: true,
    durationMs: 184,
  }));

  assert.equal(observation.mode, 'nearby');
  assert.equal(observation.zero_result, false);
  assert.equal(observation.first_page, false);
  assert.equal(observation.returned_count, 12);
  assert.equal(observation.total_count, 72);
  assert.equal(observation.geo_status, 'unavailable');
  assert.equal(observation.near_me, true);
  assert.equal(observation.geo_fallback_used, true);
  assert.equal(observation.sort, 'nearest');
  assert.equal(Object.hasOwn(observation, 'latitude'), false);
  assert.equal(Object.hasOwn(observation, 'longitude'), false);
  assert.equal(Object.hasOwn(observation, 'origin'), false);
});

test('observability builder ignores raw search text, location, category, coordinates, and identity extras', () => {
  const observation = buildMarketplaceServiceSearchObservation(baseObservation({
    query: 'private medical appointment',
    location: '15 private street',
    category: 'sensitive-category-value',
    latitude: 10.123456,
    longitude: 78.123456,
    userId: 'user-secret-id',
    accountId: 'account-secret-id',
  }));
  const serialized = JSON.stringify(observation);

  for (const forbiddenValue of [
    'private medical appointment',
    '15 private street',
    'sensitive-category-value',
    '10.123456',
    '78.123456',
    'user-secret-id',
    'account-secret-id',
  ]) {
    assert.equal(serialized.includes(forbiddenValue), false);
  }

  for (const forbiddenKey of ['query', 'location', 'category', 'latitude', 'longitude', 'userId', 'accountId']) {
    assert.equal(Object.hasOwn(observation, forbiddenKey), false);
  }
});

test('observability counts and timings stay within bounded diagnostic ranges', () => {
  const observation = buildMarketplaceServiceSearchObservation(baseObservation({
    queryTokenCount: 999,
    limit: 999,
    returnedCount: 999,
    total: 2_000_000_000,
    durationMs: 9_000_000,
  }));

  assert.equal(observation.query_token_count, 64);
  assert.equal(observation.page_limit, 48);
  assert.equal(observation.returned_count, 48);
  assert.equal(observation.total_count, 1_000_000_000);
  assert.equal(observation.duration_ms, 600_000);
});
