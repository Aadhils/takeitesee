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

const copyModule = await loadTypeScriptModule('../../../components/discovery/marketplaceCategoryZeroResultCopy.ts');
const { marketplaceCategoryZeroResultCopy } = copyModule;
const exploreSource = await readFile(new URL('../../../app/explore/page.tsx', import.meta.url), 'utf8');

test('category zero-result copy renders canonical category labels in English and Tamil', () => {
  assert.deepEqual(marketplaceCategoryZeroResultCopy('en-IN', 'Custom Software & IT Support'), {
    title: 'No live providers yet for “Custom Software & IT Support”',
    help: 'This approved category is ready for discovery, but no live provider is available yet. Browse related services or post a requirement so providers can respond.',
    browseRelated: 'Browse related services',
  });

  assert.deepEqual(marketplaceCategoryZeroResultCopy('ta-IN', 'தனிப்பயன் மென்பொருள் & IT ஆதரவு'), {
    title: '“தனிப்பயன் மென்பொருள் & IT ஆதரவு” வகையில் இன்னும் நேரடி சேவை வழங்குநர்கள் இல்லை',
    help: 'இந்த அங்கீகரிக்கப்பட்ட வகை தேடலுக்கு தயாராக உள்ளது; ஆனால் தற்போது நேரடி சேவை வழங்குநர் இல்லை. தொடர்புடைய சேவைகளை பார்க்கலாம் அல்லது வழங்குநர்கள் பதிலளிக்க தேவையை பதிவிடலாம்.',
    browseRelated: 'தொடர்புடைய சேவைகளை பாருங்கள்',
  });
});

test('category zero-result copy keeps the same semantic surface in both locales', () => {
  for (const locale of ['en-IN', 'ta-IN']) {
    const copy = marketplaceCategoryZeroResultCopy(locale, 'Example Category');
    assert.deepEqual(Object.keys(copy).sort(), ['browseRelated', 'help', 'title']);
    assert.ok(copy.title.includes('Example Category'));
    assert.ok(copy.help.length > 20);
    assert.ok(copy.browseRelated.length > 5);
  }
});

test('Explore wires category-aware recovery without hard-coded bilingual copy', () => {
  assert.ok(exploreSource.includes("marketplaceCategoryZeroResultCopy(locale, selectedCategoryLabel)"));
  assert.ok(exploreSource.includes('categoryPresent: categoryFilterActive'));
  assert.ok(exploreSource.includes('otherNarrowingFiltersPresent'));
  assert.ok(exploreSource.includes('zeroResultRecovery.showClearCategory'));
  assert.ok(exploreSource.includes('onClick={clearCategory}'));
  assert.ok(exploreSource.includes('categoryRecoveryCopy.browseRelated'));
  assert.equal(exploreSource.includes('No live providers yet for'), false);
  assert.equal(exploreSource.includes('இன்னும் நேரடி சேவை வழங்குநர்கள் இல்லை'), false);
});
