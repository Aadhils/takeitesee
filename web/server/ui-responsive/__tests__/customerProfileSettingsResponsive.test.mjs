import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [profileRouteSource, settingsRouteSource, workspaceSource, cssSource] = await Promise.all([
  readFile(new URL('app/account/profile/page.tsx', root), 'utf8'),
  readFile(new URL('app/account/settings/page.tsx', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountProfileSettings.tsx', root), 'utf8'),
  readFile(new URL('components/account/CustomerProfileSettingsResponsive.module.css', root), 'utf8'),
]);

test('Customer Profile and Settings routes share the focused responsive wrapper', () => {
  for (const source of [profileRouteSource, settingsRouteSource]) {
    assert.ok(source.includes('CustomerProfileSettingsResponsive.module.css'));
    assert.ok(source.includes('accountProfileSettingsJourney'));
    assert.ok(source.includes('getCurrentCustomerAsync'));
  }
});

test('Customer Profile and Settings styles cover tablet and phone layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('profile-detail-grid'));
  assert.ok(cssSource.includes('settings-grid'));
  assert.ok(cssSource.includes('profile-summary'));
  assert.ok(cssSource.includes('account-actions'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Customer Profile and Settings workflow contracts remain present', () => {
  assert.ok(workspaceSource.includes('saveCustomerProfile'));
  assert.ok(workspaceSource.includes('saveAccountSettings'));
  assert.ok(workspaceSource.includes('active="/account/profile"'));
  assert.ok(workspaceSource.includes('active="/account/settings"'));
  assert.ok(profileRouteSource.includes('IdentityHandleManager context="customer"'));
  assert.ok(profileRouteSource.includes('/login?returnTo=%2Faccount%2Fprofile'));
  assert.ok(settingsRouteSource.includes('/login?returnTo=%2Faccount%2Fsettings'));
  assert.ok(settingsRouteSource.includes('href="/account/security"'));
  assert.ok(settingsRouteSource.includes('href="/account/privacy"'));
});
