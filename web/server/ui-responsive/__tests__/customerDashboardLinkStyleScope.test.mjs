import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const dashboard = await readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8');

test('Customer dashboard Link tiles use global styled-jsx scope', () => {
  assert.ok(dashboard.includes('<style jsx global>'));
  assert.ok(!dashboard.includes('<style jsx>'));
});

test('Quick Actions keep card styling for Next Link rendered anchors', () => {
  assert.ok(dashboard.includes('.customer-dashboard-quick-link {'));
  assert.ok(dashboard.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
  assert.ok(dashboard.includes('border-radius: 16px'));
  assert.ok(dashboard.includes('box-shadow: var(--shadow-sm)'));
});

test('Booking summary Links keep tile styling', () => {
  assert.ok(dashboard.includes('.customer-activity-strip-item {'));
  assert.ok(dashboard.includes('min-height: 88px'));
  assert.ok(dashboard.includes('.customer-activity-strip-item strong { order: -1;'));
  assert.ok(dashboard.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});

test('Customer link style scope fix preserves routes and mobile behavior', () => {
  for (const href of ["/bookings", "/orders", "/requirements", "/messages", "/explore", "/account/profile"]) {
    assert.ok(dashboard.includes("href: '" + href + "'"));
  }
  assert.ok(dashboard.includes('@media (max-width: 900px)'));
  assert.ok(dashboard.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(dashboard.includes('.customer-activity-strip-item { min-height: 54px;'));
});

test('Customer Link style scope fix remains UI-only', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!dashboard.includes(term));
  }
});
