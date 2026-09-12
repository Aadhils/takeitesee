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

const prefillModule = await loadTypeScriptModule('../../../components/requirements/requirementExplorePrefill.ts');
const { resolveRequirementExploreContext } = prefillModule;
const requirementsSource = await readFile(new URL('../../../app/requirements/page.tsx', import.meta.url), 'utf8');

test('category-only Explore handoff recovers the canonical category code as service prefill', () => {
  assert.deepEqual(resolveRequirementExploreContext(
    'https://www.takeitesee.com/requirements?source=explore',
    'https://www.takeitesee.com/explore?category=software-it-support',
  ), {
    sourceExplore: true,
    rawSearch: '',
    explicitService: 'software-it-support',
    explicitLocation: '',
  });
});

test('explicit requirement parameters remain authoritative over Explore referrer context', () => {
  assert.deepEqual(resolveRequirementExploreContext(
    'https://www.takeitesee.com/requirements?source=explore&search=plumber&service=plumbing&location=Trichy',
    'https://www.takeitesee.com/explore?q=electrician&category=electrical-services&location=Madurai',
  ), {
    sourceExplore: true,
    rawSearch: 'plumber',
    explicitService: 'plumbing',
    explicitLocation: 'Trichy',
  });
});

test('same-origin Explore referrer fills only missing search, category and location context', () => {
  assert.deepEqual(resolveRequirementExploreContext(
    'https://www.takeitesee.com/requirements',
    'https://www.takeitesee.com/explore?q=tyre%20puncture&category=tyre-puncture&location=Tiruchirappalli',
  ), {
    sourceExplore: true,
    rawSearch: 'tyre puncture',
    explicitService: 'tyre-puncture',
    explicitLocation: 'Tiruchirappalli',
  });
});

test('all category and cross-origin referrers never become requirement service prefills', () => {
  assert.equal(resolveRequirementExploreContext(
    'https://www.takeitesee.com/requirements?source=explore',
    'https://www.takeitesee.com/explore?category=all',
  ).explicitService, '');

  assert.deepEqual(resolveRequirementExploreContext(
    'https://www.takeitesee.com/requirements',
    'https://example.com/explore?category=software-it-support&q=software',
  ), {
    sourceExplore: false,
    rawSearch: '',
    explicitService: '',
    explicitLocation: '',
  });
});

test('requirements page uses the shared resolver before existing taxonomy enrichment', () => {
  assert.ok(requirementsSource.includes("import { resolveRequirementExploreContext } from '../../components/requirements/requirementExplorePrefill';"));
  assert.ok(requirementsSource.includes('resolveRequirementExploreContext(window.location.href, document.referrer)'));
  assert.ok(requirementsSource.includes('normalized(category.code) === needle'));
  assert.ok(requirementsSource.includes("if (prefill.service) params.set('service', prefill.service)"));
});
