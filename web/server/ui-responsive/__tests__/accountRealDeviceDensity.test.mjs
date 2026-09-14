import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, fallbackSource, workspaceSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/account-real-device-fix.css', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.module.css', root), 'utf8'),
]);

test('Account real-device fallback loads after the normal Account mobile layer', () => {
  const normalIndex = layoutSource.indexOf("import './account-mobile-navigation.css';");
  const fallbackIndex = layoutSource.indexOf("import './account-real-device-fix.css';");
  assert.ok(normalIndex >= 0, 'normal Account mobile layer missing');
  assert.ok(fallbackIndex > normalIndex, 'real-device fallback must load last');
});

test('Account overview root contains wide children while keeping local swipe rails', () => {
  assert.ok(fallbackSource.includes('.customer-social-dashboard {'));
  assert.ok(fallbackSource.includes('max-width: 100%;'));
  assert.ok(fallbackSource.includes('min-width: 0;'));
  assert.ok(fallbackSource.includes('overflow-x: clip;'));
  assert.ok(fallbackSource.includes('.customer-social-dashboard > :not(style) {'));
  assert.ok(fallbackSource.includes('overflow-wrap: anywhere;'));
});

test('Account overview actions use a deliberate snap rail with only an edge hint on phones', () => {
  assert.ok(fallbackSource.includes('.customer-social-dashboard > .dashboard-grid {'));
  assert.ok(fallbackSource.includes('display: flex !important;'));
  assert.ok(fallbackSource.includes('scroll-snap-type: x mandatory;'));
  assert.ok(fallbackSource.includes('scroll-padding-inline: 2px 14px;'));
  assert.ok(fallbackSource.includes('flex: 0 0 min(92vw, 344px);'));
  assert.ok(fallbackSource.includes('scroll-snap-stop: always;'));
});

test('Account workspace cards use the same edge-hint snap treatment', () => {
  assert.ok(workspaceSource.includes('grid-auto-columns:min(92vw,344px)'));
  assert.ok(workspaceSource.includes('scroll-snap-type:x mandatory'));
  assert.ok(workspaceSource.includes('scroll-padding-inline:2px 14px'));
  assert.ok(workspaceSource.includes('scroll-snap-stop:always'));
  assert.ok(workspaceSource.includes('padding:0 14px 6px 2px'));
});

test('Account booking metrics stay as a compact 2 by 2 grid on phones', () => {
  assert.ok(fallbackSource.includes('.customer-social-dashboard > .dashboard-stat-grid {'));
  assert.ok(fallbackSource.includes('display: grid !important;'));
  assert.ok(fallbackSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'));
  assert.ok(fallbackSource.includes('min-height: 0 !important;'));
});
