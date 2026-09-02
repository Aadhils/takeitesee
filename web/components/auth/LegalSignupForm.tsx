'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { PasswordInput } from '../ui/PasswordInput';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { useLanguage } from '../i18n/LanguageProvider';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { isSupabaseConfigured, localDevelopmentAuthAdapter } from '../../services/auth-adapter';

const TERMS_VERSION = '2026-09-02';
const PRIVACY_VERSION = '2026-09-02';

const copy = {
  'en-IN': {
    badge: 'Secure account',
    intro: 'Create one account to book services, post requirements, and manage your activity.',
    age: 'I confirm that I am 18 years of age or older.',
    agreePrefix: 'I have read and agree to the',
    and: 'and',
    consentError: 'Confirm that you are 18 or older and agree to the Terms of Service and Privacy Policy to create an account.',
    confirmationEyebrow: 'Email confirmation',
    confirmationTitle: 'Check your email to finish creating your account.',
    confirmationBody: 'We created your account, but you are not signed in yet. Open the confirmation email sent to',
    confirmationHelp: 'After confirming your email, return to TakeItEsee and sign in.',
    confirmationSignIn: 'Back to sign in',
  },
  'ta-IN': {
    badge: 'பாதுகாப்பான கணக்கு',
    intro: 'சேவைகளை முன்பதிவு செய்ய, தேவைகளை பதிவிட மற்றும் உங்கள் செயல்பாடுகளை நிர்வகிக்க ஒரே கணக்கை உருவாக்குங்கள்.',
    age: 'எனக்கு 18 வயது அல்லது அதற்கு மேல் என்பதை உறுதிப்படுத்துகிறேன்.',
    agreePrefix: 'நான் படித்து ஒப்புக்கொள்கிறேன்:',
    and: 'மற்றும்',
    consentError: 'Account உருவாக்க 18 வயது அல்லது அதற்கு மேல் என்பதை உறுதிப்படுத்தி Terms of Service மற்றும் Privacy Policy-க்கு ஒப்புக்கொள்ளவும்.',
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

export function LegalSignupForm({ returnTo }: { returnTo: string | null }) {
  const { t } = useIdentityWorkspaceTranslations();
  const { locale } = useLanguage();
  const localized = copy[locale];
  const [form, setForm] = useState({ name: '', email: '', phone: '', credential: '' });
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const productionAuth = isSupabaseConfigured();
  const showLabel = locale === 'ta-IN' ? 'Password-ஐ காட்டு' : 'Show password';
  const hideLabel = locale === 'ta-IN' ? 'Password-ஐ மறை' : 'Hide password';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!legalAccepted) {
      setError(localized.consentError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (productionAuth) {
        const supabase = createSupabaseBrowserClient();
        const { data, error: signupError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.credential,
          options: {
            data: {
              name: form.name.trim(),
              phone: form.phone.trim() || undefined,
              role: 'customer',
              legal_age_18_confirmed: true,
              legal_terms_version: TERMS_VERSION,
              legal_privacy_version: PRIVACY_VERSION,
            },
          },
        });
        if (signupError || !data.user) throw new Error(signupError?.message ?? t('auth.unableCreate'));
        if (!data.session) {
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
    return (
      <div className="auth-page">
        <section className="page-intro">
          <span className="eyebrow">{localized.confirmationEyebrow}</span>
          <h1>{localized.confirmationTitle}</h1>
          <p>{localized.confirmationHelp}</p>
        </section>
        <Card className="auth-card">
          <span className="badge badge-info">{localized.badge}</span>
          <p>{localized.confirmationBody} <strong>{form.email.trim().toLowerCase()}</strong>.</p>
          <p>{localized.confirmationHelp}</p>
          <Link href={loginHref} className="button button-primary">{localized.confirmationSignIn}</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <section className="page-intro">
        <span className="eyebrow">{t('auth.account')}</span>
        <h1>{t('auth.createTitle')}</h1>
        <p>{productionAuth ? localized.intro : t('auth.signupLocalIntro')}</p>
      </section>
      <Card className="auth-card">
        <span className="badge badge-info">{productionAuth ? localized.badge : t('auth.local')}</span>
        <form onSubmit={submit}>
          <Input label={t('auth.name')} autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input label={t('auth.phoneOptional')} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <PasswordInput label={productionAuth ? t('auth.password') : t('auth.devCredential')} autoComplete="new-password" required value={form.credential} onChange={(event) => setForm({ ...form, credential: event.target.value })} showLabel={showLabel} hideLabel={hideLabel} />
          <div className="choice-row">
            <input
              id="signup-legal-consent"
              className="choice-input"
              type="checkbox"
              required
              checked={legalAccepted}
              onChange={(event) => {
                setLegalAccepted(event.target.checked);
                if (event.target.checked && error === localized.consentError) setError('');
              }}
            />
            <span>
              <label htmlFor="signup-legal-consent"><strong>{localized.age}</strong></label>
              <span className="choice-description">
                {localized.agreePrefix}{' '}
                <Link href="/terms" className="text-link">Terms of Service</Link>{' '}
                {localized.and}{' '}
                <Link href="/privacy" className="text-link">Privacy Policy</Link>.
              </span>
            </span>
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <Button type="submit" loading={submitting}>{t('auth.createAccount')}</Button>
        </form>
        <p className="auth-switch">{t('auth.alreadyRegistered')} <Link href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">{t('auth.signIn')}</Link></p>
      </Card>
    </div>
  );
}
