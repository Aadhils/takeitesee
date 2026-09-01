'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { useLanguage } from '../i18n/LanguageProvider';
import { isSupabaseConfigured, localDevelopmentAuthAdapter, signInWithSupabase, signUpWithSupabase } from '../../services/auth-adapter';

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
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">{t('auth.account')}</span><h1>{t('auth.welcomeBack')}</h1><p>{t('auth.signInIntro')}</p></section><Card className="auth-card"><span className="badge badge-info">{productionAuth ? customerAuthCopy[locale].badge : t('auth.local')}</span><form onSubmit={submit}><Input label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Input label={productionAuth ? t('auth.password') : t('auth.devCredential')} type="password" autoComplete="current-password" hint={productionAuth ? customerAuthCopy[locale].passwordHint : t('auth.localHint')} required value={credential} onChange={(event) => setCredential(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>{t('auth.signIn')}</Button></form><p className="auth-switch">{t('auth.newTo')} <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.createAccount')}</Link></p></Card></div>;
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
