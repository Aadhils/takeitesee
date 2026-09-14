import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [
  layoutSource,
  cssSource,
  authFormsSource,
  legalSignupSource,
  recoveryBoundarySource,
  loginRouteSource,
  signupRouteSource,
  registerRouteSource,
  forgotRouteSource,
  resetRouteSource,
] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/auth-entry-responsive.css', root), 'utf8'),
  readFile(new URL('components/auth/AuthForms.tsx', root), 'utf8'),
  readFile(new URL('components/auth/LegalSignupForm.tsx', root), 'utf8'),
  readFile(new URL('components/auth/PasswordRecoveryBoundary.tsx', root), 'utf8'),
  readFile(new URL('app/login/page.tsx', root), 'utf8'),
  readFile(new URL('app/signup/page.tsx', root), 'utf8'),
  readFile(new URL('app/register/page.tsx', root), 'utf8'),
  readFile(new URL('app/forgot-password/page.tsx', root), 'utf8'),
  readFile(new URL('app/reset-password/page.tsx', root), 'utf8'),
]);

test('auth entry polish loads after the shared responsive foundation', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const authIndex = layoutSource.indexOf("import './auth-entry-responsive.css';");
  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(authIndex > foundationIndex, 'auth entry responsive polish must load after the responsive foundation');
});

test('auth entry styles stay scoped and cover tablet, phone and long-content safety', () => {
  assert.ok(cssSource.includes('.auth-page {'));
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes("button[aria-pressed]"));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('.auth-page .choice-row'));
  assert.ok(cssSource.includes('.auth-page .choice-input'));
  assert.ok(cssSource.includes('@media (max-width: 640px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('@media (max-width: 420px)'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});

test('login signup register forgot and reset routes keep their existing auth components', () => {
  assert.ok(loginRouteSource.includes('LoginForm'));
  assert.ok(loginRouteSource.includes('EmailConfirmationResend'));
  assert.ok(signupRouteSource.includes('LegalSignupForm'));
  assert.ok(registerRouteSource.includes('LegalSignupForm'));
  assert.ok(forgotRouteSource.includes('ForgotPasswordForm'));
  assert.ok(resetRouteSource.includes('PasswordRecoveryBoundary'));
});

test('auth security and legal behavior remain unchanged', () => {
  assert.ok(authFormsSource.includes('safeReturnTo'));
  assert.ok(authFormsSource.includes('signInWithSupabase'));
  assert.ok(authFormsSource.includes('requestPasswordResetWithSupabase'));
  assert.ok(authFormsSource.includes('updatePasswordWithSupabase'));
  assert.ok(legalSignupSource.includes("legal_age_18_confirmed: true"));
  assert.ok(legalSignupSource.includes('TERMS_VERSION'));
  assert.ok(legalSignupSource.includes('PRIVACY_VERSION'));
  assert.ok(legalSignupSource.includes('EmailConfirmationResend'));
  assert.ok(recoveryBoundarySource.includes("event === 'PASSWORD_RECOVERY'"));
  assert.ok(recoveryBoundarySource.includes('hasRecoveryCallbackHint'));
});
