import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, adminResponsiveSource, superAdminShellSource, adminLiveSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/responsive-admin.css', root), 'utf8'),
  readFile(new URL('components/super-admin/SuperAdminShell.tsx', root), 'utf8'),
  readFile(new URL('app/admin/admin-live.css', root), 'utf8'),
]);

test('Admin responsive authority loads after the cross-site foundation', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const adminIndex = layoutSource.indexOf("import './responsive-admin.css';");
  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(adminIndex > foundationIndex, 'Admin responsive authority must load last');
});

test('Admin navigation and actions stay touch friendly on tablet and phone', () => {
  assert.ok(adminResponsiveSource.includes('@media (max-width: 980px)'));
  assert.ok(adminResponsiveSource.includes('.admin-sidebar nav'));
  assert.ok(adminResponsiveSource.includes('overflow-x: auto'));
  assert.ok(adminResponsiveSource.includes('overscroll-behavior-inline: contain'));
  assert.ok(adminResponsiveSource.includes('min-height: 44px'));
  assert.ok(adminResponsiveSource.includes("top: calc(64px + env(safe-area-inset-top))"));
});

test('Admin cards, settings and data tables collapse without clipping narrow screens', () => {
  for (const selector of ['.admin-record-grid', '.admin-settings-grid', '.admin-settings-save-row', '.admin-table-wrap', '.detail-list']) {
    assert.ok(adminResponsiveSource.includes(selector), `missing Admin responsive selector ${selector}`);
  }
  assert.ok(adminResponsiveSource.includes('grid-template-columns: 1fr !important'));
  assert.ok(adminResponsiveSource.includes('-webkit-overflow-scrolling: touch'));
  assert.ok(adminResponsiveSource.includes('min-width: 620px'));
});

test('Admin live moderation shortcut clears the fixed mobile navigation', () => {
  assert.ok(adminLiveSource.includes('.admin-live-moderation-shortcut'));
  assert.ok(adminResponsiveSource.includes('var(--responsive-mobile-nav-height, 68px)'));
  assert.ok(adminResponsiveSource.includes('env(safe-area-inset-bottom)'));
});

test('Super Admin navigation is swipe safe, touch safe and safe-area aware', () => {
  assert.ok(superAdminShellSource.includes('@media (max-width: 900px)'));
  assert.ok(superAdminShellSource.includes('overflow-x: auto'));
  assert.ok(superAdminShellSource.includes('min-height: 44px'));
  assert.ok(superAdminShellSource.includes('env(safe-area-inset-top)'));
  assert.ok(superAdminShellSource.includes('-webkit-overflow-scrolling: touch'));
});

test('Super Admin narrow workspace and handoff panels collapse to one column', () => {
  assert.ok(adminResponsiveSource.includes("section[aria-label='Super Admin workspaces']"));
  assert.ok(adminResponsiveSource.includes('.super-admin-content .container > section.card'));
  assert.ok(adminResponsiveSource.includes('align-items: stretch !important'));
});
