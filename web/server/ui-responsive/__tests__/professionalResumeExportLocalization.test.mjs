import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalResumeExport.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Professional Resume export uses shared identity localization without local bilingual helper', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.resumeExport\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 25, 'expected broad Professional Resume export localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Professional Resume export preserves profile and resume read contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/resume', { cache: 'no-store' })"));
  assert.ok(source.includes("profileBody.profile.provider_type !== 'professional'"));
  assert.ok(source.includes('setProfile(profileBody.profile)'));
  assert.ok(source.includes('setResume(resumeBody)'));
});

test('Professional Resume export preserves PDF/Print and date-range behavior', () => {
  assert.ok(source.includes('onClick={() => window.print()}'));
  assert.ok(source.includes("new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })"));
  assert.ok(source.includes("return [from, to].filter(Boolean).join(' – ')"));
  assert.ok(source.includes("range(item.start_date, item.end_date, item.is_current, locale"));
  assert.ok(source.includes("range(item.start_date, item.end_date, false, locale"));
});

test('Professional Resume export preserves rendered resume data sections', () => {
  assert.ok(source.includes('resume.career_profile?.career_headline'));
  assert.ok(source.includes('resume.career_profile?.career_summary'));
  assert.ok(source.includes('resume.skills.map'));
  assert.ok(source.includes('resume.experiences.map'));
  assert.ok(source.includes('resume.education.map'));
  assert.ok(source.includes('resume.certifications.map'));
  assert.ok(source.includes('resume.career_profile?.availability_note'));
});
