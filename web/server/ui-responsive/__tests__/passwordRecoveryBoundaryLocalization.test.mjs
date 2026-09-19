import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/auth/PasswordRecoveryBoundary.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PasswordRecoveryTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'recovery.eyebrow','recovery.checking.title','recovery.checking.body','recovery.checking.session',
  'recovery.invalid.title','recovery.invalid.body','recovery.invalid.sessionBoundary',
  'recovery.invalid.requestAnother','recovery.invalid.backToSignIn',
];

test('Password Recovery boundary uses centralized EN/TA localization', () => {
  assert.ok(source.includes('usePasswordRecoveryTranslations'));
  assert.ok(source.includes('const { t } = usePasswordRecoveryTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 9);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Password Recovery boundary preserves recovery-only authorization semantics', () => {
  assert.ok(source.includes("query.get('type') === 'recovery'"));
  assert.ok(source.includes("hash.get('type') === 'recovery'"));
  assert.ok(source.includes("query.has('code')"));
  assert.ok(source.includes("event === 'PASSWORD_RECOVERY' && session?.user"));
  assert.ok(source.includes("event === 'INITIAL_SESSION' && !callbackHint"));
  assert.ok(source.includes("callbackHint ? 15000 : 1500"));
  assert.ok(source.includes("if (state === 'authorized') return <ResetPasswordForm />"));
  assert.ok(source.includes('subscription.unsubscribe()'));
});

test('Password Recovery boundary preserves invalid-recovery navigation', () => {
  assert.ok(source.includes('href="/forgot-password"'));
  assert.ok(source.includes('href="/login"'));
});

test('Password Recovery localization does not introduce finance behavior', () => {
  for (const term of ["/api/pay", 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
