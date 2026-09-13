import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, shellSource, cssSource, savedProductsSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('app/account-mobile-navigation.css', root), 'utf8'),
  readFile(new URL('components/account/SavedProductsPage.tsx', root), 'utf8'),
]);

test('account mobile navigation polish loads after the shared responsive layers', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const accountIndex = layoutSource.indexOf("import './account-mobile-navigation.css';");
  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(accountIndex > foundationIndex, 'account mobile navigation polish must load after the responsive foundation');
});

test('mobile account navigation keeps four primary destinations and a More menu', () => {
  for (const href of ['/account', '/saved-services', '/saved-products', '/requirements']) {
    assert.ok(shellSource.includes(`'${href}'`), `missing primary account destination ${href}`);
  }
  assert.ok(shellSource.includes('account-desktop-nav'));
  assert.ok(shellSource.includes('account-mobile-nav'));
  assert.ok(shellSource.includes('account-mobile-more'));
  assert.ok(shellSource.includes('<details'));
  assert.ok(shellSource.includes("'/messages'"));
  assert.ok(shellSource.includes("'/notifications'"));
  assert.ok(shellSource.includes("'/account/settings'"));
  assert.ok(shellSource.includes('activeSecondaryLink'));
  assert.ok(shellSource.includes('account-mobile-more-count'));
});

test('account mobile navigation is contained instead of becoming a long horizontal rail', () => {
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'));
  assert.ok(cssSource.includes('.account-sidebar .account-desktop-nav {\n    display: none !important;'));
  assert.ok(cssSource.includes('.account-sidebar .account-mobile-nav {\n    display: grid !important;'));
  assert.ok(cssSource.includes('overflow: visible;'));
  assert.ok(cssSource.includes('min-height: 48px;'));
  assert.ok(cssSource.includes('max-height: min(60dvh, 440px);'));
});

test('narrow phones use a bottom-safe More menu without changing the global bottom navigation', () => {
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('position: fixed;'));
  assert.ok(cssSource.includes('bottom: calc(var(--responsive-mobile-nav-height) + 12px + env(safe-area-inset-bottom));'));
});

test('Saved Products empty state keeps the CTA attached and centered while data semantics remain unchanged', () => {
  assert.ok(savedProductsSource.includes('saved-products-empty-card'));
  assert.ok(savedProductsSource.includes('saved-products-empty-actions'));
  assert.ok(cssSource.includes('justify-content: center;'));
  assert.ok(savedProductsSource.includes("fetch('/api/account/saved-products'"));
  assert.ok(savedProductsSource.includes("method: 'DELETE'"));
  assert.ok(savedProductsSource.includes('href="/products"'));
});
