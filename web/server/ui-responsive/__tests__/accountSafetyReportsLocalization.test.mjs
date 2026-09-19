import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('app/account/reports/page.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AccountSafetyReportsTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'reports.loadFallback','reports.checking','reports.auth.title','reports.auth.body','reports.auth.signIn','reports.auth.backAccount',
  'reports.eyebrow','reports.title','reports.intro','reports.visibility.title','reports.visibility.body',
  'reports.action.platformSupport','reports.action.backAccount','reports.loading','reports.empty',
  'reports.meta.category','reports.meta.submitted','reports.meta.lastUpdate','reports.meta.resolved',
  'reports.details.title','reports.history.title',
  'reports.status.open','reports.status.reviewing','reports.status.actioned','reports.status.dismissed',
];

test('Account Safety Reports uses a centralized EN/TA translation module', () => {
  assert.ok(source.includes('useAccountSafetyReportsTranslations'));
  assert.ok(source.includes('const { locale, t } = useAccountSafetyReportsTranslations()'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 25);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Account Safety Reports preserves read-only report API and auth semantics', () => {
  assert.ok(source.includes("fetch('/api/account/reports'"));
  assert.ok(source.includes("cache: 'no-store'"));
  assert.ok(source.includes("headers: { Accept: 'application/json' }"));
  assert.ok(!source.includes("method: 'POST'"));
  assert.ok(!source.includes("method: 'PATCH'"));
  assert.ok(!source.includes("method: 'DELETE'"));
  assert.ok(source.includes('/login?returnTo=%2Faccount%2Freports'));
});

test('Account Safety Reports preserves canonical report status and safe history presentation', () => {
  assert.ok(source.includes("type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed'"));
  assert.ok(source.includes('statusTone(report.status)'));
  assert.ok(source.includes('statusLabel(report.status)'));
  assert.ok(source.includes('report.events.map'));
  assert.ok(source.includes('function words(value: string)'));
  assert.equal((source.match(/toLocaleString\(locale\)/g) || []).length, 4);
});

test('Account Safety Reports preserves privacy boundary and support navigation', () => {
  assert.ok(source.includes('href="/account/support"'));
  assert.ok(source.includes('href="/account"'));
  assert.ok(source.includes("t('reports.visibility.body')"));
  assert.ok(translations.includes('Internal moderator notes and staff identifiers are not exposed.'));
});

test('Account Safety Reports localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
