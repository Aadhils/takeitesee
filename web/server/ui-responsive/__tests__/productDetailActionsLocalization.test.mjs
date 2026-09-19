import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [share, saved, translations, page, shell] = await Promise.all([
  readFile(new URL('components/detail/ProductShareAction.tsx', root), 'utf8'),
  readFile(new URL('components/detail/SavedProductAction.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
  readFile(new URL('app/products/[productId]/page.tsx', root), 'utf8'),
  readFile(new URL('app/products/[productId]/ProductDetailShell.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Product detail actions use shared public-provider localization', () => {
  for (const source of [share, saved]) {
    assert.ok(source.includes('usePublicProviderTranslations'));
    assert.ok(!source.includes('useLanguage'));
    assert.ok(!source.includes('const tamil ='));
    assert.ok(!/[஀-௿]/u.test(source));
  }
  for (const key of [
    'publicProvider.productShare.byBusiness',
    'publicProvider.productShare.onPlatform',
    'publicProvider.productShare.shared',
    'publicProvider.productShare.copied',
    'publicProvider.productShare.action',
    'publicProvider.productShare.error',
    'publicProvider.savedProduct.signIn',
    'publicProvider.savedProduct.saved',
    'publicProvider.savedProduct.save',
    'publicProvider.savedProduct.loadError',
    'publicProvider.savedProduct.removeError',
    'publicProvider.savedProduct.saveError',
    'publicProvider.savedProduct.updateError',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Product share preserves canonical URL, attribution and native/fallback behavior', () => {
  assert.ok(share.includes('new URL(`/products/${productId}`, window.location.origin).toString()'));
  assert.ok(share.includes("replace('{productName}', productName)"));
  assert.ok(share.includes("replace('{businessName}', businessName)"));
  assert.ok(share.includes('title: productName'));
  assert.ok(share.includes("typeof navigator.share === 'function'"));
  assert.ok(share.includes('await navigator.share(shareData)'));
  assert.ok(share.includes("cause instanceof DOMException && cause.name === 'AbortError'"));
  assert.ok(share.includes('navigator.clipboard?.writeText'));
  assert.ok(share.includes("document.execCommand('copy')"));
  assert.ok(share.includes('await copyProductUrl(url)'));
  assert.ok(share.includes("setTimeout(() => setStatus('idle'), 3000)"));
});

test('Saved Product preserves read, auth return and save-toggle API semantics', () => {
  assert.ok(saved.includes('`/api/account/saved-products?product_id=${encodeURIComponent(productId)}`'));
  assert.ok(saved.includes('response.status === 401'));
  assert.ok(saved.includes('encodeURIComponent(`/products/${productId}`)'));
  assert.ok(saved.includes('href={`/login?returnTo=${returnTo}`}'));
  assert.ok(saved.includes("fetch('/api/account/saved-products'"));
  assert.ok(saved.includes("method: saved ? 'DELETE' : 'POST'"));
  assert.ok(saved.includes('JSON.stringify({ product_id: productId })'));
  assert.ok(saved.includes('if (busy) return'));
  assert.ok(saved.includes('setSaved((current) => !current)'));
  assert.ok(saved.includes('role="alert"'));
});

test('Product detail still renders both public actions and keeps finance out of the action components', () => {
  assert.ok(page.includes('<ProductDetailShell'));
  assert.ok(shell.includes('<SavedProductAction productId={productId} />'));
  assert.ok(shell.includes('<ProductShareAction'));
  assert.equal(share.includes('Cashfree'), false);
  assert.equal(saved.includes('Cashfree'), false);
  assert.equal(share.includes('/api/orders'), false);
  assert.equal(saved.includes('/api/orders'), false);
});
