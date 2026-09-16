import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, accountShellCss, accountSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/account-shell-signout-responsive.css', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
]);

test('account shell hardening loads after the existing account responsive layers', () => {
  const mobileNavigationIndex = layoutSource.indexOf("import './account-mobile-navigation.css';");
  const realDeviceIndex = layoutSource.indexOf("import './account-real-device-fix.css';");
  const hardeningIndex = layoutSource.indexOf("import './account-shell-signout-responsive.css';");
  assert.ok(mobileNavigationIndex >= 0);
  assert.ok(realDeviceIndex > mobileNavigationIndex);
  assert.ok(hardeningIndex > realDeviceIndex);
});

test('desktop explicitly suppresses the mobile account navigation', () => {
  assert.match(accountShellCss, /@media \(min-width: 901px\)[\s\S]*?\.account-sidebar \.account-mobile-nav\s*\{\s*display:\s*none !important/);
  assert.match(accountShellCss, /@media \(min-width: 901px\)[\s\S]*?\.account-sidebar \.account-desktop-nav\s*\{\s*display:\s*grid !important/);
});

test('signed-out account state collapses the authenticated sidebar and becomes a centered auth surface', () => {
  assert.ok(accountSource.includes('href="/login" className="button button-primary"'));
  assert.ok(accountSource.includes('href="/signup" className="button button-secondary"'));
  assert.ok(accountShellCss.includes('a[href="/login"].button-primary'));
  assert.match(accountShellCss, /> \.account-sidebar\s*\{\s*display:\s*none !important/);
  assert.match(accountShellCss, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(accountShellCss, /> \.account-content\s*\{[\s\S]*?width:\s*min\(100%, 720px\)[\s\S]*?margin-inline:\s*auto/);
});

test('signed-out mobile account keeps auth actions touch-safe and above fixed bottom navigation', () => {
  assert.match(accountShellCss, /@media \(max-width: 900px\)[\s\S]*?padding-bottom:\s*calc\(var\(--responsive-mobile-nav-height, 72px\) \+ env\(safe-area-inset-bottom\) \+ 28px\)/);
  assert.match(accountShellCss, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(accountShellCss, /\.account-actions \.button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(accountShellCss, /@media \(max-width: 390px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});
