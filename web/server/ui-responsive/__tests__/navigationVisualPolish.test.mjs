import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [appShellSource, foundationSource] = await Promise.all([
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('app/responsive-foundation.css', root), 'utf8'),
]);

test('global mobile navigation uses a consistent SVG icon system instead of unicode glyphs', () => {
  assert.ok(appShellSource.includes('type ShellIconKey'));
  assert.ok(appShellSource.includes('function ShellIcon'));
  assert.ok(appShellSource.includes('className="shell-icon"'));
  assert.ok(appShellSource.includes('className="mobile-nav-icon"'));
  assert.ok(!appShellSource.includes("icon: '⌂'"));
  assert.ok(!appShellSource.includes("icon: '⌕'"));
  assert.ok(!appShellSource.includes("icon: '▣'"));
  assert.ok(!appShellSource.includes('>◯</span>'));
});

test('mobile menu entries expose icon, label and active visual hooks', () => {
  assert.ok(appShellSource.includes('className="mobile-menu-icon"'));
  assert.ok(appShellSource.includes('className="mobile-menu-label"'));
  assert.ok(appShellSource.includes('<ShellIcon name="products" />'));
  assert.ok(appShellSource.includes('<ShellIcon name="userPlus" />'));
  assert.ok(appShellSource.includes('.mobile-menu a:hover, .mobile-menu a.nav-active'));
});

test('menu trigger exposes open-state animation without replacing accessible expanded state', () => {
  assert.ok(appShellSource.includes("menu-trigger${menuOpen ? ' menu-trigger-open' : ''}"));
  assert.ok(appShellSource.includes('aria-expanded={menuOpen}'));
  assert.ok(appShellSource.includes('.menu-trigger-open span:nth-child(1)'));
  assert.ok(appShellSource.includes('.menu-trigger-open span:nth-child(2)'));
  assert.ok(appShellSource.includes('.menu-trigger-open span:nth-child(3)'));
});

test('shell navigation has explicit keyboard focus visibility', () => {
  assert.ok(appShellSource.includes('.header-login:focus-visible'));
  assert.ok(appShellSource.includes('.menu-trigger:focus-visible'));
  assert.ok(appShellSource.includes('.mobile-menu a:focus-visible'));
  assert.ok(appShellSource.includes('.mobile-bottom-nav a:focus-visible'));
});

test('cards share focus, hover and touch-device interaction contracts', () => {
  assert.ok(foundationSource.includes(':focus-within'));
  assert.ok(foundationSource.includes('.discovery-card'));
  assert.ok(foundationSource.includes('.professional-card'));
  assert.ok(foundationSource.includes('.business-card'));
  assert.ok(foundationSource.includes('transform: translateY(-2px)'));
  assert.ok(foundationSource.includes('@media (hover: none) and (pointer: coarse)'));
  assert.ok(foundationSource.includes('transform: none'));
});
