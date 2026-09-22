import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/requirements/CustomerRequirementLifecycleOverview.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/CustomerRequirementLifecycleTranslations.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<CustomerRequirementLifecycleKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Customer Requirement Lifecycle uses focused EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.equal(englishKeys.length, 9);
  assert.ok(source.includes('useCustomerRequirementLifecycleTranslations'));
  assert.ok(source.includes('const { t } = useCustomerRequirementLifecycleTranslations()'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Customer Requirement Lifecycle preserves read-only requirement loading and refresh behavior', () => {
  assert.ok(source.includes("fetch('/api/requirements', { cache: 'no-store' })"));
  assert.ok(source.includes("window.addEventListener('pageshow', refreshOnPageShow)"));
  assert.ok(source.includes("window.addEventListener('focus', refresh)"));
  assert.ok(source.includes("window.addEventListener('popstate', refreshOnPageShow)"));
  assert.ok(source.includes("window.addEventListener('takeitesee:requirements-changed', refreshOnPageShow)"));
  assert.ok(source.includes("document.addEventListener('visibilitychange', refresh)"));
});

test('Customer Requirement Lifecycle preserves status buckets and awarded handoff', () => {
  assert.ok(source.includes("row.status === 'open' || row.status === 'paused'"));
  assert.ok(source.includes("row.status === 'awarded'"));
  assert.ok(source.includes("row.status === 'fulfilled' || row.status === 'cancelled'"));
  assert.ok(source.includes('counts.awarded > 0'));
  assert.ok(source.includes('href="/bookings"'));
});

test('Customer Requirement Lifecycle localization stays mutation-free and outside finance/recurrence', () => {
  for (const term of ["method: 'POST'", "method: 'PATCH'", "method: 'DELETE'", '/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
