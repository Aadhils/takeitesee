import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('app/account/privacy/page.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AccountPrivacyTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'privacy.loadFallback','privacy.submitFallback','privacy.validation.minDetails','privacy.success.recorded',
  'privacy.type.access','privacy.type.correction','privacy.type.deletion','privacy.checking',
  'privacy.auth.title','privacy.auth.body','privacy.auth.signIn','privacy.auth.viewPolicy',
  'privacy.eyebrow','privacy.title','privacy.intro','privacy.new.title','privacy.new.deletionNotice',
  'privacy.form.type','privacy.form.details','privacy.form.hint','privacy.form.submit','privacy.form.policy',
  'privacy.history.eyebrow','privacy.history.title','privacy.history.loading','privacy.history.empty',
  'privacy.meta.submitted','privacy.meta.lastUpdate','privacy.meta.resolved','privacy.meta.reviewNote',
  'privacy.status.submitted','privacy.status.inReview','privacy.status.awaitingInformation','privacy.status.completed','privacy.status.declined',
];

test('Account Privacy uses a centralized EN/TA translation module', () => {
  assert.ok(source.includes('useAccountPrivacyTranslations'));
  assert.ok(source.includes('const { locale, t } = useAccountPrivacyTranslations()'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 35);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Account Privacy preserves exact request API and payload semantics', () => {
  assert.ok(source.includes("fetch('/api/account/privacy-requests'"));
  assert.ok(source.includes("cache: 'no-store'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("body: JSON.stringify({ request_type: requestType, details: normalizedDetails })"));
  assert.ok(source.includes("'access' | 'correction' | 'deletion'"));
  assert.ok(source.includes("normalizedDetails.length < 10"));
  assert.ok(source.includes('maxLength={2000}'));
});

test('Account Privacy preserves auth, policy and deletion-review boundaries', () => {
  assert.ok(source.includes('/login?returnTo=%2Faccount%2Fprivacy'));
  assert.ok(source.includes('href="/privacy"'));
  assert.ok(source.includes("t('privacy.new.deletionNotice')"));
  assert.ok(translations.includes("A deletion request does not immediately delete your account. Eligible deletion is reviewed against legal retention, security, audit, and unresolved-obligation requirements before processing."));
});

test('Account Privacy preserves request history status and locale-aware timestamps', () => {
  for (const status of ["'submitted'","'in_review'","'awaiting_information'","'completed'","'declined'"]) {
    assert.ok(source.includes(status), status);
  }
  assert.ok(source.includes("statusTone(item.status)"));
  assert.ok(source.includes("statusLabel(item.status)"));
  assert.equal((source.match(/toLocaleString\(locale\)/g) || []).length, 3);
  assert.ok(source.includes('item.review_note'));
});

test('Account Privacy localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
