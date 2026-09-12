import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [identityCss, storefrontCss, mediaHeaderCss, productDetailSource, storefrontProductsSource, foundationCss] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderIdentity.module.css', root), 'utf8'),
  readFile(new URL('components/detail/BusinessStorefrontQuickBook.module.css', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.module.css', root), 'utf8'),
  readFile(new URL('app/products/[productId]/page.tsx', root), 'utf8'),
  readFile(new URL('components/detail/BusinessStorefrontProducts.tsx', root), 'utf8'),
  readFile(new URL('app/responsive-foundation.css', root), 'utf8'),
]);

test('public provider identity wraps navigation and long identity text on narrow screens', () => {
  assert.match(identityCss, /\.breadcrumbs ol\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(identityCss, /\.breadcrumbs a\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(identityCss, /\.description,\s*\n\.location\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.ok(identityCss.includes('@media (max-width: 390px)'));
});

test('business storefront cards stack facts and preserve touch-friendly actions', () => {
  assert.match(storefrontCss, /\.locationLine\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(storefrontCss, /\.actions :global\(\.button\)\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(storefrontCss, /@media \(max-width: 390px\)[\s\S]*?\.serviceFacts div\s*\{[\s\S]*?display:\s*grid/);
  assert.match(storefrontCss, /@media \(max-width: 640px\)[\s\S]*?\.actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test('identity media controls meet touch target requirements and collapse safely', () => {
  assert.match(mediaHeaderCss, /\.mediaButton,[\s\S]*?min-height:\s*44px/);
  assert.match(mediaHeaderCss, /\.avatarEdit\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/);
  assert.match(mediaHeaderCss, /\.secondaryButton,[\s\S]*?min-height:\s*44px/);
  assert.match(mediaHeaderCss, /@media \(max-width: 390px\)[\s\S]*?\.avatarControls\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test('product detail and storefront product actions retain existing wrap-safe layout contracts', () => {
  assert.ok(productDetailSource.includes("flexWrap: 'wrap'"));
  assert.ok(storefrontProductsSource.includes("gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'"));
  assert.ok(storefrontProductsSource.includes("aspectRatio: '4 / 3'"));
});

test('customer and public pages remain protected by the global responsive foundation', () => {
  for (const selector of ['.service-grid', '.category-grid', '.product-grid', '.professional-grid', '.business-grid']) {
    assert.ok(foundationCss.includes(selector), `responsive foundation missing ${selector}`);
  }
  assert.ok(foundationCss.includes('grid-template-columns: 1fr !important'));
  assert.ok(foundationCss.includes('--responsive-touch-target: 44px'));
});
