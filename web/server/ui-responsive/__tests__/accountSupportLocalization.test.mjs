import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('app/account/support/page.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AccountSupportTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'support.loadFallback','support.submitFallback','support.success.recorded',
  'support.type.platformGrievance','support.type.accountHelp','support.type.safety','support.type.providerConduct','support.type.other',
  'support.checking','support.auth.title','support.auth.body','support.auth.signIn','support.auth.emailOfficer',
  'support.eyebrow','support.title','support.intro','support.new.title','support.new.boundary',
  'support.form.type','support.form.subject','support.form.details','support.form.hint','support.form.submit','support.form.privacy',
  'support.history.eyebrow','support.history.title','support.history.loading','support.history.empty',
  'support.meta.type','support.meta.submitted','support.meta.lastUpdate','support.meta.reviewNote',
  'support.status.submitted','support.status.inReview','support.status.awaitingInformation','support.status.resolved','support.status.closed',
];

test('Account Support uses a centralized EN/TA translation module', () => {
  assert.ok(source.includes('useAccountSupportTranslations'));
  assert.ok(source.includes('const { locale, t } = useAccountSupportTranslations()'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 37);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Account Support preserves exact request API and payload semantics', () => {
  assert.ok(source.includes("fetch('/api/account/support-requests'"));
  assert.ok(source.includes("cache: 'no-store'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("body: JSON.stringify({ request_type: requestType, subject: subject.trim(), details: details.trim() })"));
  assert.ok(source.includes("'platform_grievance' | 'account_help' | 'safety' | 'provider_conduct' | 'other'"));
  assert.ok(source.includes("'submitted' | 'in_review' | 'awaiting_information' | 'resolved' | 'closed'"));
});

test('Account Support preserves auth, grievance fallback and privacy-routing boundaries', () => {
  assert.ok(source.includes('/login?returnTo=%2Faccount%2Fsupport'));
  assert.ok(source.includes('mailto:uandv.com@gmail.com'));
  assert.ok(source.includes('href="/account/privacy"'));
  assert.ok(source.includes('LocalizedAccountShell active="/account/support"'));
  assert.ok(source.includes("t('support.new.boundary')"));
  assert.ok(translations.includes('For booking-specific issues, use Get help from that booking. For privacy access, correction, or deletion review, use the Account privacy workflow.'));
});

test('Account Support preserves localized status presentation and locale-aware timestamps', () => {
  assert.ok(source.includes('statusLabel(item.status)'));
  assert.ok(source.includes('tone(item.status)'));
  assert.equal((source.match(/toLocaleString\(locale\)/g) || []).length, 2);
  assert.ok(source.includes('item.review_note'));
});

test('Account Support localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
