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
  const schedule = customerAttention.indexOf("kind: 'schedule'");
  const message = customerAttention.indexOf("kind: 'message'");
  const order = customerAttention.indexOf("kind: 'order'");
  const service = customerAttention.indexOf("kind: 'service'");
  const clear = customerAttention.indexOf("kind: 'clear'");
  assert.ok(completion >= 0 && proposal > completion && schedule > proposal && message > schedule && order > message && service > order && clear > service);
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


test('Customer Smart Attention catches awarded services that still need a schedule', () => {
  assert.ok(customerAttention.includes("row.status === 'awarded'"));
  assert.ok(customerAttention.includes("/api/requirements/${encodeURIComponent(row.id)}/job"));
  assert.ok(customerAttention.includes('(payload.jobs ?? []).length > 0'));
  assert.ok(customerAttention.includes("kind: 'schedule'"));
  assert.ok(customerAttention.includes('Provider chosen — choose your service time'));
  assert.ok(customerAttention.includes('/requirements/${encodeURIComponent(unscheduledRequirement.id)}#requirement-service-job'));
  assert.ok(customerAttention.includes('Choose service time'));
});


test('Customer dashboard keeps detailed proposal and order activity collapsed behind one secondary control', () => {
  assert.ok(customerDashboard.includes('<details className="customer-secondary-activity">'));
  assert.ok(customerDashboard.includes("tamil ? 'மேலும் activity' : 'More activity'"));
  assert.ok(customerDashboard.includes('Proposals, order updates & history'));
  assert.ok(customerDashboard.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(customerDashboard.includes('<CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />'));
  assert.ok(
    customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />')
      < customerDashboard.indexOf('<details className="customer-secondary-activity">'),
  );
});

test('Customer secondary activity stays compact and touch-safe on mobile', () => {
  assert.ok(customerDashboard.includes('.customer-secondary-activity > summary {'));
  assert.ok(customerDashboard.includes('min-height: 58px'));
  assert.ok(customerDashboard.includes('.customer-secondary-activity-count'));
  assert.ok(customerDashboard.includes('.customer-secondary-activity[open] .customer-secondary-activity-caret'));
  assert.ok(customerDashboard.includes('@media (max-width: 900px)'));
  assert.ok(customerDashboard.includes('min-height: 54px'));
  assert.ok(customerDashboard.includes('text-overflow: ellipsis'));
});


test('Customer dashboard replaces large navigation cards with compact quick actions', () => {
  assert.ok(customerDashboard.includes('className="customer-dashboard-quick-actions"'));
  assert.ok(customerDashboard.includes('className="customer-dashboard-quick-grid"'));
  assert.ok(customerDashboard.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
  assert.ok(customerDashboard.includes("href: '/bookings'"));
  assert.ok(customerDashboard.includes("href: '/orders'"));
  assert.ok(customerDashboard.includes("href: '/requirements'"));
  assert.ok(customerDashboard.includes("href: '/messages'"));
  assert.ok(customerDashboard.includes("href: '/explore'"));
  assert.ok(customerDashboard.includes("href: '/account/profile'"));
  assert.ok(!customerDashboard.includes('customer-overview-action-grid'));
  assert.ok(!customerDashboard.includes('customer-overview-action-card'));
});

test('Customer dashboard folds low-frequency destinations into More shortcuts', () => {
  assert.ok(customerDashboard.includes('className="customer-dashboard-more-links"'));
  assert.ok(customerDashboard.includes("tamil ? 'மேலும் shortcuts' : 'More shortcuts'"));
  assert.ok(customerDashboard.includes("href: '/notifications'"));
  assert.ok(customerDashboard.includes("href: '/saved-services'"));
  assert.ok(customerDashboard.includes("href: '/saved-products'"));
  assert.ok(customerDashboard.includes("href: '/account/settings'"));
  assert.ok(customerDashboard.includes("href: '/account/support'"));
  assert.ok(customerDashboard.includes("href: '/account/reports'"));
});

test('Customer booking statistics are one compact activity strip instead of four cards', () => {
  assert.ok(customerDashboard.includes('className="customer-activity-strip"'));
  assert.ok(customerDashboard.includes('className="customer-activity-strip-item"'));
  assert.ok(customerDashboard.includes('{summary.upcoming}'));
  assert.ok(customerDashboard.includes('{summary.completed}'));
  assert.ok(customerDashboard.includes('{summary.cancelled}'));
  assert.ok(customerDashboard.includes('{summary.total}'));
  assert.ok(!customerDashboard.includes('customer-overview-stat-grid'));
  assert.ok(!customerDashboard.includes('customer-overview-stat-card'));
});

test('Customer compact navigation avoids duplicate mobile navigation and stays horizontally safe', () => {
  assert.ok(customerDashboard.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(customerDashboard.includes('.customer-activity-strip { grid-template-columns: repeat(4, minmax(92px, 1fr)); overflow-x: auto;'));
  assert.ok(customerDashboard.includes('.customer-dashboard-more-links > summary { min-height: 44px; }'));
  assert.ok(customerDashboard.includes('.customer-dashboard-more-link-row a { min-height: 38px; }'));
  assert.ok(customerDashboard.includes('className="customer-mobile-quick-shell"'));
});
