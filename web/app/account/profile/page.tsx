'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LocalizedProfilePage } from '../../../components/account/LocalizedAccountProfileSettings';
import IdentityHandleManager from '../../../components/identity/IdentityHandleManager';
import { Card, EmptyState } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../../services/auth-adapter';

export default function AccountProfilePage() {
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
      title: 'Profile-ஐ பார்க்க sign in செய்யவும்',
      help: 'உங்கள் contact details மற்றும் service preferences-ஐ பார்க்க அல்லது மாற்ற உங்கள் account-ல் sign in செய்யவும்.',
      signIn: 'Sign in',
      createAccount: 'Account உருவாக்கவும்',
    } : {
      title: 'Sign in to view your profile',
      help: 'Sign in to view or update your contact details and service preferences.',
      signIn: 'Sign in',
      createAccount: 'Create account',
    };

    return <Card>
      <EmptyState title={copy.title}>{copy.help}</EmptyState>
      <div className="button-row">
        <Link href="/login?returnTo=%2Faccount%2Fprofile" className="button button-primary">{copy.signIn}</Link>
        <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
      </div>
    </Card>;
  }

  return <>
    <LocalizedProfilePage />
    <IdentityHandleManager context="customer" locale={locale} />
  </>;
}
