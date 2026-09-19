import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [presentation, styles, loader, translations] = await Promise.all([
  readFile(new URL('components/detail/BusinessShopPublicStatusPresentation.tsx', root), 'utf8'),
  readFile(new URL('components/detail/BusinessShopPublicStatusPresentation.module.css', root), 'utf8'),
  readFile(new URL('components/detail/BusinessShopPublicStatus.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Business shop status keeps the existing open/closed signal semantics', () => {
  assert.ok(presentation.includes("const open = shopState === 'open'"));
  assert.ok(presentation.includes("tone={open ? 'success' : 'neutral'}"));
  assert.ok(presentation.includes("t('publicProvider.businessShopStatus.note')"));
  assert.ok(presentation.includes("t('publicProvider.businessShopStatus.openBadge')"));
  assert.ok(presentation.includes("t('publicProvider.businessShopStatus.closedBadge')"));
});

test('Business shop status uses shared public-provider localization without local locale branching', () => {
  assert.ok(presentation.includes('usePublicProviderTranslations'));
  assert.ok(presentation.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!presentation.includes('useLanguage'));
  assert.ok(!presentation.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(presentation));

  for (const key of [
    'publicProvider.businessShopStatus.storefront',
    'publicProvider.businessShopStatus.openTitle',
    'publicProvider.businessShopStatus.closedTitle',
    'publicProvider.businessShopStatus.note',
    'publicProvider.businessShopStatus.openBadge',
    'publicProvider.businessShopStatus.closedBadge',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Business shop status keeps its read-only server loader unchanged', () => {
  assert.ok(loader.includes(".from('business_shop_status')"));
  assert.ok(loader.includes(".select('shop_state')"));
  assert.equal(loader.includes('.update('), false);
  assert.equal(loader.includes('.insert('), false);
  assert.equal(loader.includes('.delete('), false);
});

test('Business shop status long copy wraps and stacks on mobile', () => {
  assert.ok(styles.includes('overflow-wrap: anywhere'));
  assert.ok(styles.includes('word-break: break-word'));
  assert.ok(styles.includes('@media (max-width: 640px)'));
  assert.ok(styles.includes('flex-direction: column'));
  assert.ok(styles.includes('@media (max-width: 390px)'));
  assert.ok(styles.includes('width: 100%'));
});
