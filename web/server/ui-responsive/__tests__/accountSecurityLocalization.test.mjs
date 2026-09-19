import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('app/account/security/page.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AccountSecurityTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'security.password.show','security.password.hide','security.password.minValidation','security.password.mismatchValidation',
  'security.password.sameValidation','security.password.verifyFailed','security.password.updateSuccess','security.password.updateFallback',
  'security.email.invalidValidation','security.email.sameValidation','security.email.updateSuccess','security.email.updateFallback',
  'security.checking','security.auth.title','security.auth.body','security.auth.signIn','security.auth.forgotPassword',
  'security.eyebrow','security.title','security.intro','security.signedInEmail','security.password.title','security.password.current',
  'security.password.new','security.password.newHint','security.password.confirm','security.password.updateAction','security.password.backSettings',
  'security.password.recoveryBody','security.password.resetAction','security.email.title','security.email.body',
  'security.email.currentPassword','security.email.new','security.email.requestAction',
];

test('Account Security uses a centralized EN/TA translation module', () => {
  assert.ok(source.includes('useAccountSecurityTranslations'));
  assert.ok(source.includes('const { t } = useAccountSecurityTranslations()'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 35);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Account Security preserves password validation and re-auth mutation ordering', () => {
  assert.ok(source.includes('newPassword.length < 8'));
  assert.ok(source.includes('newPassword !== confirmPassword'));
  assert.ok(source.includes('currentPassword === newPassword'));
  assert.equal((source.match(/minLength=\{8\}/g) || []).length, 2);
  assert.equal((source.match(/await signInWithSupabase\(/g) || []).length, 2);
  assert.equal((source.match(/await updatePasswordWithSupabase\(/g) || []).length, 1);
  const reauthIndex = source.indexOf('await signInWithSupabase({ email, credential: currentPassword })');
  const updateIndex = source.indexOf('await updatePasswordWithSupabase(newPassword)');
  assert.ok(reauthIndex >= 0 && updateIndex > reauthIndex);
});

test('Account Security preserves email normalization, validation and Supabase update semantics', () => {
  assert.ok(source.includes('const normalizedEmail = newEmail.trim().toLowerCase()'));
  assert.ok(source.includes("!normalizedEmail || !normalizedEmail.includes('@')"));
  assert.ok(source.includes('normalizedEmail === email.toLowerCase()'));
  assert.ok(source.includes('await signInWithSupabase({ email, credential: emailCurrentPassword })'));
  assert.equal((source.match(/await updateEmailWithSupabase\(/g) || []).length, 1);
  assert.ok(source.includes('await updateEmailWithSupabase(normalizedEmail)'));
  assert.ok(translations.includes('Your sign-in email changes only after the confirmation steps required by Supabase Auth are completed.'));
});

test('Account Security preserves auth and secure recovery routes', () => {
  assert.ok(source.includes('/login?returnTo=%2Faccount%2Fsecurity'));
  assert.equal((source.match(/href="\/forgot-password"/g) || []).length, 2);
  assert.ok(source.includes('href="/account/settings"'));
  assert.ok(source.includes('isSupabaseConfigured()'));
  assert.ok(source.includes('getSupabaseBrowserUser()'));
});

test('Account Security localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
