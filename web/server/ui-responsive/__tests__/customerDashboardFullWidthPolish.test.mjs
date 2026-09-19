import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const dashboard = await readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8');

test('Customer overview escapes the generic 700px account heading cap', () => {
  assert.ok(dashboard.includes('.customer-social-dashboard { width: 100%; max-width: none; }'));
  assert.ok(dashboard.includes('className="account-page-heading customer-social-dashboard"'));
});

test('Customer desktop uses a wider priority column and compact booking rail', () => {
  assert.ok(dashboard.includes('grid-template-columns: minmax(0, 1.55fr) minmax(260px, .72fr)'));
  assert.ok(dashboard.includes('className="customer-dashboard-main-column"'));
  assert.ok(dashboard.includes('className="customer-dashboard-side-rail"'));
  assert.ok(dashboard.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});

test('Customer desktop quick actions use one balanced six-item row', () => {
  assert.ok(dashboard.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
  assert.ok(dashboard.includes("href: '/bookings'"));
  assert.ok(dashboard.includes("href: '/orders'"));
  assert.ok(dashboard.includes("href: '/requirements'"));
  assert.ok(dashboard.includes("href: '/messages'"));
  assert.ok(dashboard.includes("href: '/explore'"));
  assert.ok(dashboard.includes("href: '/account/profile'"));
});

test('Customer mobile and tablet navigation behavior stays unchanged', () => {
  assert.ok(dashboard.includes('@media (max-width: 900px)'));
  assert.ok(dashboard.includes('.customer-dashboard-desktop-layout { display: block; margin-top: 10px; }'));
  assert.ok(dashboard.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(dashboard.includes('.customer-activity-strip { grid-template-columns: repeat(4, minmax(92px, 1fr)); overflow-x: auto; scrollbar-width: none; }'));
});

test('Full-width customer polish preserves booking semantics and finance boundaries', () => {
  assert.ok(dashboard.includes('getBookingsThroughConfiguredRepository(currentUser.id)'));
  assert.ok(dashboard.includes("['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)"));
  assert.ok(dashboard.includes("booking.status === 'completed'"));
  assert.ok(dashboard.includes("booking.status === 'cancelled'"));
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!dashboard.includes(term));
  }
});
