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

const { parseMarketplaceSearchIntent } = intentModule;
const { resolveMarketplaceServiceSearchSemantics } = semanticsModule;
const {
  boundedMarketplaceServiceInteger,
  marketplaceServiceDefaultPageSize,
  marketplaceServiceMaxPageSize,
  marketplaceServiceNearbySortModes,
  marketplaceServiceNormalSortModes,
  marketplaceServiceProviderFilters,
  normalizeMarketplaceServiceCategory,
  normalizeMarketplaceServiceLocation,
  normalizeMarketplaceServiceQuery,
  parseMarketplaceServiceFilter,
} = parsingModule;

function resolvePipeline(rawQuery) {
  const intent = parseMarketplaceSearchIntent(rawQuery);
  const semantics = resolveMarketplaceServiceSearchSemantics(intent.serviceQuery);
  return {
    ...intent,
    tokens: semantics.tokens,
    semanticQuery: semantics.semanticQuery,
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
