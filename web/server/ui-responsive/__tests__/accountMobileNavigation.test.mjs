import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, shellSource, cssSource, savedProductsSource, accountPageSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('app/account-mobile-navigation.css', root), 'utf8'),
  readFile(new URL('components/account/SavedProductsPage.tsx', root), 'utf8'),
  readFile(new URL('app/account/page.tsx', root), 'utf8'),
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

test('Overview uses the same account shell and suppresses the legacy duplicate mobile quick rail', () => {
  assert.ok(accountPageSource.includes('LocalizedAccountShell'));
  assert.ok(accountPageSource.includes('active="/account"'));
  assert.ok(accountPageSource.includes('<AuthenticatedAccount />'));
  assert.ok(cssSource.includes('.account-content .customer-mobile-quick-shell {\n    display: none !important;'));
});

test('account mobile navigation is contained and uses single-line compact labels', () => {
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'));
  assert.ok(cssSource.includes('.account-sidebar .account-desktop-nav {\n    display: none !important;'));
  assert.ok(cssSource.includes('.account-sidebar .account-mobile-nav {\n    display: grid !important;'));
  assert.ok(cssSource.includes('overflow: visible;'));
  assert.ok(cssSource.includes('min-height: 48px;'));
  assert.ok(cssSource.includes('white-space: nowrap;'));
  assert.ok(shellSource.includes("mobileLabel: locale === 'ta-IN' ? 'தேவைகள்' : 'Needs'"));
});

test('notification attention stays inside More and narrow phones use a compact anchored menu', () => {
  assert.ok(cssSource.includes('.account-mobile-more-count {\n    position: absolute;\n    top: 4px;\n    right: 4px;'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('width: min(260px, calc(100vw - 32px));'));
  assert.ok(cssSource.includes('max-height: min(46dvh, 330px);'));
  assert.ok(!cssSource.includes('bottom: calc(var(--responsive-mobile-nav-height) + 12px + env(safe-area-inset-bottom));'));
});

test('Saved Products empty state keeps the CTA attached and centered while data semantics remain unchanged', () => {
  assert.ok(savedProductsSource.includes('saved-products-empty-card'));
  assert.ok(savedProductsSource.includes('saved-products-empty-actions'));
  assert.ok(cssSource.includes('justify-content: center;'));
  assert.ok(savedProductsSource.includes("fetch('/api/account/saved-products'"));
  assert.ok(savedProductsSource.includes("method: 'DELETE'"));
  assert.ok(savedProductsSource.includes('href="/products"'));
});
