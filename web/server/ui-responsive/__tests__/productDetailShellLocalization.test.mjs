import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, shell, translations] = await Promise.all([
  readFile(new URL('app/products/[productId]/page.tsx', root), 'utf8'),
  readFile(new URL('app/products/[productId]/ProductDetailShell.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Product detail visible shell uses shared localization', () => {
  assert.ok(shell.includes("'use client'"));
  assert.ok(shell.includes('usePublicProviderTranslations'));
  assert.ok(!shell.includes('useLanguage'));
  assert.ok(!/[஀-௿]/u.test(shell));
  for (const key of [
    'publicProvider.productDetail.browseProducts',
    'publicProvider.productDetail.eyebrow',
    'publicProvider.productDetail.descriptionFallback',
    'publicProvider.productDetail.soldBy',
    'publicProvider.productDetail.viewStorefront',
    'publicProvider.productDetail.backMarketplace',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Product detail shell preserves public destinations and actions', () => {
  assert.ok(shell.includes('href="/products"'));
  assert.ok(shell.includes('href={`/businesses/${encodeURIComponent(businessId)}`}'));
  assert.ok(shell.includes('href={storefrontHref}'));
  assert.ok(shell.includes('<SavedProductAction productId={productId} />'));
  assert.ok(shell.includes('<ProductShareAction'));
  assert.ok(shell.includes("t('publicProvider.profile.verifiedBusiness')"));
  assert.ok(shell.includes("replace('{businessName}', displayBusinessName)"));
});

test('Product detail server page keeps data authority, metadata and structured data server-side', () => {
  assert.ok(page.includes("createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })"));
  assert.ok(page.includes(".from('business_products')"));
  assert.ok(page.includes(".from('businesses')"));
  assert.ok(page.includes('hasMarketplaceDisclosure(business)'));
  assert.ok(page.includes('export async function generateMetadata'));
  assert.ok(page.includes("type=\"application/ld+json\""));
  assert.ok(page.includes("const canonical = `${siteUrl}/products/${encodeURIComponent(product.id)}`"));
  assert.ok(page.includes("'@type': 'Product'"));
  assert.ok(page.includes("'@type': 'Offer'"));
  assert.ok(page.includes("'@type': 'LocalBusiness'"));
});

test('Product detail server page passes presentation data without changing storefront/order composition', () => {
  assert.ok(page.includes('<ProductDetailShell'));
  assert.ok(page.includes('businessName={business.name}'));
  assert.ok(page.includes('businessLocation={business.location}'));
  assert.ok(page.includes('description={product.description}'));
  assert.ok(page.includes('storefrontHref={storefrontHref}'));
  assert.ok(page.includes('<BusinessShopPublicStatus businessId={product.business_id} />'));
  assert.ok(page.includes('<BusinessStorefrontProducts products={['));
  assert.ok(page.includes("unit_label: product.unit_label || 'item'"));
  assert.ok(page.includes('stock_mode: product.stock_mode'));
});
