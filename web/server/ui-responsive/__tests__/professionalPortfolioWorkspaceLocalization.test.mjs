import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalPortfolioWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Professional Portfolio workspace uses shared identity localization without local bilingual helper', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.portfolioWorkspace\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 9, 'expected Professional Portfolio workspace localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Professional Portfolio workspace preserves provider profile and role reads', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/profile/roles', { cache: 'no-store' })"));
  assert.ok(source.includes("profileBody.profile.provider_type === 'professional'"));
  assert.ok(source.includes('roleItems = rolesBody.roles ?? []'));
});

test('Professional Portfolio workspace preserves identity-specific rendering and manager handoff', () => {
  assert.ok(source.includes("profile?.provider_type === 'business'"));
  assert.ok(source.includes("profile?.provider_type === 'professional'"));
  assert.ok(source.includes('<ProfessionalPortfolioMediaManager professionalId={profile.id} roles={roles} verified={profile.verified} />'));
  assert.ok(source.includes('<LiveProviderShell active="/provider/portfolio">'));
});
