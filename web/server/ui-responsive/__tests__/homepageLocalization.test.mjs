import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, searchForm] = await Promise.all([
  readFile(new URL('components/discovery/LocalizedHomepage.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/HomepageSearchForm.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'home.sloganLead','home.sloganTail','home.titleStart','home.titleMiddle','home.titleAccent','home.lede',
  'home.trustAria','home.verified','home.verifiedHelp','home.reviews','home.reviewsHelp','home.booking','home.bookingHelp',
  'home.catalog','home.catalogHelp','home.marketplace','home.exploreTitle','home.exploreHelp','home.exploreAction','home.browseAll',
  'home.path.home.title','home.path.home.description','home.path.business.title','home.path.business.description',
  'home.path.technology.title','home.path.technology.description','home.path.learning.title','home.path.learning.description',
  'home.path.all.title','home.path.all.description',
];

test('Homepage uses shared LanguageProvider localization with EN/TA parity', () => {
  assert.ok(source.includes('const { t } = useLanguage()'));
  assert.ok(!source.includes('const copy ='));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/\bconst tamil\b/.test(source));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 30);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Homepage preserves marketplace shortcut queries and explore routing', () => {
  for (const query of ["query: 'home'", "query: 'business'", "query: 'technology'", "query: 'learning'", "query: ''"]) {
    assert.ok(source.includes(query), query);
  }
  assert.ok(source.includes('`/explore?q=${encodeURIComponent(item.query)}`'));
  assert.ok(source.includes(": '/explore'"));
  assert.ok(source.includes('href="/explore"'));
  assert.ok(source.includes("key={item.query || 'all'}"));
});

test('Homepage keeps the existing search component and trust/category structure', () => {
  assert.equal((source.match(/<HomepageSearchForm \/>/g) || []).length, 1);
  assert.ok(source.includes('hero-trust-row'));
  assert.ok(source.includes('homepage-category-grid'));
  assert.ok(source.includes('category-heading'));
  assert.ok(searchForm.includes("action=\"/explore\""));
  assert.ok(searchForm.includes('navigateToExplore'));
});

test('Homepage localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
