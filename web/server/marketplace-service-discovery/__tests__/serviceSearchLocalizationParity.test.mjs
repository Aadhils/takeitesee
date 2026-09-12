import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const providerUrl = new URL('../../../components/i18n/LanguageProvider.tsx', import.meta.url);
const exploreUrl = new URL('../../../app/explore/page.tsx', import.meta.url);
const smartFiltersUrl = new URL('../../../components/discovery/ExploreSmartFilters.tsx', import.meta.url);
const presentationUrl = new URL('../../../components/discovery/LiveMarketplacePresentation.tsx', import.meta.url);

const [providerSource, exploreSource, smartFiltersSource, presentationSource] = await Promise.all([
  readFile(providerUrl, 'utf8'),
  readFile(exploreUrl, 'utf8'),
  readFile(smartFiltersUrl, 'utf8'),
  readFile(presentationUrl, 'utf8'),
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
const localizedMarketplaceKeys = (keys) => keys.filter((key) => key.startsWith('explore.') || key.startsWith('empty.')).sort();

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

test('English and Tamil Explore/Search translation catalogs keep exact key parity', () => {
  assert.deepEqual(localizedMarketplaceKeys(tamilKeys), localizedMarketplaceKeys(englishKeys));
});

test('Explore/Search localization catalog contains the hardened controls, recovery, geo and card keys', () => {
  for (const key of requiredExploreKeys) {
    assert.ok(englishKeys.includes(key), `English catalog missing ${key}`);
    assert.ok(tamilKeys.includes(key), `Tamil catalog missing ${key}`);
  }
});

test('Explore surfaces no longer embed the high-visibility bilingual copy that belongs in the catalog', () => {
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
  const explorePresentationSource = `${exploreSource}\n${smartFiltersSource}`;
  for (const phrase of forbidden) assert.equal(explorePresentationSource.includes(phrase), false, `Explore surface still embeds: ${phrase}`);

  assert.ok(smartFiltersSource.includes("t('explore.availabilityLabel')"));
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
