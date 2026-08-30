'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { isSupabaseConfigured, localDevelopmentAuthAdapter, signInWithSupabase, signUpWithSupabase } from '../../services/auth-adapter';

function safeReturnTo(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
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
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.welcomeBack')}</h1><p>{t('auth.signInIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{isSupabaseConfigured() ? t('auth.supabase') : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Input label={isSupabaseConfigured() ? t('auth.password') : t('auth.devCredential')} type="password" autoComplete="current-password" hint={isSupabaseConfigured() ? t('auth.supabaseHint') : t('auth.localHint')} required value={credential} onChange={(event) => setCredential(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.signIn')}</Button></form><p className="auth-switch">{t('auth.newTo')} <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.createAccount')}</Link></p></Card></div>;
}

export function SignupForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [form, setForm] = useState({ name: '', email: '', phone: '', credential: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (isSupabaseConfigured()) await signUpWithSupabase(form);
      else localDevelopmentAuthAdapter.signUp(form);
      window.location.assign(safeReturnTo(returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.unableCreate'));
      setSubmitting(false);
    }
  };
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.createTitle')}</h1><p>{isSupabaseConfigured() ? t('auth.signupSupabaseIntro') : t('auth.signupLocalIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{isSupabaseConfigured() ? t('auth.supabase') : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.name')} autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Input label={t('auth.phoneOptional')} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><Input label={isSupabaseConfigured() ? t('auth.password') : t('auth.devCredential')} type="password" autoComplete="new-password" hint={isSupabaseConfigured() ? t('auth.supabaseHint') : t('auth.localSignupHint')} required value={form.credential} onChange={(event) => setForm({ ...form, credential: event.target.value })} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.createAccount')}</Button></form><p className="auth-switch">{t('auth.alreadyRegistered')} <Link href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.signIn')}</Link></p></Card></div>;
}
