import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderIdentityHero.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Public Provider identity hero uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(publicProvider\.hero\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 12, 'expected broad public-provider hero localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Public Provider identity hero preserves public identity presentation contracts', () => {
  assert.ok(source.includes('<Link href="/explore">'));
  assert.ok(source.includes('bannerUrl ? <img className={styles.bannerImage}'));
  assert.ok(source.includes('avatarUrl'));
  assert.ok(source.includes('initials(displayName, kind)'));
  assert.ok(source.includes('description || fallbackDescription'));
  assert.ok(source.includes("location || t('publicProvider.hero.serviceAreaBooking')"));
});

test('Public Provider identity hero preserves business and professional identity branches', () => {
  assert.ok(source.includes("kind === 'business'"));
  assert.ok(source.includes("t('publicProvider.hero.businessProvider')"));
  assert.ok(source.includes("t('publicProvider.hero.professionalProvider')"));
  assert.ok(source.includes("t('publicProvider.hero.verifiedBusinessFallback')"));
  assert.ok(source.includes("t('publicProvider.hero.independentProfessionalFallback')"));
  assert.ok(source.includes("t('publicProvider.hero.businessLogoAlt')"));
  assert.ok(source.includes("t('publicProvider.hero.profilePictureAlt')"));
});
