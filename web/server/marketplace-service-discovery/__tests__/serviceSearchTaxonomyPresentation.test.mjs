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

const presentationModule = await loadTypeScriptModule('../../../components/discovery/marketplaceTaxonomyPresentation.ts');
const {
  localizedMarketplaceCategoryLabel,
  localizedMarketplaceGroupLabel,
  marketplaceTamilAlias,
  marketplaceTaxonomyKey,
} = presentationModule;

const [taxonomyInputSource, livePresentationSource] = await Promise.all([
  readFile(new URL('../../../components/discovery/TaxonomySearchInput.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../../components/discovery/LiveMarketplacePresentation.tsx', import.meta.url), 'utf8'),
]);

test('taxonomy presentation keeps canonical English labels and uses the first Tamil alias only for Tamil display', () => {
  const plumbing = {
    name: 'Plumbing',
    group_name: 'Home Services',
    aliases: ['plumber', 'pipe repair', 'பிளம்பர்', 'குழாய் பழுது'],
  };

  assert.equal(localizedMarketplaceCategoryLabel(plumbing, 'en-IN'), 'Plumbing');
  assert.equal(localizedMarketplaceCategoryLabel(plumbing, 'ta-IN'), 'பிளம்பர்');
  assert.equal(marketplaceTamilAlias(plumbing.aliases), 'பிளம்பர்');
});

test('taxonomy presentation safely falls back to the canonical label when Tamil metadata is missing', () => {
  assert.equal(localizedMarketplaceCategoryLabel({ name: 'Plumbing', aliases: ['plumber'] }, 'ta-IN'), 'Plumbing');
  assert.equal(localizedMarketplaceCategoryLabel({ name: '  AC   Service  ', aliases: null }, 'en-IN'), 'AC Service');
  assert.equal(localizedMarketplaceCategoryLabel({ name: '', aliases: [] }, 'ta-IN'), 'Other');
});

test('canonical taxonomy key treats category code, slug, and name forms deterministically', () => {
  assert.equal(marketplaceTaxonomyKey('ac_service'), 'ac-service');
  assert.equal(marketplaceTaxonomyKey('AC Service'), 'ac-service');
  assert.equal(marketplaceTaxonomyKey('ac-service'), 'ac-service');
  assert.equal(marketplaceTaxonomyKey('Tyre & Puncture Repair'), 'tyre-puncture-repair');
});

test('Tamil taxonomy group presentation localizes known groups and preserves unknown canonical groups', () => {
  assert.equal(localizedMarketplaceGroupLabel('Home Services', 'ta-IN'), 'வீட்டு சேவைகள்');
  assert.equal(localizedMarketplaceGroupLabel('Technology & Digital', 'ta-IN'), 'தொழில்நுட்பம் & டிஜிட்டல்');
  assert.equal(localizedMarketplaceGroupLabel('Home Services', 'en-IN'), 'Home Services');
  assert.equal(localizedMarketplaceGroupLabel('Future Services', 'ta-IN'), 'Future Services');
});

test('taxonomy suggestion localization remains presentation-only and preserves canonical selection semantics', () => {
  assert.ok(taxonomyInputSource.includes('localizedMarketplaceCategoryLabel(suggestion, locale)'));
  assert.ok(taxonomyInputSource.includes('localizedMarketplaceGroupLabel(suggestion.group_name, locale)'));
  assert.ok(taxonomyInputSource.includes('onSuggestionSelect(suggestion.name)'));
  assert.ok(taxonomyInputSource.includes('onResolvedIntent?.(resolvedIntent?.name ?? null)'));
});

test('Service cards consume search-response category aliases through the same presentation helper', () => {
  assert.ok(livePresentationSource.includes('category_aliases?: string[]'));
  assert.ok(livePresentationSource.includes('localizedMarketplaceCategoryLabel({'));
  assert.ok(livePresentationSource.includes('aliases: service.category_aliases'));
});
