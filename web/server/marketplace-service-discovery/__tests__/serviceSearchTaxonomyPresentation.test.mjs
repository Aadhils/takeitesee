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
  localizedMarketplaceCategoryLabelForSlug,
  localizedMarketplaceGroupLabel,
  marketplaceTamilAlias,
  marketplaceTaxonomyKey,
  marketplaceTaxonomyLookup,
} = presentationModule;

const [taxonomyInputSource, livePresentationSource, exploreSource, categoriesDirectorySource, publicCategoriesSource] = await Promise.all([
  readFile(new URL('../../../components/discovery/TaxonomySearchInput.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../../components/discovery/LiveMarketplacePresentation.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../../app/explore/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../../components/discovery/CanonicalPublicCategoriesDirectory.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../marketplace/public-categories.ts', import.meta.url), 'utf8'),
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
  assert.equal(marketplaceTaxonomyKey('software_it_support'), 'software-it-support');
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

test('Explore category dropdown localizes labels while preserving canonical server category slug values', () => {
  const taxonomy = [
    { code: 'plumbing', name: 'Plumbing', group_name: 'Home Services', aliases: ['plumber', 'பிளம்பர்'] },
    { code: 'software_it_support', name: 'Custom Software & IT Support', group_name: 'Technology & Digital', aliases: ['custom software', 'கஸ்டம் சாப்ட்வேர்'] },
  ];
  const lookup = marketplaceTaxonomyLookup(taxonomy);

  assert.equal(localizedMarketplaceCategoryLabelForSlug('plumbing', lookup, 'ta-IN'), 'பிளம்பர்');
  assert.equal(localizedMarketplaceCategoryLabelForSlug('software-it-support', lookup, 'ta-IN'), 'கஸ்டம் சாப்ட்வேர்');
  assert.equal(localizedMarketplaceCategoryLabelForSlug('software-it-support', lookup, 'en-IN'), 'Custom Software & IT Support');
  assert.equal(localizedMarketplaceCategoryLabelForSlug('legacy-category', lookup, 'ta-IN'), 'Legacy Category');

  assert.ok(exploreSource.includes('value={category} key={category}'));
  assert.ok(exploreSource.includes('localizedMarketplaceCategoryLabelForSlug(category, taxonomyLookup, locale)'));
  assert.ok(exploreSource.includes('<TaxonomySearchInput taxonomy={taxonomy}'));
});

test('public Categories directory uses canonical category-code identity, Tamil aliases, and canonical Explore filters', () => {
  assert.ok(publicCategoriesSource.includes(".select('id,category,category_code,provider_type"));
  assert.ok(publicCategoriesSource.includes('search_aliases'));
  assert.ok(publicCategoriesSource.includes('marketplaceTaxonomyKey(code || name)'));
  assert.ok(publicCategoriesSource.includes('canonicalSlugByLegacyNameSlug'));

  assert.ok(categoriesDirectorySource.includes('localizedMarketplaceCategoryLabel(category, locale)'));
  assert.ok(categoriesDirectorySource.includes('localizedMarketplaceGroupLabel(groupName, locale)'));
  assert.ok(categoriesDirectorySource.includes('`/explore?category=${encodeURIComponent(category.slug)}`'));
  assert.ok(!categoriesDirectorySource.includes('`/explore?q=${encodeURIComponent(category.name)}`'));
});
