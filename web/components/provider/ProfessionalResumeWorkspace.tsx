'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { LiveProviderShell } from './LiveProviderShell';
import { ProviderHeading } from './ProviderPresentation';
import ProfessionalResumeManager from './ProfessionalResumeManager';

type Profile = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  verified: boolean;
};

export default function ProfessionalResumeWorkspace() {
  const { t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/profile', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { profile?: Profile; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error ?? t('provider.resumeWorkspace.profileLoadFallback'));
        if (!cancelled) setProfile(body.profile);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t('provider.resumeWorkspace.resumeLoadFallback')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t]);

  return <LiveProviderShell active="/provider/resume">
    <ProviderHeading
      eyebrow={t('provider.resumeWorkspace.eyebrow')}
      title={t('provider.resumeWorkspace.title')}
      description={t('provider.resumeWorkspace.intro')}
    />
    {loading ? <Card><p>{t('provider.resumeWorkspace.loading')}</p></Card> : null}
    {error ? <Alert title={t('provider.resumeWorkspace.unavailable')} tone="warning">{error}</Alert> : null}
    {!loading && profile?.provider_type === 'business' ? <Alert title={t('provider.resumeWorkspace.individualTitle')} tone="info">{t('provider.resumeWorkspace.individualHelp')}</Alert> : null}
    {!loading && profile?.provider_type === 'professional' ? <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong>{t('provider.resumeWorkspace.exportTitle')}</strong>
          <p style={{ margin: '.35rem 0 0', opacity: .78 }}>{t('provider.resumeWorkspace.exportHelp')}</p>
        </div>
        <Link href="/provider/resume/export" style={{ textDecoration: 'none', border: '1px solid currentColor', borderRadius: '.7rem', padding: '.65rem .9rem', fontWeight: 650 }}>
          {t('provider.resumeWorkspace.exportAction')}
        </Link>
      </div>
    </Card> : null}
    {!loading && profile?.provider_type === 'professional' ? <ProfessionalResumeManager verified={profile.verified} /> : null}
  </LiveProviderShell>;
}
