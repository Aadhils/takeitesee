'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CustomerRequirementsManager from '../../components/requirements/CustomerRequirementsManager';
import { Card, EmptyState } from '../../components/ui/primitives';
import { useOperationalTranslations } from '../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../services/auth-adapter';

export default function RequirementsPage() {
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
      title: 'தேவையை பதிவிட sign in செய்யவும்',
      help: 'உங்களுக்கு தேவையான சேவையை பதிவிட்டு verified providers-இடமிருந்து proposals பெற உங்கள் account-ல் sign in செய்யவும்.',
      signIn: 'Sign in',
      createAccount: 'Account உருவாக்கவும்',
    } : {
      title: 'Sign in to post a requirement',
      help: 'Sign in to post the service you need and receive proposals from matching verified providers.',
      signIn: 'Sign in',
      createAccount: 'Create account',
    };

    return <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section>
        <span className="eyebrow">{locale === 'ta-IN' ? 'தேவை சந்தை' : 'Requirement marketplace'}</span>
        <h1>{copy.title}</h1>
        <p className="detail-copy">{copy.help}</p>
      </section>
      <Card>
        <EmptyState title={copy.title}>{copy.help}</EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Frequirements" className="button button-primary">{copy.signIn}</Link>
          <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
        </div>
      </Card>
    </div>;
  }

  return <CustomerRequirementsManager />;
}
