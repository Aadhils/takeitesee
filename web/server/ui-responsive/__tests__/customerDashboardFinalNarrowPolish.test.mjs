import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [dashboard, accountCss, identityCss] = await Promise.all([
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('app/account-overview-stage4-polish.css', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.module.css', root), 'utf8'),
]);

test('Customer narrow-screen hides the duplicate welcome heading', () => {
  assert.ok(accountCss.includes('.account-content > .customer-social-dashboard > h1 {'));
  assert.ok(accountCss.includes('display: none !important;'));
});

test('Customer-only identity hero is shorter on narrow screens without changing Provider defaults', () => {
  assert.ok(identityCss.includes('@media (max-width: 720px)'));
  assert.ok(identityCss.includes('.banner {\n    min-height: 112px;'));
  assert.ok(identityCss.includes('.customerShell .banner {\n    min-height: 96px;'));
  assert.ok(identityCss.includes('@media (max-width: 390px)'));
  assert.ok(identityCss.includes('.customerShell .banner {\n    min-height: 92px;'));
});

test('Customer identity flows into Smart Attention with less narrow-screen whitespace', () => {
  assert.ok(dashboard.includes('.customer-dashboard-desktop-layout { display: block; margin-top: 6px; }'));
  assert.ok(dashboard.includes('.customer-dashboard-identity-hero { margin-top: 0; }'));
  assert.ok(dashboard.includes('<CustomerSmartAttention bookings={bookings} />'));
});

test('Customer sign-out remains contained while using tighter mobile spacing', () => {
  assert.ok(accountCss.includes('margin-top: 4px;'));
  assert.ok(accountCss.includes('padding-top: 6px;'));
  assert.ok(accountCss.includes('min-height: 38px;'));
  assert.ok(accountCss.includes('border-radius: 999px;'));
});

test('Final narrow-screen polish stays presentation-only', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', '/api/recurrence']) {
    assert.ok(!accountCss.includes(term));
    assert.ok(!identityCss.includes(term));
  }
});
