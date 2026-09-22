import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/requirements/CustomerRequirementProposalAttention.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/CustomerRequirementProposalAttentionTranslations.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<CustomerRequirementProposalAttentionKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Customer Requirement Proposal Attention uses focused EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.equal(englishKeys.length, 22);
  assert.ok(source.includes('useCustomerRequirementProposalAttentionTranslations'));
  assert.ok(source.includes('const { locale, t } = useCustomerRequirementProposalAttentionTranslations()'));
  assert.ok(source.includes('const { status } = useOperationalTranslations()'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Customer Requirement Proposal Attention preserves owner loading and refresh behavior', () => {
  assert.ok(source.includes("fetch('/api/requirements', { cache: 'no-store' })"));
  assert.ok(source.includes('const loadSequence = useRef(0)'));
  assert.ok(source.includes("window.addEventListener('pageshow', refreshOnPageShow)"));
  assert.ok(source.includes("window.addEventListener('focus', refresh)"));
  assert.ok(source.includes("window.addEventListener('popstate', refreshOnPageShow)"));
  assert.ok(source.includes("window.addEventListener('takeitesee:requirements-changed', refreshOnPageShow)"));
  assert.ok(source.includes("document.addEventListener('visibilitychange', refresh)"));
});

test('Customer Requirement Proposal Attention preserves proposal counts and exact deep-link targeting', () => {
  assert.ok(source.includes('rows.reduce((sum, row) => sum + Math.max(0, row.unread_proposal_count ?? 0), 0)'));
  assert.ok(source.includes('rows.filter((row) => (row.proposal_count ?? 0) > 0).length'));
  assert.ok(source.includes('row.latest_unread_proposal_reference || row.latest_proposal_reference'));
  assert.ok(source.includes('`/requirements/${encodeURIComponent(row.id)}?proposal=${encodeURIComponent(proposalReference)}`'));
  assert.ok(source.includes('`/requirements/${encodeURIComponent(row.id)}`'));
});

test('Customer Requirement Proposal Attention preserves best-effort notification acknowledgement', () => {
  assert.ok(source.includes("fetch('/api/notifications', {"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes('JSON.stringify({ mark_requirement_proposals_read: true, requirement_id: row.id })'));
  assert.ok(source.includes('unread_proposal_count: 0'));
  assert.ok(source.includes('router.push(target)'));
  assert.ok(source.includes('Notification acknowledgement is best effort; proposal review must remain reachable.'));
});

test('Customer Requirement Proposal Attention localization stays outside finance and recurrence', () => {
  for (const term of ["method: 'POST'", "method: 'DELETE'", '/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence', 'RequirementOccurrenceRecoveryPanel']) {
    assert.ok(!source.includes(term));
  }
});
