'use client';

import { useEffect, useState } from 'react';
import { Alert, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { LiveProviderShell } from './LiveProviderShell';
import { ProviderHeading } from './ProviderPresentation';
import ProfessionalPortfolioMediaManager from './ProfessionalPortfolioMediaManager';

type Profile = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  verified: boolean;
};

type Role = {
  id: string;
  title: string;
  active: boolean;
};

export default function ProfessionalPortfolioWorkspace() {
  const { t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch('/api/provider/profile', { cache: 'no-store' }),
      fetch('/api/provider/profile/roles', { cache: 'no-store' }),
    ]).then(async ([profileResponse, rolesResponse]) => {
      const profileBody = await profileResponse.json() as { profile?: Profile; error?: string };
      if (!profileResponse.ok || !profileBody.profile) throw new Error(profileBody.error ?? t('provider.portfolioWorkspace.unableToLoadProviderProfile'));
      let roleItems: Role[] = [];
      if (profileBody.profile.provider_type === 'professional' && rolesResponse.ok) {
        const rolesBody = await rolesResponse.json() as { roles?: Role[] };
        roleItems = rolesBody.roles ?? [];
      }
      if (!cancelled) {
        setProfile(profileBody.profile);
        setRoles(roleItems);
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : t('provider.portfolioWorkspace.unableToLoadProfessionalPortfolio'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [t]);

  return <LiveProviderShell active="/provider/portfolio">
    <ProviderHeading
      eyebrow={t('provider.portfolioWorkspace.professionalIdentity')}
      title={t('provider.portfolioWorkspace.portfolioWorkShowcase')}
      description={t('provider.portfolioWorkspace.description')}
    />
    {loading ? <Card><p>{t('provider.portfolioWorkspace.loadingPortfolio')}</p></Card> : null}
    {error ? <Alert title={t('provider.portfolioWorkspace.portfolioUnavailable')} tone="warning">{error}</Alert> : null}
    {!loading && profile?.provider_type === 'business' ? <Alert title={t('provider.portfolioWorkspace.professionalPortfolio')} tone="info">{t('provider.portfolioWorkspace.businessInfo')}</Alert> : null}
    {!loading && profile?.provider_type === 'professional' ? <ProfessionalPortfolioMediaManager professionalId={profile.id} roles={roles} verified={profile.verified} /> : null}
  </LiveProviderShell>;
}