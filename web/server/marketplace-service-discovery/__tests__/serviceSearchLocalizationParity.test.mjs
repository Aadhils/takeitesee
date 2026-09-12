import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const providerUrl = new URL('../../../components/i18n/LanguageProvider.tsx', import.meta.url);
const exploreUrl = new URL('../../../app/explore/page.tsx', import.meta.url);
const presentationUrl = new URL('../../../components/discovery/LiveMarketplacePresentation.tsx', import.meta.url);
const categoriesUrl = new URL('../../../components/discovery/CanonicalPublicCategoriesDirectory.tsx', import.meta.url);

const [providerSource, exploreSource, presentationSource, categoriesSource] = await Promise.all([
  readFile(providerUrl, 'utf8'),
  readFile(exploreUrl, 'utf8'),
  readFile(presentationUrl, 'utf8'),
  readFile(categoriesUrl, 'utf8'),
]);

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
  ) current = current.expression;
  return current;
}

function catalogKeys(source, declarationName) {
  const sourceFile = ts.createSourceFile('LanguageProvider.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let keys = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === declarationName
      && node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        keys = initializer.properties.flatMap((property) => {
          if (!ts.isPropertyAssignment(property)) return [];
          if (ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name)) return [property.name.text];
          if (ts.isIdentifier(property.name)) return [property.name.text];
          return [];
        });
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.ok(keys, `Could not resolve ${declarationName} translation catalog`);
  return keys;
}

const englishKeys = catalogKeys(providerSource, 'english');
const tamilKeys = catalogKeys(providerSource, 'tamil');
const localizedMarketplaceKeys = (keys) => keys
  .filter((key) => key.startsWith('explore.') || key.startsWith('empty.') || key.startsWith('categories.'))
  .sort();

const requiredExploreKeys = [
  'explore.availabilityLabel',
  'explore.availabilityAny',
  'explore.availabilityNowOnly',
  'explore.nearbyRankingClear',
  'explore.clearCurrentLocation',
  'explore.useMyLocationNearby',
  'explore.useMyLocation',
  'explore.nearestFirst',
  'explore.locationIntentDetected',
  'explore.locationIntentOnly',
  'explore.nearMeIntent',
  'explore.availableNowIntent',
  'explore.namedLocationPause',
  'explore.nearbyPrivacy',
  'explore.loadMore',
  'explore.recoveryNamedTitle',
  'explore.recoveryNearbyQueryTitle',
  'explore.recoveryNearbyTitle',
  'explore.recoveryQueryTitle',
  'explore.recoveryFiltersTitle',
  'explore.recoveryNamedHelp',
  'explore.recoveryNearbyHelp',
  'explore.recoveryQueryHelp',
  'explore.recoveryFiltersHelp',
  'explore.recoveryBroadenLocation',
  'explore.recoveryBroadenCurrentLocation',
  'explore.recoveryBroadenFilters',
  'explore.recoveryClearSearch',
  'explore.geoUnsupported',
  'explore.geoPermissionDenied',
  'explore.geoPositionUnavailable',
  'explore.geoTimeout',
  'explore.geoUnable',
  'explore.geoFallback',
  'explore.resultsQueryOne',
  'explore.resultsQueryMany',
  'explore.resultsCount',
  'explore.card.availableNow',
  'explore.card.busyNow',
  'explore.card.paused',
  'explore.card.offline',
  'explore.card.shopOpen',
  'explore.card.shopClosed',
  'explore.card.verifiedProvider',
  'explore.card.within1km',
  'explore.card.distance1to3',
  'explore.card.distance3to7',
  'explore.card.distance7to15',
  'explore.card.distance15to30',
  'explore.card.distance30to60',
  'explore.card.over60km',
  'explore.card.travelsToYou',
  'explore.card.atProvider',
  'explore.card.providerFallback',
  'explore.card.ratingLabel',
  'explore.card.from',
  'explore.card.perHour',
  'explore.card.viewService',
  'empty.catalogUnavailable',
  'empty.tryLoadingAgain',
  'empty.tryAgain',
];

const requiredCategoryKeys = [
  'categories.eyebrow',
  'categories.title',
  'categories.unavailableTitle',
  'categories.subtitle',
  'categories.unavailableAlertTitle',
  'categories.unavailableAlertBody',
  'categories.canonicalEyebrow',
  'categories.summary',
  'categories.groupEyebrow',
  'categories.liveCategory',
  'categories.approvedCategory',
  'categories.liveCountUnavailable',
  'categories.activeServiceOne',
  'categories.activeServiceMany',
  'categories.liveDescription',
  'categories.readyDescription',
  'categories.unifiedSearch',
  'categories.searchCategory',
  'categories.emptyTitle',
  'categories.exploreMarketplace',
];

test('English and Tamil marketplace translation catalogs keep exact key parity', () => {
  assert.deepEqual(localizedMarketplaceKeys(tamilKeys), localizedMarketplaceKeys(englishKeys));
});

test('Explore/Search localization catalog contains the hardened controls, recovery, geo and card keys', () => {
  for (const key of requiredExploreKeys) {
    assert.ok(englishKeys.includes(key), `English catalog missing ${key}`);
    assert.ok(tamilKeys.includes(key), `Tamil catalog missing ${key}`);
  }
});

test('Categories localization catalog contains every directory presentation key in English and Tamil', () => {
  for (const key of requiredCategoryKeys) {
    assert.ok(englishKeys.includes(key), `English catalog missing ${key}`);
    assert.ok(tamilKeys.includes(key), `Tamil catalog missing ${key}`);
  }
});

test('Explore page no longer embeds the high-visibility bilingual copy that belongs in the catalog', () => {
  const forbidden = [
    'Live availability',
    'Any live status',
    'Available now only',
    'Use my location for nearby results',
    'Nearby ranking on · Clear',
    'Nearest first',
    'Location intent detected:',
    'No live match in',
    'Search beyond current location',
    'Load more services',
    'Nearby ranking is active for this browser session',
  ];
  for (const phrase of forbidden) assert.equal(exploreSource.includes(phrase), false, `Explore page still embeds: ${phrase}`);

  assert.ok(exploreSource.includes("t('explore.availabilityLabel')"));
  assert.ok(exploreSource.includes("t('explore.nearbyPrivacy')"));
  assert.ok(exploreSource.includes("t('explore.recoveryBroadenCurrentLocation')"));
});

test('Service card and discovery empty-state presentation use centralized localization keys', () => {
  const forbidden = [
    'Available now',
    'Busy now',
    'Verified provider',
    'Shop Open',
    'Travels to you',
    'Marketplace catalog unavailable',
    'Please try loading the marketplace again.',
  ];
  for (const phrase of forbidden) assert.equal(presentationSource.includes(phrase), false, `Presentation still embeds: ${phrase}`);

  assert.ok(presentationSource.includes("t('explore.card.availableNow')"));
  assert.ok(presentationSource.includes("t('explore.card.ratingLabel')"));
  assert.ok(presentationSource.includes("t('empty.catalogUnavailable')"));
});

test('Categories directory uses centralized translations instead of embedded English/Tamil copy', () => {
  const forbidden = [
    'Browse approved TakeItEsee service categories.',
    'Category directory temporarily unavailable',
    'Canonical marketplace taxonomy',
    'Approved category',
    'Professional + Business unified search',
    'No approved service categories are available yet.',
    'அங்கீகரிக்கப்பட்ட TakeItEsee சேவை வகைகளை பார்க்கவும்.',
    'அங்கீகரிக்கப்பட்ட வகை',
  ];
  for (const phrase of forbidden) assert.equal(categoriesSource.includes(phrase), false, `Categories directory still embeds: ${phrase}`);

  assert.equal(categoriesSource.includes('const text ='), false, 'Categories directory still defines a local bilingual text helper');
  assert.ok(categoriesSource.includes("t('categories.eyebrow')"));
  assert.ok(categoriesSource.includes("t('categories.summary')"));
  assert.ok(categoriesSource.includes("t('categories.liveDescription')"));
  assert.ok(categoriesSource.includes("t('categories.searchCategory')"));
});
