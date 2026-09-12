import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const localizationUrl = new URL('../../../components/discovery/categoriesLocalization.ts', import.meta.url);
const directoryUrl = new URL('../../../components/discovery/CanonicalPublicCategoriesDirectory.tsx', import.meta.url);

const [localizationSource, directorySource] = await Promise.all([
  readFile(localizationUrl, 'utf8'),
  readFile(directoryUrl, 'utf8'),
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

function objectKeys(source, declarationName) {
  const sourceFile = ts.createSourceFile('categoriesLocalization.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
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
          if (ts.isIdentifier(property.name)) return [property.name.text];
          if (ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name)) return [property.name.text];
          return [];
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.ok(keys, `Could not resolve ${declarationName} categories catalog`);
  return keys.sort();
}

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

const categoriesModule = await loadTypeScriptModule('../../../components/discovery/categoriesLocalization.ts');
const { categoriesTranslation, formatCategoriesTranslation } = categoriesModule;

const englishKeys = objectKeys(localizationSource, 'english');
const tamilKeys = objectKeys(localizationSource, 'tamil');

const requiredKeys = [
  'eyebrow',
  'unavailableTitle',
  'unavailableAlertTitle',
  'unavailableAlertBody',
  'title',
  'subtitle',
  'canonicalEyebrow',
  'summary',
  'serviceGroup',
  'liveCategory',
  'approvedCategory',
  'liveCountUnavailable',
  'activeServiceOne',
  'activeServiceMany',
  'liveDescription',
  'approvedDescription',
  'unifiedSearch',
  'searchCategory',
  'emptyTitle',
  'exploreMarketplace',
].sort();

test('Categories English and Tamil catalogs keep exact key parity', () => {
  assert.deepEqual(tamilKeys, englishKeys);
  assert.deepEqual(englishKeys, requiredKeys);
});

test('Categories translations and placeholders preserve locale-specific presentation', () => {
  assert.equal(categoriesTranslation('en-IN', 'eyebrow'), 'Service taxonomy');
  assert.equal(categoriesTranslation('ta-IN', 'eyebrow'), 'சேவை வகைப்பாடு');
  assert.equal(
    formatCategoriesTranslation(categoriesTranslation('en-IN', 'summary'), { approved: 57, live: 4 }),
    '57 approved specialties · 4 live now',
  );
  assert.equal(
    formatCategoriesTranslation(categoriesTranslation('ta-IN', 'liveDescription'), { category: 'பிளம்பர்' }),
    'பிளம்பர் வழங்கும் verified Professionals மற்றும் Businesses-ஐ தேடவும்.',
  );
});

test('Categories directory consumes centralized copy and preserves canonical taxonomy presentation/deep-links', () => {
  const forbiddenInlineCopy = [
    'Service taxonomy',
    'Category directory temporarily unavailable',
    'Browse approved TakeItEsee service categories.',
    'Canonical marketplace taxonomy',
    'Live count unavailable',
    'Professional + Business unified search',
    'Search category',
    'No approved service categories are available yet.',
  ];
  for (const phrase of forbiddenInlineCopy) {
    assert.equal(directorySource.includes(phrase), false, `Categories directory still embeds: ${phrase}`);
  }

  assert.ok(directorySource.includes("ct('eyebrow')"));
  assert.ok(directorySource.includes("ct('summary')"));
  assert.ok(directorySource.includes("ct('liveDescription')"));
  assert.ok(directorySource.includes('localizedMarketplaceCategoryLabel(category, locale)'));
  assert.ok(directorySource.includes('localizedMarketplaceGroupLabel(groupName, locale)'));
  assert.ok(directorySource.includes('`/explore?category=${encodeURIComponent(category.slug)}`'));
  assert.equal(directorySource.includes('const text ='), false);
});
