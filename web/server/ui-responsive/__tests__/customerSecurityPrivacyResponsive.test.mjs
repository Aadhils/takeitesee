import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [securityRouteSource, privacyRouteSource, cssSource] = await Promise.all([
  readFile(new URL('app/account/security/page.tsx', root), 'utf8'),
  readFile(new URL('app/account/privacy/page.tsx', root), 'utf8'),
  readFile(new URL('components/account/CustomerSecurityPrivacyResponsive.module.css', root), 'utf8'),
]);

test('Customer Security and Privacy routes share the focused responsive wrapper', () => {
  for (const source of [securityRouteSource, privacyRouteSource]) {
    assert.ok(source.includes('CustomerSecurityPrivacyResponsive.module.css'));
    assert.ok(source.includes('securityPrivacyJourney'));
  }
});

test('Customer Security and Privacy styles cover tablet and phone layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('admin-record-top'));
  assert.ok(cssSource.includes('account-details'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('Customer Security workflow contracts remain present', () => {
  assert.ok(securityRouteSource.includes('signInWithSupabase'));
  assert.ok(securityRouteSource.includes('updatePasswordWithSupabase'));
  assert.ok(securityRouteSource.includes('updateEmailWithSupabase'));
  assert.ok(securityRouteSource.includes('currentPassword === newPassword'));
  assert.ok(securityRouteSource.includes('/forgot-password'));
  assert.ok(securityRouteSource.includes('/login?returnTo=%2Faccount%2Fsecurity'));
});

test('Customer Privacy workflow contracts remain present', () => {
  assert.ok(privacyRouteSource.includes("fetch('/api/account/privacy-requests'"));
  assert.ok(privacyRouteSource.includes("method: 'POST'"));
  assert.ok(privacyRouteSource.includes("request_type: requestType"));
  assert.ok(privacyRouteSource.includes("'access' | 'correction' | 'deletion'"));
  assert.ok(privacyRouteSource.includes('/login?returnTo=%2Faccount%2Fprivacy'));
  assert.ok(privacyRouteSource.includes('Deletion request does not immediately delete your account'));
});
