import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/detail/PublicProfileJumpNav.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Public profile jump navigation uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [
    'publicProvider.jumpNav.quickNavigation',
    'publicProvider.jumpNav.about',
    'publicProvider.jumpNav.talents',
    'publicProvider.jumpNav.career',
    'publicProvider.jumpNav.work',
    'publicProvider.jumpNav.services',
    'publicProvider.jumpNav.products',
  ];
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Public profile jump navigation preserves Professional and Business target mapping', () => {
  for (const selector of [
    '.profile-layout main .detail-section',
    '#professional-talents-heading',
    '#professional-career-heading',
    '#professional-work-showcase-heading',
    '.profile-services',
    '#business-storefront-heading',
    'section[aria-label="Business products"]',
  ]) {
    assert.ok(source.includes(selector));
  }
  assert.ok(source.includes("kind === 'professional' ? professionalItems : businessItems"));
});

test('Public profile jump navigation preserves discovery, active tracking and smooth scrolling', () => {
  assert.ok(source.includes('resolved = items.flatMap((item) =>'));
  assert.ok(source.includes('setAvailable(new Set(resolved.map(({ item }) => item.id)))'));
  assert.ok(source.includes('candidate.target.getBoundingClientRect().top <= offset'));
  assert.ok(source.includes("window.addEventListener('scroll', scheduleActiveUpdate, { passive: true })"));
  assert.ok(source.includes("scrollIntoView({ behavior: 'smooth', block: 'start' })"));
  assert.ok(source.includes("aria-current={activeId === item.id ? 'location' : undefined}"));
  assert.ok(source.includes('t(item.key)'));
});
