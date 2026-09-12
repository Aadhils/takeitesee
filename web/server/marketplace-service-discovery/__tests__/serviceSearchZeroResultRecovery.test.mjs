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

const recoveryModule = await loadTypeScriptModule('../../../components/discovery/marketplaceZeroResultRecovery.ts');
const { resolveMarketplaceZeroResultRecovery } = recoveryModule;

function recovery(overrides = {}) {
  return resolveMarketplaceZeroResultRecovery({
    loading: false,
    hasError: false,
    resultCount: 0,
    queryPresent: false,
    locationPresent: false,
    categoryPresent: false,
    hasNarrowingFilters: false,
    otherNarrowingFiltersPresent: false,
    preciseNearbyActive: false,
    ...overrides,
  });
}

test('named-location zero result exposes broaden-location recovery', () => {
  assert.deepEqual(recovery({ queryPresent: true, locationPresent: true }), {
    show: true,
    mode: 'named_location',
    showBroadenLocation: true,
    showClearNearby: false,
    showClearCategory: false,
    showBroadenFilters: false,
    showClearQuery: false,
  });
});

test('precise-nearby zero result can broaden back to normal marketplace ranking', () => {
  assert.deepEqual(recovery({ preciseNearbyActive: true }), {
    show: true,
    mode: 'nearby',
    showBroadenLocation: false,
    showClearNearby: true,
    showClearCategory: false,
    showBroadenFilters: false,
    showClearQuery: false,
  });
});

test('query-only zero result gets query-specific clear-search recovery', () => {
  assert.deepEqual(recovery({ queryPresent: true }), {
    show: true,
    mode: 'query',
    showBroadenLocation: false,
    showClearNearby: false,
    showClearCategory: false,
    showBroadenFilters: false,
    showClearQuery: true,
  });
});

test('approved category-only zero result gets category-specific recovery', () => {
  assert.deepEqual(recovery({ categoryPresent: true, hasNarrowingFilters: true }), {
    show: true,
    mode: 'category',
    showBroadenLocation: false,
    showClearNearby: false,
    showClearCategory: true,
    showBroadenFilters: false,
    showClearQuery: false,
  });
});

test('category plus other filters offers related-service and broad-filter recovery', () => {
  assert.deepEqual(recovery({
    categoryPresent: true,
    hasNarrowingFilters: true,
    otherNarrowingFiltersPresent: true,
  }), {
    show: true,
    mode: 'category',
    showBroadenLocation: false,
    showClearNearby: false,
    showClearCategory: true,
    showBroadenFilters: true,
    showClearQuery: false,
  });
});

test('filter-only zero result keeps broaden-filter recovery', () => {
  assert.deepEqual(recovery({ hasNarrowingFilters: true, otherNarrowingFiltersPresent: true }), {
    show: true,
    mode: 'filters',
    showBroadenLocation: false,
    showClearNearby: false,
    showClearCategory: false,
    showBroadenFilters: true,
    showClearQuery: false,
  });
});

test('query plus category keeps query context and still offers broad-filter recovery', () => {
  assert.deepEqual(recovery({
    queryPresent: true,
    categoryPresent: true,
    hasNarrowingFilters: true,
  }), {
    show: true,
    mode: 'query',
    showBroadenLocation: false,
    showClearNearby: false,
    showClearCategory: false,
    showBroadenFilters: true,
    showClearQuery: true,
  });
});

test('generic empty catalog does not masquerade as a recovery state', () => {
  assert.equal(recovery().show, false);
});

test('loading, errors, and non-empty results suppress recovery actions', () => {
  assert.equal(recovery({ queryPresent: true, loading: true }).show, false);
  assert.equal(recovery({ queryPresent: true, hasError: true }).show, false);
  assert.equal(recovery({ queryPresent: true, resultCount: 1 }).show, false);
});
