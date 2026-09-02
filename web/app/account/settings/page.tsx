'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LocalizedSettingsPage } from '../../../components/account/LocalizedAccountProfileSettings';
import { Card, EmptyState } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../../services/auth-adapter';

export default function AccountSettingsPage() {
  const { locale } = useOperationalTranslations();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentCustomerAsync()
      .then((auth) => { if (active) setAuthenticated(auth.authenticated); })
      .catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);

  if (authenticated === null) {
    return <Card><p>{locale === 'ta-IN' ? 'உங்கள் account-ஐ சரிபார்க்கிறது…' : 'Checking your account…'}</p></Card>;
  }

  if (!authenticated) {
    const copy = locale === 'ta-IN' ? {
      title: 'Settings-ஐ பார்க்க sign in செய்யவும்',
      help: 'உங்கள் notification, language மற்றும் account preferences-ஐ நிர்வகிக்க உங்கள் account-ல் sign in செய்யவும்.',
      signIn: 'Sign in',
      createAccount: 'Account உருவாக்கவும்',
    } : {
      title: 'Sign in to manage settings',
      help: 'Sign in to manage your notification, language and account preferences.',
      signIn: 'Sign in',
      createAccount: 'Create account',
    };

    return <Card>
      <EmptyState title={copy.title}>{copy.help}</EmptyState>
      <div className="button-row">
        <Link href="/login?returnTo=%2Faccount%2Fsettings" className="button button-primary">{copy.signIn}</Link>
        <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
      </div>
    </Card>;
  }

  const privacyCopy = locale === 'ta-IN' ? {
    eyebrow: 'Privacy self-service',
    title: 'Privacy requests',
    body: 'உங்கள் தகவலுக்கான access, correction அல்லது deletion review request-ஐ account-லிருந்தே submit செய்து status பார்க்கலாம். Deletion request உடனடி automatic deletion அல்ல.',
    action: 'Privacy requests நிர்வகிக்கவும்',
  } : {
    eyebrow: 'Privacy self-service',
    title: 'Privacy requests',
    body: 'Submit and track access, correction, or deletion-review requests from your account. A deletion request is not an immediate automatic account deletion.',
    action: 'Manage privacy requests',
  };

  return <>
    <LocalizedSettingsPage />
    <div className="container section-stack">
      <Card>
        <span className="eyebrow">{privacyCopy.eyebrow}</span>
        <h2>{privacyCopy.title}</h2>
        <p>{privacyCopy.body}</p>
        <Link href="/account/privacy" className="button button-secondary">{privacyCopy.action}</Link>
      </Card>
    </div>
  </>;
}
