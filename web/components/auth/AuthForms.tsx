'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { PasswordInput } from '../ui/PasswordInput';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { useCustomerAuthTranslations } from '../i18n/CustomerAuthTranslations';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import {
  isSupabaseConfigured,
  localDevelopmentAuthAdapter,
  requestPasswordResetWithSupabase,
  signInWithSupabase,
  signUpWithSupabase,
  updatePasswordWithSupabase,
} from '../../services/auth-adapter';


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
  const { t: tAuth } = useCustomerAuthTranslations();
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
  const showLabel = tAuth('customerAuth.password.show');
  const hideLabel = tAuth('customerAuth.password.hide');
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.welcomeBack')}</h1><p>{t('auth.signInIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{productionAuth ? tAuth('customerAuth.badge') : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><PasswordInput label={productionAuth ? t('auth.password') : t('auth.devCredential')} autoComplete="current-password" hint={productionAuth ? tAuth('customerAuth.passwordHint') : t('auth.localHint')} required value={credential} onChange={(event) => setCredential(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.signIn')}</Button></form>{productionAuth ? <p className="auth-switch"><Link href="/forgot-password" className="text-link">{tAuth('customerAuth.forgotLink')}</Link></p> : null}<p className="auth-switch">{t('auth.newTo')} <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.createAccount')}</Link></p></Card></div>;
}

export function SignupForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
  const { t: tAuth } = useCustomerAuthTranslations();
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
    const loginHref = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.confirmationEyebrow')}</span><h1>{tAuth('customerAuth.confirmationTitle')}</h1><p>{tAuth('customerAuth.confirmationHelp')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><p>{tAuth('customerAuth.confirmationBody')} <strong>{form.email.trim().toLowerCase()}</strong>.</p><p>{tAuth('customerAuth.confirmationHelp')}</p><Link href={loginHref} className="button button-primary">{tAuth('customerAuth.confirmationSignIn')}</Link></Card></div>;
  }

  const showLabel = tAuth('customerAuth.password.show');
  const hideLabel = tAuth('customerAuth.password.hide');
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.createTitle')}</h1><p>{productionAuth ? tAuth('customerAuth.signupIntro') : t('auth.signupLocalIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{productionAuth ? tAuth('customerAuth.badge') : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.name')} autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Input label={t('auth.phoneOptional')} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><PasswordInput label={productionAuth ? t('auth.password') : t('auth.devCredential')} autoComplete="new-password" hint={productionAuth ? tAuth('customerAuth.passwordHint') : t('auth.localSignupHint')} required value={form.credential} onChange={(event) => setForm({ ...form, credential: event.target.value })} showLabel={showLabel} hideLabel={hideLabel} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.createAccount')}</Button></form><p className="auth-switch">{t('auth.alreadyRegistered')} <Link href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.signIn')}</Link></p></Card></div>;
}

export function ForgotPasswordForm() {
  const { t: tAuth } = useCustomerAuthTranslations();
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
      if (!isSupabaseConfigured()) throw new Error(tAuth('customerAuth.forgotError'));
      const redirectTo = new URL('/reset-password', window.location.origin).toString();
      await requestPasswordResetWithSupabase(email, redirectTo);
      setSent(true);
    } catch {
      setError(tAuth('customerAuth.forgotError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.forgotEyebrow')}</span><h1>{tAuth('customerAuth.forgotSentTitle')}</h1><p>{tAuth('customerAuth.forgotSentBody')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><p>{tAuth('customerAuth.forgotSentBody')}</p><Link href="/login" className="button button-primary">{tAuth('customerAuth.backToSignIn')}</Link></Card></div>;
  }

  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.forgotEyebrow')}</span><h1>{tAuth('customerAuth.forgotTitle')}</h1><p>{tAuth('customerAuth.forgotIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><form onSubmit={submit}><Input label={tAuth('customerAuth.email')} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{tAuth('customerAuth.forgotSubmit')}</Button></form><p className="auth-switch"><Link href="/login" className="text-link">{tAuth('customerAuth.backToSignIn')}</Link></p></Card></div>;
}

export function ResetPasswordForm() {
  const { t: tAuth } = useCustomerAuthTranslations();
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
      setError(tAuth('customerAuth.resetTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(tAuth('customerAuth.resetMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await updatePasswordWithSupabase(password);
      setCompleted(true);
    } catch {
      setError(tAuth('customerAuth.resetError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.resetEyebrow')}</span><h1>{tAuth('customerAuth.resetDoneTitle')}</h1><p>{tAuth('customerAuth.resetDoneBody')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><p>{tAuth('customerAuth.resetDoneBody')}</p><Link href="/account" className="button button-primary">{tAuth('customerAuth.accountAction')}</Link></Card></div>;
  }

  if (recoveryState === 'checking') {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.resetEyebrow')}</span><h1>{tAuth('customerAuth.resetTitle')}</h1><p>{tAuth('customerAuth.resetChecking')}</p></section><Card className="auth-card"><p>{tAuth('customerAuth.resetChecking')}</p></Card></div>;
  }

  if (recoveryState === 'invalid') {
    return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.resetEyebrow')}</span><h1>{tAuth('customerAuth.resetInvalidTitle')}</h1><p>{tAuth('customerAuth.resetInvalidBody')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><p>{tAuth('customerAuth.resetInvalidBody')}</p><Link href="/forgot-password" className="button button-primary">{tAuth('customerAuth.requestAnother')}</Link><p className="auth-switch"><Link href="/login" className="text-link">{tAuth('customerAuth.backToSignIn')}</Link></p></Card></div>;
  }

  const showLabel = tAuth('customerAuth.password.show');
  const hideLabel = tAuth('customerAuth.password.hide');
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{tAuth('customerAuth.resetEyebrow')}</span><h1>{tAuth('customerAuth.resetTitle')}</h1><p>{tAuth('customerAuth.resetIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{tAuth('customerAuth.badge')}</span><form onSubmit={submit}><PasswordInput label={tAuth('customerAuth.resetPassword')} autoComplete="new-password" required hint={tAuth('customerAuth.resetHint')} value={password} onChange={(event) => setPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} /><PasswordInput label={tAuth('customerAuth.resetConfirm')} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{tAuth('customerAuth.resetSubmit')}</Button></form></Card></div>;
}
