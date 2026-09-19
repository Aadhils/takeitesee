import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalPublicReadinessManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Public Readiness uses shared localization instead of local bilingual branching', () => {
  assert.ok(source.includes('const { t } = useIdentityWorkspaceTranslations();'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
  assert.ok(!source.includes('const text = useCallback'));
  assert.ok(!source.includes('text('));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.publicReadiness\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 70, 'expected shared public-readiness localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Public Readiness preserves profile, trust and offering contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile'"));
  assert.ok(source.includes("fetch('/api/provider/profile/roles'"));
  assert.ok(source.includes("fetch('/api/provider/resume'"));
  assert.ok(source.includes('marketplace_disclosure_complete'));
  assert.ok(source.includes('trust_status'));
  assert.ok(source.includes('services_paused'));
  assert.ok(source.includes('products_paused'));
  assert.ok(source.includes('/provider/verification'));
  assert.ok(source.includes('/account/support'));
});

test('Provider Public Readiness keeps Business and Professional branches', () => {
  assert.ok(source.includes("profile.provider_type === 'professional'"));
  assert.ok(source.includes("profile.provider_type === 'business'"));
  assert.ok(source.includes('/provider/products'));
  assert.ok(source.includes('/provider/services'));
  assert.ok(source.includes('/provider/resume'));
});
