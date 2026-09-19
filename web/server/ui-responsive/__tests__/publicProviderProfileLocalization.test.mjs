import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderProfile.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Public Provider profile uses shared public-provider localization without local bilingual copy', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { locale, t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(publicProvider\.(?:profile|hero)\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 60, 'expected broad public-provider profile localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Public Provider profile preserves provider-kind, talent and opportunity semantics', () => {
  assert.ok(source.includes("kind === 'business'"));
  assert.ok(source.includes("kind === 'professional'"));
  assert.ok(source.includes('roles.flatMap(opportunityLabels)'));
  assert.ok(source.includes('role.service_bookings_enabled'));
  assert.ok(source.includes('role.freelance_enabled'));
  assert.ok(source.includes('role.part_time_enabled'));
  assert.ok(source.includes('role.full_time_enabled'));
  assert.ok(source.includes('role.contract_enabled'));
});

test('Public Provider profile preserves career, media and service rendering data', () => {
  assert.ok(source.includes('career.experiences.map'));
  assert.ok(source.includes('career.education.map'));
  assert.ok(source.includes('career.certifications.map'));
  assert.ok(source.includes('career.skills.map'));
  assert.ok(source.includes('media.map'));
  assert.ok(source.includes('services.map'));
  assert.ok(source.includes('href={`/services/${service.id}`}'));
  assert.ok(source.includes('safeWebsite(item.credential_url)'));
});

test('Public Provider profile preserves locale formatting and disclosure contact destinations', () => {
  assert.ok(source.includes('new Intl.NumberFormat(locale'));
  assert.ok(source.includes('new Intl.DateTimeFormat(locale'));
  assert.ok(source.includes('safeWebsite(provider.website_url)'));
  assert.ok(source.includes('`mailto:${provider.public_contact_email}`'));
  assert.ok(source.includes('`tel:${provider.public_contact_phone}`'));
  assert.ok(source.includes('`mailto:${provider.grievance_email}`'));
  assert.ok(source.includes('`tel:${provider.grievance_phone}`'));
});
