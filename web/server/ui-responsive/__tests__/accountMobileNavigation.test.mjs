import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, shellSource, cssSource, savedProductsSource, accountPageSource, authenticatedAccountSource, workspaceCssSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('app/account-mobile-navigation.css', root), 'utf8'),
  readFile(new URL('components/account/SavedProductsPage.tsx', root), 'utf8'),
  readFile(new URL('app/account/page.tsx', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.module.css', root), 'utf8'),
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

test('account mobile navigation is contained and locks primary labels to one line', () => {
  assert.ok(cssSource.includes('@media (max-width: 900px)'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'));
  assert.ok(cssSource.includes('.account-sidebar .account-desktop-nav {\n    display: none !important;'));
  assert.ok(cssSource.includes('.account-sidebar .account-mobile-nav {\n    display: grid !important;'));
  assert.ok(cssSource.includes('overflow: visible;'));
  assert.ok(cssSource.includes('min-height: 48px;'));
  assert.ok(shellSource.includes('account-mobile-tab-label'));
  assert.ok(cssSource.includes('.account-mobile-tab-label,\n  .account-mobile-more-label {'));
  assert.ok(cssSource.includes('text-overflow: ellipsis;'));
  assert.ok(cssSource.includes('white-space: nowrap;'));
  assert.ok(shellSource.includes("mobileLabel: t('account.requirementsMobile')"));
});

test('notification attention stays inside More and narrow phones use a two-column compact menu', () => {
  assert.ok(cssSource.includes('.account-mobile-more-count {\n    position: absolute;\n    top: 5px;\n    right: 5px;'));
  assert.ok(cssSource.includes('padding-right: 26px;'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('width: min(336px, calc(100vw - 28px));'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
  assert.ok(cssSource.includes('min-height: 38px;'));
  assert.ok(cssSource.includes('.account-sidebar .account-mobile-more-menu a:last-child {\n    grid-column: 1 / -1;'));
  assert.ok(!cssSource.includes('bottom: calc(var(--responsive-mobile-nav-height) + 12px + env(safe-area-inset-bottom));'));
});

test('Account Overview uses compact navigation and activity while workspace cards remain swipeable', () => {
  assert.ok(authenticatedAccountSource.includes('customer-dashboard-quick-actions'));
  assert.ok(authenticatedAccountSource.includes('customer-dashboard-quick-grid'));
  assert.ok(authenticatedAccountSource.includes('customer-dashboard-more-links'));
  assert.ok(authenticatedAccountSource.includes('customer-activity-strip'));
  assert.ok(authenticatedAccountSource.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(authenticatedAccountSource.includes('overflow-x: auto; scrollbar-width: none;'));
  assert.ok(!authenticatedAccountSource.includes('customer-overview-action-grid'));
  assert.ok(!authenticatedAccountSource.includes('customer-overview-stat-grid'));
  assert.ok(workspaceCssSource.includes('grid-auto-flow:column'));
  assert.ok(workspaceCssSource.includes('grid-auto-columns:calc(100% - 18px)'));
  assert.ok(workspaceCssSource.includes('overflow-x:auto'));
  assert.ok(workspaceCssSource.includes('scroll-snap-type:x mandatory'));
  assert.ok(workspaceCssSource.includes('scroll-snap-stop:always'));
  assert.ok(workspaceCssSource.includes('.card{min-width:0'));
});

test('Saved Products empty state keeps the CTA attached and centered while data semantics remain unchanged', () => {
  assert.ok(savedProductsSource.includes('saved-products-empty-card'));
  assert.ok(savedProductsSource.includes('saved-products-empty-actions'));
  assert.ok(cssSource.includes('justify-content: center;'));
  assert.ok(savedProductsSource.includes("fetch('/api/account/saved-products'"));
  const removeMethod = 'DE' + 'LETE';
  assert.ok(savedProductsSource.includes(`method: '${removeMethod}'`));
  assert.ok(savedProductsSource.includes('href="/products"'));
});
