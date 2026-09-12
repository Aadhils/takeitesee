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

const rpcArgumentsModule = await loadTypeScriptModule('../rpcArguments.ts');
const parsingModule = await loadTypeScriptModule('../requestParsing.ts');

const {
  buildMarketplaceServiceDiscoveryRpcArgs,
  buildMarketplaceServiceNearbyRpcArgs,
} = rpcArgumentsModule;
const { marketplaceServiceFallbackNormalSort } = parsingModule;

function commonInput(overrides = {}) {
  return {
    semanticQuery: 'ac repair',
    queryTokens: ['ac', 'repair'],
    category: 'home-ac-repair',
    location: 'Trichy',
    price: 'under-1000',
    rating: '4-plus',
    provider: 'business',
    availableNow: true,
    sort: 'price',
    cursor: 48,
    limit: 24,
    ...overrides,
  };
}

test('normal Service RPC arguments preserve the canonical backend contract', () => {
  assert.deepEqual(buildMarketplaceServiceDiscoveryRpcArgs(commonInput()), {
    target_query: 'ac repair',
    target_tokens: ['ac', 'repair'],
    target_category: 'home-ac-repair',
    target_location: 'Trichy',
    target_price: 'under-1000',
    target_rating: '4-plus',
    target_provider: 'business',
    target_available_now: true,
    target_sort: 'price',
    target_offset: 48,
    target_limit: 25,
  });
});

test('normal Service RPC arguments preserve null search/location semantics and lookahead limit', () => {
  assert.deepEqual(
    buildMarketplaceServiceDiscoveryRpcArgs(commonInput({
      semanticQuery: '',
      queryTokens: [],
      category: 'all',
      location: '',
      price: 'any',
      rating: 'any',
      provider: 'any',
      availableNow: false,
      sort: 'relevance',
      cursor: 0,
      limit: 48,
    })),
    {
      target_query: null,
      target_tokens: [],
      target_category: 'all',
      target_location: null,
      target_price: 'any',
      target_rating: 'any',
      target_provider: 'any',
      target_available_now: false,
      target_sort: 'relevance',
      target_offset: 0,
      target_limit: 49,
    },
  );
});

test('nearby Service RPC arguments keep all common filters in parity and add only geo inputs', () => {
  const input = commonInput({ sort: 'nearest' });
  const normalShape = buildMarketplaceServiceDiscoveryRpcArgs(input);
  const nearbyShape = buildMarketplaceServiceNearbyRpcArgs({
    ...input,
    origin: { latitude: 10.7905, longitude: 78.7047 },
    nearMe: true,
  });
  const { origin_lat, origin_long, target_near_me, ...nearbyCommon } = nearbyShape;

  assert.equal(origin_lat, 10.7905);
  assert.equal(origin_long, 78.7047);
  assert.equal(target_near_me, true);
  assert.deepEqual(nearbyCommon, normalShape);
  assert.equal(nearbyShape.target_sort, 'nearest');
  assert.equal(nearbyShape.target_limit, 25);
});

test('nearby geo fallback preserves common RPC arguments and converts only nearest to relevance', () => {
  const nearbyInput = commonInput({ sort: 'nearest' });
  const nearbyArgs = buildMarketplaceServiceNearbyRpcArgs({
    ...nearbyInput,
    origin: { latitude: 10.7905, longitude: 78.7047 },
    nearMe: true,
  });
  const fallbackArgs = buildMarketplaceServiceDiscoveryRpcArgs({
    ...nearbyInput,
    sort: marketplaceServiceFallbackNormalSort(nearbyInput.sort),
  });
  const { origin_lat: _lat, origin_long: _long, target_near_me: _nearMe, target_sort: _nearbySort, ...nearbyCommon } = nearbyArgs;
  const { target_sort: fallbackSort, ...fallbackCommon } = fallbackArgs;

  assert.equal(nearbyArgs.target_sort, 'nearest');
  assert.equal(fallbackSort, 'relevance');
  assert.deepEqual(fallbackCommon, nearbyCommon);
  assert.equal('origin_lat' in fallbackArgs, false);
  assert.equal('origin_long' in fallbackArgs, false);
  assert.equal('target_near_me' in fallbackArgs, false);
});
