'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProviderOnboarding } from '../../../../components/provider/ProviderOnboarding';
import { Card, EmptyState } from '../../../../components/ui/primitives';
import { useIdentityWorkspaceTranslations } from '../../../../components/i18n/IdentityWorkspaceTranslations';
import { useLanguage } from '../../../../components/i18n/LanguageProvider';
import { getCurrentCustomerAsync } from '../../../../services/auth-adapter';

export default function ProviderOnboardingRoute() {
  const { t } = useIdentityWorkspaceTranslations();
  const { locale } = useLanguage();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getCurrentCustomerAsync()
      .then((auth) => { if (active) setAuthenticated(auth.authenticated); })
      .catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);

  if (authenticated === null) {
    return <div className="auth-page provider-onboarding-page"><Card><p>{locale === 'ta-IN' ? 'உங்கள் account-ஐ சரிபார்க்கிறது…' : 'Checking your account…'}</p></Card></div>;
  }

  if (!authenticated) {
    return <div className="auth-page provider-onboarding-page">
      <section className="page-intro">
        <span className="eyebrow">{t('onboarding.title')}</span>
        <h1>{t('onboarding.startProviding')}</h1>
        <p>{t('onboarding.startIntro')}</p>
      </section>
      <Card>
        <EmptyState title={t('onboarding.signInRequired')}>{t('onboarding.startIntro')}</EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Fprovider%2Fonboarding" className="button button-primary">{t('onboarding.signInApply')}</Link>
          <Link href="/signup?returnTo=%2Fprovider%2Fonboarding" className="button button-secondary">{t('auth.createAccount')}</Link>
        </div>
      </Card>
    </div>;
  }

  return <ProviderOnboarding />;
}
