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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
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
      if (!profileResponse.ok || !profileBody.profile) throw new Error(profileBody.error ?? 'Unable to load provider profile.');
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
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load professional portfolio.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <LiveProviderShell active="/provider/portfolio">
    <ProviderHeading
      eyebrow={text('Professional identity', 'Professional identity')}
      title={text('Portfolio & work showcase', 'Portfolio & work showcase')}
      description={text(
        'Build a visual professional profile with real photos and videos of your work. Link each sample to one of your talents when useful.',
        'உங்கள் work photos/videos மூலம் visual professional profile உருவாக்குங்கள். தேவையான work sample-ஐ உங்கள் talent / role-க்கு link செய்யலாம்.',
      )}
    />
    {loading ? <Card><p>{text('Loading portfolio…', 'Portfolio load ஆகிறது…')}</p></Card> : null}
    {error ? <Alert title={text('Portfolio unavailable', 'Portfolio கிடைக்கவில்லை')} tone="warning">{error}</Alert> : null}
    {!loading && profile?.provider_type === 'business' ? <Alert title={text('Professional portfolio', 'Professional portfolio')} tone="info">{text(
      'This portfolio workspace is for individual professional profiles. Business media can be introduced as a separate business-profile feature later.',
      'இந்த portfolio workspace individual professional profiles-க்கு. Business media தனி business-profile feature ஆக பின்னர் உருவாக்கலாம்.',
    )}</Alert> : null}
    {!loading && profile?.provider_type === 'professional' ? <ProfessionalPortfolioMediaManager professionalId={profile.id} roles={roles} verified={profile.verified} /> : null}
  </LiveProviderShell>;
}