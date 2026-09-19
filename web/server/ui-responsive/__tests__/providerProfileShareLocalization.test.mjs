import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, professional, business] = await Promise.all([
  readFile(new URL('components/detail/ProviderProfileShareAction.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
  readFile(new URL('components/detail/ProfessionalPublicProfileContent.tsx', root), 'utf8'),
  readFile(new URL('components/detail/BusinessPublicProfileContent.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider profile share action uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  for (const key of [
    'publicProvider.profile.verifiedBusiness',
    'publicProvider.profile.verifiedProfessional',
    'publicProvider.share.businessDescriptor',
    'publicProvider.share.professionalDescriptor',
    'publicProvider.share.shared',
    'publicProvider.share.copied',
    'publicProvider.share.action',
    'publicProvider.share.error',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Provider profile share action preserves canonical current-page URL sharing', () => {
  assert.ok(source.includes('new URL(window.location.href).toString()'));
  assert.ok(source.includes('title: `${name} | TakeItEsee`'));
  assert.ok(source.includes('text: `${name} — ${descriptor}`'));
  assert.ok(source.includes('url,'));
});

test('Provider profile share action preserves native share and clipboard fallback behavior', () => {
  assert.ok(source.includes("typeof navigator.share === 'function'"));
  assert.ok(source.includes('await navigator.share(shareData)'));
  assert.ok(source.includes("cause instanceof DOMException && cause.name === 'AbortError'"));
  assert.ok(source.includes('navigator.clipboard?.writeText'));
  assert.ok(source.includes("document.execCommand('copy')"));
  assert.ok(source.includes('await copyProfileUrl(url)'));
  assert.ok(source.includes("setStatus('error')"));
  assert.ok(source.includes("setTimeout(() => setStatus('idle'), 3000)"));
});

test('Provider profile share action remains shared by Professional and Business public profiles', () => {
  assert.ok(professional.includes('<ProviderProfileShareAction'));
  assert.ok(professional.includes('kind="professional"'));
  assert.ok(business.includes('<ProviderProfileShareAction'));
  assert.ok(business.includes('kind="business"'));
});
