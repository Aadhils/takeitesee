'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LiveNotificationsPage from '../../components/account/LiveNotificationsPage';
import { Card, EmptyState } from '../../components/ui/primitives';
import { useOperationalTranslations } from '../../components/i18n/OperationalTranslations';
import { getCurrentCustomerAsync } from '../../services/auth-adapter';

export default function NotificationsRoute() {
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
      title: 'அறிவிப்புகளை பார்க்க sign in செய்யவும்',
      help: 'உங்கள் booking, proposal மற்றும் message updates-ஐ பார்க்க உங்கள் account-ல் sign in செய்யவும்.',
      signIn: 'Sign in',
      createAccount: 'Account உருவாக்கவும்',
    } : {
      title: 'Sign in to view notifications',
      help: 'Sign in to your account to see booking, proposal, messaging and service updates.',
      signIn: 'Sign in',
      createAccount: 'Create account',
    };

    return <div className="bookings-page">
      <section className="page-intro">
        <span className="eyebrow">{locale === 'ta-IN' ? 'வாடிக்கையாளர் பகுதி' : 'Customer space'}</span>
        <h1>{locale === 'ta-IN' ? 'அறிவிப்புகள்' : 'Notifications'}</h1>
        <p>{copy.help}</p>
      </section>
      <Card>
        <EmptyState title={copy.title}>{copy.help}</EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Fnotifications" className="button button-primary">{copy.signIn}</Link>
          <Link href="/signup" className="button button-secondary">{copy.createAccount}</Link>
        </div>
      </Card>
    </div>;
  }

  return <LiveNotificationsPage />;
}
