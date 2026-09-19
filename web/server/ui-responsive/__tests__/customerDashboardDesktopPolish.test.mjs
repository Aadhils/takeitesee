import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [dashboard, identityHeader, identityCss] = await Promise.all([
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.module.css', root), 'utf8'),
]);

test('Customer desktop dashboard uses a main workspace plus booking summary rail', () => {
  assert.ok(dashboard.includes('className="customer-dashboard-desktop-layout"'));
  assert.ok(dashboard.includes('className="customer-dashboard-main-column"'));
  assert.ok(dashboard.includes('className="customer-dashboard-side-rail"'));
  assert.ok(dashboard.includes('grid-template-columns: minmax(0, 1.55fr) minmax(260px, .72fr)'));
  assert.ok(dashboard.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
  assert.ok(dashboard.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
});

test('Customer desktop booking metrics are number-first tiles while routes stay unchanged', () => {
  assert.ok(dashboard.includes('className="customer-activity-strip"'));
  assert.ok(dashboard.includes('className="customer-activity-strip-item"'));
  assert.ok(dashboard.includes('order: -1'));
  assert.ok(dashboard.includes('font-size: 1.45rem'));
  assert.ok(dashboard.includes('<Link href="/bookings" className="customer-activity-strip-item"'));
  assert.ok(dashboard.includes('{summary.upcoming}'));
  assert.ok(dashboard.includes('{summary.completed}'));
  assert.ok(dashboard.includes('{summary.cancelled}'));
  assert.ok(dashboard.includes('{summary.total}'));
});

test('Customer Smart Attention and detailed activity ordering remain intact', () => {
  const smartAttention = dashboard.indexOf('<CustomerSmartAttention bookings={bookings} />');
  const secondaryActivity = dashboard.indexOf('<details className="customer-secondary-activity">');
  const quickActions = dashboard.indexOf('<section className="customer-dashboard-quick-actions"');
  assert.ok(smartAttention >= 0);
  assert.ok(secondaryActivity > smartAttention);
  assert.ok(quickActions > secondaryActivity);
  assert.ok(dashboard.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(dashboard.includes('<CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />'));
});

test('Customer identity hero compacts only on desktop without changing provider presentation', () => {
  assert.ok(identityHeader.includes("context === 'customer' ? styles.customerShell : ''"));
  assert.ok(identityCss.includes('@media (min-width: 901px)'));
  assert.ok(identityCss.includes('.customerShell .banner'));
  assert.ok(identityCss.includes('min-height: 112px'));
  assert.ok(identityCss.includes('@media (max-width: 720px)'));
  assert.ok(identityCss.includes('.banner {\n    min-height: 112px;'));
});

test('Mobile customer dashboard keeps the existing compact navigation behavior', () => {
  assert.ok(dashboard.includes('@media (max-width: 900px)'));
  assert.ok(dashboard.includes('.customer-dashboard-desktop-layout { display: block; margin-top: 10px; }'));
  assert.ok(dashboard.includes('.customer-dashboard-side-rail { position: static; display: block; }'));
  assert.ok(dashboard.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(dashboard.includes('.customer-activity-strip { grid-template-columns: repeat(4, minmax(92px, 1fr)); overflow-x: auto; scrollbar-width: none; }'));
  assert.ok(dashboard.includes('.customer-activity-strip-item strong { order: 0; font-size: 1rem; }'));
});

test('Customer desktop polish does not change booking data or finance boundaries', () => {
  assert.ok(dashboard.includes('getBookingsThroughConfiguredRepository(currentUser.id)'));
  assert.ok(dashboard.includes('getBookingsForCustomer(currentUser.id)'));
  assert.ok(dashboard.includes("['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)"));
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!dashboard.includes(term));
  }
});
