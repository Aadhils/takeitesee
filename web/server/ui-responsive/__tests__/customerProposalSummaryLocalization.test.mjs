import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [summary, translations] = await Promise.all([
  readFile(new URL('components/account/CustomerAccountProposalSummary.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/OperationalTranslations.ts', root), 'utf8'),
]);

const keys = [
  'customer.proposals.noActivity','customer.proposals.inbox','customer.proposals.checking',
  'customer.proposals.newCount','customer.proposals.upToDate','customer.proposals.waitingTitle',
  'customer.proposals.postNeedTitle','customer.proposals.newHelp','customer.proposals.upToDateHelp',
  'customer.proposals.waitingHelp','customer.proposals.postNeedHelp','customer.proposals.aria',
  'customer.proposals.newReply','customer.proposals.newReplies','customer.proposals.allCaughtUp',
  'customer.proposals.waitingReplies','customer.proposals.readyToPost','customer.proposals.requirementWithProposals',
  'customer.proposals.requirementsWithProposals','customer.proposals.requirementLive','customer.proposals.needService',
  'customer.proposals.liveEmptyHelp','customer.proposals.postEmptyHelp','customer.proposals.manageRequirements',
  'customer.proposals.postRequirement','customer.proposals.new','customer.proposals.latest',
  'customer.proposals.reviewNew','customer.proposals.view','customer.proposals.viewAll',
];

test('Customer proposal summary uses shared operational localization', () => {
  assert.ok(summary.includes('const { locale, t } = useOperationalTranslations()'));
  assert.ok(!summary.includes('const tamil'));
  assert.ok(!summary.includes('tamil ?'));
  assert.ok(!/[஀-௿]/u.test(summary));
  for (const key of keys) {
    assert.equal(translations.split("'" + key + "':").length - 1, 2);
    assert.ok(summary.includes("t('" + key + "')"));
  }
});

test('Customer proposal summary preserves discovery, sorting and unread semantics', () => {
  assert.ok(summary.includes("fetch('/api/requirements'"));
  assert.ok(summary.includes("payload.proposal_attention_status !== 'unavailable'"));
  assert.ok(summary.includes('(right.unread_proposal_count ?? 0) - (left.unread_proposal_count ?? 0)'));
  assert.ok(summary.includes('proposalRows.filter((row) => (row.unread_proposal_count ?? 0) > 0)'));
  assert.ok(summary.includes('proposalRows.slice(0, 3)'));
  assert.ok(summary.includes('onUnreadChange?.(available ? totalUnread : 0)'));
});

test('Customer proposal summary preserves exact proposal deep-link and acknowledgement', () => {
  assert.ok(summary.includes('/requirements/${encodeURIComponent(row.id)}?proposal=${encodeURIComponent(proposalReference)}'));
  assert.ok(summary.includes('mark_requirement_proposals_read: true'));
  assert.ok(summary.includes('requirement_id: row.id'));
  assert.ok(summary.includes('unread_proposal_count: 0'));
  assert.ok(summary.includes('router.push(target)'));
});

test('Customer proposal summary preserves targeted focus, locale date and responsive behavior', () => {
  assert.ok(summary.includes("window.location.hash !== '#proposal-attention'"));
  assert.ok(summary.includes("window.addEventListener('hashchange', focusIfTargeted)"));
  assert.ok(summary.includes("new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })"));
  assert.ok(summary.includes('@media (max-width: 720px)'));
  assert.ok(summary.includes('min-height: 44px'));
  assert.ok(!summary.includes('Cashfree'));
  assert.ok(!summary.includes('/api/pay'));
});
