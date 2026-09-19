import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/auth/AuthForms.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/CustomerAuthTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'customerAuth.badge','customerAuth.passwordHint','customerAuth.signupIntro','customerAuth.confirmationEyebrow',
  'customerAuth.confirmationTitle','customerAuth.confirmationBody','customerAuth.confirmationHelp','customerAuth.confirmationSignIn',
  'customerAuth.forgotLink','customerAuth.forgotEyebrow','customerAuth.forgotTitle','customerAuth.forgotIntro',
  'customerAuth.forgotSubmit','customerAuth.forgotSentTitle','customerAuth.forgotSentBody','customerAuth.forgotError',
  'customerAuth.resetEyebrow','customerAuth.resetTitle','customerAuth.resetIntro','customerAuth.resetChecking',
  'customerAuth.resetInvalidTitle','customerAuth.resetInvalidBody','customerAuth.resetPassword','customerAuth.resetConfirm',
  'customerAuth.resetHint','customerAuth.resetSubmit','customerAuth.resetMismatch','customerAuth.resetTooShort',
  'customerAuth.resetError','customerAuth.resetDoneTitle','customerAuth.resetDoneBody','customerAuth.accountAction',
  'customerAuth.requestAnother','customerAuth.backToSignIn','customerAuth.password.show','customerAuth.password.hide',
  'customerAuth.email',
];

test('AuthForms uses centralized Customer Auth EN/TA localization', () => {
  assert.ok(source.includes('useCustomerAuthTranslations'));
  assert.ok(!source.includes('customerAuthCopy'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 37);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('AuthForms preserves safe return routing and sign-in semantics', () => {
  assert.ok(source.includes("if (!value || !value.startsWith('/')) return '/account'"));
  assert.ok(source.includes("const base = new URL('https://takeitesee.local')"));
  assert.ok(source.includes("return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : '/account'"));
  assert.ok(source.includes('if (isSupabaseConfigured()) await signInWithSupabase({ email, credential })'));
  assert.ok(source.includes('else localDevelopmentAuthAdapter.signIn({ email, credential })'));
  assert.ok(source.includes('window.location.assign(safeReturnTo(returnTo))'));
});

test('AuthForms preserves signup and email-confirmation behavior', () => {
  assert.ok(source.includes('const result = await signUpWithSupabase(form)'));
  assert.ok(source.includes('if (!result.session)'));
  assert.ok(source.includes('setConfirmationPending(true)'));
  assert.ok(source.includes('localDevelopmentAuthAdapter.signUp(form)'));
  assert.ok(source.includes('form.email.trim().toLowerCase()'));
  assert.ok(source.includes("`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`"));
});

test('AuthForms preserves forgot-password reset-email contract', () => {
  assert.ok(source.includes("new URL('/reset-password', window.location.origin).toString()"));
  assert.ok(source.includes('await requestPasswordResetWithSupabase(email, redirectTo)'));
  assert.ok(source.includes('setSent(true)'));
  assert.ok(source.includes('href="/login"'));
});

test('AuthForms preserves password-reset session and mutation guards', () => {
  assert.ok(source.includes('supabase.auth.onAuthStateChange'));
  assert.ok(source.includes('supabase.auth.getUser()'));
  assert.ok(source.includes("if (submitting || recoveryState !== 'ready') return"));
  assert.ok(source.includes('password.length < 8'));
  assert.ok(source.includes('password !== confirmPassword'));
  assert.ok(source.includes('await updatePasswordWithSupabase(password)'));
  assert.ok(source.includes('subscription.unsubscribe()'));
  assert.ok(source.includes('href="/forgot-password"'));
  assert.ok(source.includes('href="/account"'));
});

test('AuthForms localization does not introduce finance behavior', () => {
  for (const term of ["/api/pay", 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
