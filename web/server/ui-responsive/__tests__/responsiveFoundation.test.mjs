import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, foundationSource, appShellSource, providerCssSource, superAdminSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/responsive-foundation.css', root), 'utf8'),
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.module.css', root), 'utf8'),
  readFile(new URL('components/super-admin/SuperAdminShell.tsx', root), 'utf8'),
]);

test('responsive foundation is loaded after legacy polish layers', () => {
  const legacyIndex = layoutSource.indexOf("import './ui-polish.css';");
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  assert.ok(legacyIndex >= 0, 'ui-polish.css import missing');
  assert.ok(foundationIndex > legacyIndex, 'responsive foundation must load after UI polish');
});

test('responsive foundation covers desktop, tablet, phone and narrow-phone breakpoints', () => {
  for (const breakpoint of ['1100px', '900px', '760px', '640px', '390px']) {
    assert.ok(foundationSource.includes(`max-width: ${breakpoint}`), `missing ${breakpoint} breakpoint`);
  }
});

test('touch, safe-area and mobile input ergonomics are locked', () => {
  assert.ok(foundationSource.includes('--responsive-touch-target: 44px'));
  assert.ok(foundationSource.includes('env(safe-area-inset-bottom)'));
  assert.ok(foundationSource.includes('env(safe-area-inset-top)'));
  assert.ok(foundationSource.includes('font-size: 16px'));
  assert.ok(foundationSource.includes('.mobile-bottom-nav'));
  assert.ok(foundationSource.includes('.back-to-top'));
});

test('mobile language selector keeps enough width for readable locale labels', () => {
  assert.ok(foundationSource.includes('width: 92px;\n    max-width: 92px;'));
  assert.ok(foundationSource.includes('width: 88px;\n    max-width: 88px;'));
  assert.ok(!foundationSource.includes('max-width: 76px;'), 'narrow-phone locale control must not clip English');
});

test('mobile navigation remains fixed and menu becomes viewport-safe', () => {
  assert.ok(appShellSource.includes('className="mobile-bottom-nav"'));
  assert.ok(appShellSource.includes('menu-trigger'));
  assert.ok(appShellSource.includes('aria-expanded={menuOpen}'));
  assert.ok(foundationSource.includes('max-height: min(72dvh, 560px)'));
  assert.ok(foundationSource.includes('position: absolute'));
  assert.ok(foundationSource.includes('overscroll-behavior: contain'));
});

test('cards, discovery filters and common grids collapse safely on phones', () => {
  for (const selector of ['.service-grid', '.category-grid', '.product-grid', '.dashboard-stat-grid', '.discovery-filter-fields', '.form-grid']) {
    assert.ok(foundationSource.includes(selector), `responsive foundation missing ${selector}`);
  }
  assert.ok(foundationSource.includes('grid-template-columns: 1fr !important'));
  assert.ok(foundationSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});

test('provider and super-admin workspaces retain their dedicated responsive contracts', () => {
  assert.ok(providerCssSource.includes('@media (max-width: 780px)'));
  assert.ok(providerCssSource.includes('@media (max-width: 560px)'));
  assert.ok(superAdminSource.includes('@media (max-width: 900px)'));
  assert.ok(superAdminSource.includes('overflow-x: auto'));
});
