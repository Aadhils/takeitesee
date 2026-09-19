import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalResumeWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Professional Resume workspace uses shared identity localization', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.resumeWorkspace\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 10, 'expected Professional Resume workspace localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Professional Resume workspace preserves profile, export and manager contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', { cache: 'no-store' })"));
  assert.ok(source.includes('href="/provider/resume/export"'));
  assert.ok(source.includes("profile?.provider_type === 'professional'"));
  assert.ok(source.includes('<ProfessionalResumeManager verified={profile.verified} />'));
});
