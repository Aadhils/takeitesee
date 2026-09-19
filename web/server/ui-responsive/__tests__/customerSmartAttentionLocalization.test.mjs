import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [attention, translations] = await Promise.all([
  readFile(new URL('components/account/CustomerSmartAttention.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/OperationalTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'customer.attention.completionTitle',
  'customer.attention.completionBody',
  'customer.attention.actionNeeded',
  'customer.attention.proposalTitle',
  'customer.attention.proposalBody',
  'customer.attention.new',
  'customer.attention.scheduleTitle',
  'customer.attention.scheduleBody',
  'customer.attention.conversation',
  'customer.attention.messageTitle',
  'customer.attention.messageContinue',
  'customer.attention.unread',
  'customer.attention.orderTitle',
  'customer.attention.orderBody',
  'customer.attention.waitingTitle',
  'customer.attention.nextServiceTitle',
  'customer.attention.waitingBody',
  'customer.attention.waiting',
  'customer.attention.nextUp',
  'customer.attention.clearTitle',
  'customer.attention.clearBody',
  'customer.attention.clearBadge',
  'customer.attention.reviewService',
  'customer.attention.reviewProposal',
  'customer.attention.chooseServiceTime',
  'customer.attention.openMessage',
  'customer.attention.reviewOrderUpdate',
  'customer.attention.openServiceJourney',
  'customer.attention.exploreServices',
  'customer.attention.eyebrow',
  'customer.attention.allUpdates',
];

test('Customer Smart Attention uses shared operational localization', () => {
  assert.ok(attention.includes('useOperationalTranslations'));
  assert.ok(attention.includes('const { t } = useOperationalTranslations()'));
  assert.ok(!attention.includes('const tamil ='));
  assert.ok(!attention.includes("locale.toLowerCase().startsWith('ta')"));
  assert.ok(!/[஀-௿]/u.test(attention));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(attention.includes("t('" + key + "')"));
  }
});

test('Customer Smart Attention preserves strict priority order', () => {
  const completion = attention.indexOf("kind: 'completion'");
  const proposal = attention.indexOf("kind: 'proposal'");
  const schedule = attention.indexOf("kind: 'schedule'");
  const message = attention.indexOf("kind: 'message'");
  const order = attention.indexOf("kind: 'order'");
  const service = attention.indexOf("kind: 'service'");
  const clear = attention.indexOf("kind: 'clear'");
  assert.ok(completion >= 0 && proposal > completion && schedule > proposal && message > schedule && order > message && service > order && clear > service);
  assert.ok(attention.includes("booking.closeoutState === 'awaiting_customer'"));
  assert.ok(attention.includes("booking.attendanceOutcome !== 'customer_no_show'"));
  assert.ok(attention.includes("booking.attendanceOutcome !== 'provider_no_show'"));
});

test('Customer Smart Attention preserves discovery and scheduling data semantics', () => {
  assert.ok(attention.includes("fetch('/api/requirements'"));
  assert.ok(attention.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
  assert.ok(attention.includes("fetch('/api/messages?workspace=customer'"));
  assert.ok(attention.includes("row.status === 'awarded'"));
  assert.ok(attention.includes("/api/requirements/${encodeURIComponent(row.id)}/job"));
  assert.ok(attention.includes('(payload.jobs ?? []).length > 0'));
  assert.ok(attention.includes('Promise.allSettled'));
  assert.ok(attention.includes('window.setInterval(refresh, 60_000)'));
});

test('Customer Smart Attention preserves exact destinations and scoped acknowledgements', () => {
  assert.ok(attention.includes('/bookings/${encodeURIComponent(completion.bookingId)}#requirement-completion'));
  assert.ok(attention.includes('/requirements/${encodeURIComponent(proposal.id)}?proposal='));
  assert.ok(attention.includes('/requirements/${encodeURIComponent(unscheduledRequirement.id)}#requirement-service-job'));
  assert.ok(attention.includes('/messages?conversation=${encodeURIComponent(message.id)}'));
  assert.ok(attention.includes("latestOrder?.target_path?.startsWith('/orders/')"));
  assert.ok(attention.includes('mark_requirement_proposals_read: true'));
  assert.ok(attention.includes('mark_product_order_updates_read: true'));
  assert.ok(attention.includes("window.dispatchEvent(new Event('notifications-attention-refresh'))"));
  assert.ok(attention.includes("window.dispatchEvent(new Event('customer-product-order-attention-refresh'))"));
});

test('Customer Smart Attention preserves mobile-safe progressive enhancement and finance boundary', () => {
  assert.ok(attention.includes('@media (max-width: 720px)'));
  assert.ok(attention.includes('grid-template-columns: 1fr'));
  assert.ok(attention.includes('min-height: 42px'));
  assert.ok(attention.includes("attention.kind !== 'service' && attention.kind !== 'schedule'"));
  assert.ok(attention.includes("router.push('/notifications')"));
  assert.ok(!attention.includes('Cashfree'));
  assert.ok(!attention.includes('/api/pay'));
});
