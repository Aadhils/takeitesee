import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalResumeManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Professional Resume manager uses shared identity localization without local bilingual helper', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.resumeManager\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 100, 'expected broad Professional Resume manager localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Professional Resume manager preserves resume data and mutation contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/resume', { cache: 'no-store' })"));
  assert.ok(source.includes("async function send(method: 'POST' | 'PATCH' | 'DELETE'"));
  assert.ok(source.includes("send('PATCH', { section: 'profile', ...profileForm }, 'profile')"));
  assert.ok(source.includes("section: 'experience'"));
  assert.ok(source.includes("section: 'education'"));
  assert.ok(source.includes("section: 'certification'"));
  assert.ok(source.includes("section: 'skill'"));
  assert.ok(source.includes("send('DELETE', { section, id }"));
});

test('Professional Resume manager preserves publication and destructive-action safeguards', () => {
  assert.ok(source.includes('public_resume_enabled'));
  assert.ok(source.includes("window.confirm(t('provider.resumeManager.deleteThisResumeItem'))"));
  assert.ok(source.includes('verified'));
});
