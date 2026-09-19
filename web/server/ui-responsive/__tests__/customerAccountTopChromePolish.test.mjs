import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [navCss, identityCss, identity] = await Promise.all([
  readFile(new URL('app/account-mobile-navigation.css', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.module.css', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8'),
]);

test('Customer account top tabs are compact while retaining a 44px touch target', () => {
  assert.ok(navCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'));
  assert.ok(navCss.includes('min-height: 44px;'));
  assert.ok(navCss.includes('font-size: .7rem;'));
  assert.ok(navCss.includes('@media (max-width: 640px)'));
  assert.ok(navCss.includes('font-size: .64rem;'));
});

test('Customer banner action gets lighter narrow-screen styling without shrinking the generic touch target', () => {
  assert.ok(identityCss.includes('.mediaButton,\n  .mediaButtonDanger {\n    min-height: 44px;'));
  assert.ok(identityCss.includes('.customerShell .mediaButton,\n  .customerShell .mediaButtonDanger {'));
  assert.ok(identityCss.includes('background: rgba(18, 25, 48, .58);'));
  assert.ok(identityCss.includes('font-size: .66rem;'));
});

test('Customer banner action still uses the existing identity media flow', () => {
  assert.ok(identity.includes("chooseUpload('banner')"));
  assert.ok(identity.includes("hasBanner ? t('identity.media.changeBanner') : t('identity.media.addBanner')"));
  assert.ok(identity.includes("method: 'PATCH'"));
  assert.ok(identity.includes("method: 'DELETE'"));
});

test('Top chrome polish remains presentation-only', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', '/api/recurrence']) {
    assert.ok(!navCss.includes(term));
    assert.ok(!identityCss.includes(term));
  }
});
