'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { useLanguage } from '../i18n/LanguageProvider';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import {
  isSupabaseConfigured,
  localDevelopmentAuthAdapter,
  requestPasswordResetWithSupabase,
  signInWithSupabase,
  signUpWithSupabase,
  updatePasswordWithSupabase,
} from '../../services/auth-adapter';

const customerAuthCopy = {
  'en-IN': {
    badge: 'Secure account',
    passwordHint: 'Your password is handled securely and is never shown to other users.',
    signupIntro: 'Create one account to book services, post requirements, and manage your activity.',
    confirmationEyebrow: 'Email confirmation',
    confirmationTitle: 'Check your email to finish creating your account.',
    confirmationBody: 'We created your account, but you are not signed in yet. Open the confirmation email sent to',
    confirmationHelp: 'After confirming your email, return to TakeItEsee and sign in.',
    confirmationSignIn: 'Back to sign in',
    forgotLink: 'Forgot password?',
    forgotEyebrow: 'Account recovery',
    forgotTitle: 'Reset your password.',
    forgotIntro: 'Enter the email address you use for TakeItEsee. We will request a secure password-reset email.',
    forgotSubmit: 'Send reset email',
    forgotSentTitle: 'Check your email.',
    forgotSentBody: 'If a TakeItEsee account can receive password-reset email at that address, a recovery message has been requested. Follow the link in that email to choose a new password.',
    forgotError: 'Unable to request a password-reset email right now. Try again later.',
    resetEyebrow: 'Secure password reset',
    resetTitle: 'Choose a new password.',
    resetIntro: 'Use the secure recovery link from your email to set a new password for your TakeItEsee account.',
    resetChecking: 'Checking your secure recovery session…',
    resetInvalidTitle: 'This recovery link is not active.',
    resetInvalidBody: 'Request a new password-reset email and open the latest recovery link.',
    resetPassword: 'New password',
    resetConfirm: 'Confirm new password',
    resetHint: 'Use at least 8 characters. Your Supabase Auth policy may require a stronger password.',
    resetSubmit: 'Update password',
    resetMismatch: 'The two passwords do not match.',
    resetTooShort: 'Use a password with at least 8 characters.',
    resetError: 'Unable to update your password. Request a fresh recovery link and try again.',
    resetDoneTitle: 'Your password has been updated.',
    resetDoneBody: 'You can continue to your TakeItEsee account with your new password.',
    accountAction: 'Continue to account',
    requestAnother: 'Request another reset email',
    backToSignIn: 'Back to sign in',
  },
  'ta-IN': {
    badge: 'பாதுகாப்பான கணக்கு',
    passwordHint: 'உங்கள் கடவுச்சொல் பாதுகாப்பாக கையாளப்படுகிறது; அது மற்ற பயனர்களுக்கு காட்டப்படாது.',
    signupIntro: 'சேவைகளை முன்பதிவு செய்ய, தேவைகளை பதிவிட மற்றும் உங்கள் செயல்பாடுகளை நிர்வகிக்க ஒரே கணக்கை உருவாக்குங்கள்.',
    confirmationEyebrow: 'Email உறுதிப்படுத்தல்',
    confirmationTitle: 'உங்கள் account உருவாக்கத்தை முடிக்க email-ஐ சரிபார்க்கவும்.',
    confirmationBody: 'உங்கள் account உருவாக்கப்பட்டது, ஆனால் இன்னும் sign in ஆகவில்லை. Confirmation email அனுப்பப்பட்ட முகவரி:',
    confirmationHelp: 'Email-ஐ confirm செய்த பிறகு TakeItEsee-க்கு திரும்பி sign in செய்யவும்.',
    confirmationSignIn: 'Sign in-க்கு திரும்பவும்',
    forgotLink: 'Password மறந்துவிட்டதா?',
    forgotEyebrow: 'Account recovery',
    forgotTitle: 'உங்கள் password-ஐ reset செய்யுங்கள்.',
    forgotIntro: 'TakeItEsee-க்கு பயன்படுத்தும் email address-ஐ உள்ளிடவும். பாதுகாப்பான password-reset email-ஐ request செய்வோம்.',
    forgotSubmit: 'Reset email அனுப்பவும்',
    forgotSentTitle: 'உங்கள் email-ஐ சரிபார்க்கவும்.',
    forgotSentBody: 'இந்த email address-க்கு TakeItEsee password-reset email பெறக்கூடிய account இருந்தால், recovery message request செய்யப்பட்டுள்ளது. புதிய password தேர்வு செய்ய அந்த email-ல் உள்ள link-ஐ திறக்கவும்.',
    forgotError: 'இப்போது password-reset email request செய்ய முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
    resetEyebrow: 'பாதுகாப்பான password reset',
    resetTitle: 'புதிய password-ஐ தேர்வு செய்யுங்கள்.',
    resetIntro: 'உங்கள் TakeItEsee account-க்கு புதிய password அமைக்க email-ல் வந்த secure recovery link-ஐ பயன்படுத்தவும்.',
    resetChecking: 'உங்கள் secure recovery session-ஐ சரிபார்க்கிறது…',
    resetInvalidTitle: 'இந்த recovery link தற்போது active இல்லை.',
    resetInvalidBody: 'புதிய password-reset email-ஐ request செய்து அதில் வரும் சமீபத்திய recovery link-ஐ திறக்கவும்.',
    resetPassword: 'புதிய password',
    resetConfirm: 'புதிய password-ஐ மீண்டும் உள்ளிடவும்',
    resetHint: 'குறைந்தது 8 characters பயன்படுத்தவும். உங்கள் Supabase Auth policy இன்னும் வலுவான password-ஐ கேட்கலாம்.',
    resetSubmit: 'Password update செய்யவும்',
    resetMismatch: 'இரண்டு passwords-மும் பொருந்தவில்லை.',
    resetTooShort: 'குறைந்தது 8 characters உள்ள password பயன்படுத்தவும்.',
    resetError: 'Password-ஐ update செய்ய முடியவில்லை. புதிய recovery link request செய்து மீண்டும் முயற்சிக்கவும்.',
    resetDoneTitle: 'உங்கள் password update செய்யப்பட்டது.',
    resetDoneBody: 'புதிய password உடன் உங்கள் TakeItEsee account-ஐ தொடர்ந்து பயன்படுத்தலாம்.',
    accountAction: 'Account-க்கு செல்லவும்',
    requestAnother: 'மற்றொரு reset email request செய்யவும்',
    backToSignIn: 'Sign in-க்கு திரும்பவும்',
  },
} as const;

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/')) return '/account';
  try {
    const base = new URL('https://takeitesee.local');
    const target = new URL(value, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : '/account';
  } catch {
    return '/account';
  }
}

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
  const { locale } = useLanguage();
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (isSupabaseConfigured()) await signInWithSupabase({ email, credential });
      else localDevelopmentAuthAdapter.signIn({ email, credential });
      window.location.assign(safeReturnTo(returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.unableSignIn'));
      setSubmitting(false);
    }
  };
  const productionAuth = isSupabaseConfigured();
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.welcomeBack')}</h1><p>{t('auth.signInIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{productionAuth ? customerAuthCopy[locale].badge : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Input label={productionAuth ? t('auth.password') : t('auth.devCredential')} type="password" autoComplete="current-password" hint={productionAuth ? customerAuthCopy[locale].passwordHint : t('auth.localHint')} required value={credential} onChange={(event) => setCredential(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.signIn')}</Button></form>{productionAuth ? <p className="auth-switch"><Link href="/forgot-password" className="text-link">{customerAuthCopy[locale].forgotLink}</Link></p> : null}<p className="auth-switch">{t('auth.newTo')} <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.createAccount')}</Link></p></Card></div>;
}

export function SignupForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
  const { locale } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', phone: '', credential: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const productionAuth = isSupabaseConfigured();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (productionAuth) {
        const result = await signUpWithSupabase(form);
        if (!result.session) {
          setConfirmationPending(true);
          setSubmitting(false);
          return;
        }
      } else {
        localDevelopmentAuthAdapter.signUp(form);
      }
      window.location.assign(safeReturnTo(returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.unableCreate'));
      setSubmitting(false);
    }
  };

  if (confirmationPending) {
    const copy = customerAuthCopy[locale];
    const loginHref = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.confirmationEyebrow}</span><h1>{copy.confirmationTitle}</h1><p>{copy.confirmationHelp}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><p>{copy.confirmationBody} <strong>{form.email.trim().toLowerCase()}</strong>.</p><p>{copy.confirmationHelp}</p><Link href={loginHref} className="button button-primary">{copy.confirmationSignIn}</Link></Card></div>;
  }

  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.createTitle')}</h1><p>{productionAuth ? customerAuthCopy[locale].signupIntro : t('auth.signupLocalIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{productionAuth ? customerAuthCopy[locale].badge : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.name')} autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Input label={t('auth.phoneOptional')} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><Input label={productionAuth ? t('auth.password') : t('auth.devCredential')} type="password" autoComplete="new-password" hint={productionAuth ? customerAuthCopy[locale].passwordHint : t('auth.localSignupHint')} required value={form.credential} onChange={(event) => setForm({ ...form, credential: event.target.value })} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.createAccount')}</Button></form><p className="auth-switch">{t('auth.alreadyRegistered')} <Link href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.signIn')}</Link></p></Card></div>;
}

export function ForgotPasswordForm() {
  const { locale } = useLanguage();
  const copy = customerAuthCopy[locale];
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (!isSupabaseConfigured()) throw new Error(copy.forgotError);
      const redirectTo = new URL('/reset-password', window.location.origin).toString();
      await requestPasswordResetWithSupabase(email, redirectTo);
      setSent(true);
    } catch {
      setError(copy.forgotError);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.forgotEyebrow}</span><h1>{copy.forgotSentTitle}</h1><p>{copy.forgotSentBody}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><p>{copy.forgotSentBody}</p><Link href="/login" className="button button-primary">{copy.backToSignIn}</Link></Card></div>;
  }

  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.forgotEyebrow}</span><h1>{copy.forgotTitle}</h1><p>{copy.forgotIntro}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><form onSubmit={submit}><Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{copy.forgotSubmit}</Button></form><p className="auth-switch"><Link href="/login" className="text-link">{copy.backToSignIn}</Link></p></Card></div>;
}

export function ResetPasswordForm() {
  const { locale } = useLanguage();
  const copy = customerAuthCopy[locale];
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRecoveryState('invalid');
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.user) setRecoveryState('ready');
    });
    void supabase.auth.getUser()
      .then(({ data }) => {
        if (!active) return;
        setRecoveryState(data.user ? 'ready' : 'invalid');
      })
      .catch(() => {
        if (active) setRecoveryState('invalid');
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || recoveryState !== 'ready') return;
    setError('');
    if (password.length < 8) {
      setError(copy.resetTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.resetMismatch);
      return;
    }
    setSubmitting(true);
    try {
      await updatePasswordWithSupabase(password);
      setCompleted(true);
    } catch {
      setError(copy.resetError);
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.resetEyebrow}</span><h1>{copy.resetDoneTitle}</h1><p>{copy.resetDoneBody}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><p>{copy.resetDoneBody}</p><Link href="/account" className="button button-primary">{copy.accountAction}</Link></Card></div>;
  }

  if (recoveryState === 'checking') {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.resetEyebrow}</span><h1>{copy.resetTitle}</h1><p>{copy.resetChecking}</p></section><Card className="auth-card"><p>{copy.resetChecking}</p></Card></div>;
  }

  if (recoveryState === 'invalid') {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.resetEyebrow}</span><h1>{copy.resetInvalidTitle}</h1><p>{copy.resetInvalidBody}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><p>{copy.resetInvalidBody}</p><Link href="/forgot-password" className="button button-primary">{copy.requestAnother}</Link><p className="auth-switch"><Link href="/login" className="text-link">{copy.backToSignIn}</Link></p></Card></div>;
  }

  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{copy.resetEyebrow}</span><h1>{copy.resetTitle}</h1><p>{copy.resetIntro}</p></section><Card className="auth-card"><span className="badge badge-info">{copy.badge}</span><form onSubmit={submit}><Input label={copy.resetPassword} type="password" autoComplete="new-password" required hint={copy.resetHint} value={password} onChange={(event) => setPassword(event.target.value)} /><Input label={copy.resetConfirm} type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{copy.resetSubmit}</Button></form></Card></div>;
}
