import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [customerAttention, customerDashboard, providerDashboard] = await Promise.all([
  readFile(new URL('components/account/CustomerSmartAttention.tsx', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
]);

test('Customer dashboard surfaces one Smart Attention card ahead of detailed inboxes', () => {
  assert.ok(customerDashboard.includes("import CustomerSmartAttention from './CustomerSmartAttention'"));
  assert.ok(customerDashboard.includes('<CustomerSmartAttention bookings={bookings} />'));
  assert.ok(customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />') < customerDashboard.indexOf('<CustomerProductOrderAttention'));
  assert.ok(customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />') < customerDashboard.indexOf('<CustomerAccountProposalSummary'));
});

test('Customer Smart Attention prioritizes explicit service and marketplace actions', () => {
  const completion = customerAttention.indexOf("kind: 'completion'");
  const proposal = customerAttention.indexOf("kind: 'proposal'");
  const message = customerAttention.indexOf("kind: 'message'");
  const order = customerAttention.indexOf("kind: 'order'");
  const service = customerAttention.indexOf("kind: 'service'");
  const clear = customerAttention.indexOf("kind: 'clear'");
  assert.ok(completion >= 0 && proposal > completion && message > proposal && order > message && service > order && clear > service);
  assert.ok(customerAttention.includes("booking.closeoutState === 'awaiting_customer'"));
  assert.ok(customerAttention.includes("fetch('/api/requirements'"));
  assert.ok(customerAttention.includes("fetch('/api/messages?workspace=customer'"));
  assert.ok(customerAttention.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
});

test('Customer Smart Attention deep-links to exact actionable objects and acknowledges scoped updates', () => {
  assert.ok(customerAttention.includes('/bookings/${encodeURIComponent(completion.bookingId)}#requirement-completion'));
  assert.ok(customerAttention.includes('/requirements/${encodeURIComponent(proposal.id)}?proposal='));
  assert.ok(customerAttention.includes('/messages?conversation=${encodeURIComponent(message.id)}'));
  assert.ok(customerAttention.includes('mark_requirement_proposals_read: true'));
  assert.ok(customerAttention.includes('mark_product_order_updates_read: true'));
});

test('Customer Smart Attention remains mobile-safe and progressive enhancement only', () => {
  assert.ok(customerAttention.includes('@media (max-width: 720px)'));
  assert.ok(customerAttention.includes('grid-template-columns: 1fr'));
  assert.ok(customerAttention.includes('min-height: 44px'));
  assert.ok(customerAttention.includes('Promise.allSettled'));
  assert.ok(!customerAttention.includes('Cashfree'));
  assert.ok(!customerAttention.includes('/api/pay'));
});

test('Provider Priority now opens the exact booking needing action', () => {
  assert.ok(providerDashboard.includes("booking.status === 'pending' ? 0 : booking.status === 'rescheduled' ? 1 : 2"));
  assert.ok(providerDashboard.includes('href: `/provider/bookings/${encodeURIComponent(booking.id)}`'));
  assert.ok(providerDashboard.includes('Confirm ${serviceLabel}'));
  assert.ok(providerDashboard.includes('Review the new time for ${serviceLabel}'));
  assert.ok(providerDashboard.includes('Finish the ${serviceLabel} service record'));
  assert.ok(providerDashboard.includes('[operations.needsAction, operations.upcoming, profile]'));
});

test('Provider no-action state deep-links to the exact next confirmed service', () => {
  assert.ok(providerDashboard.includes('href: `/provider/bookings/${encodeURIComponent(operations.upcoming[0].id)}`'));
  assert.ok(providerDashboard.includes("label: 'Your next service is ready'"));
});
