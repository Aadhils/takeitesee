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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/profile', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { profile?: Profile; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error ?? 'Unable to load provider profile.');
        if (!cancelled) setProfile(body.profile);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load professional resume.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <LiveProviderShell active="/provider/resume">
    <ProviderHeading
      eyebrow={text('Professional career identity', 'Professional career identity')}
      title={text('Resume & career profile', 'Resume & career profile')}
      description={text(
        'Build one structured career profile with skills, experience, education and certifications. Keep it private while editing, then publish it on your verified professional profile when ready.',
        'Skills, experience, education, certifications அனைத்தையும் ஒரே structured career profile-ல் அமைக்கலாம். Edit செய்யும் வரை private-ஆ வைத்து, ready ஆன பிறகு verified professional profile-ல் publish செய்யலாம்.',
      )}
    />
    {loading ? <Card><p>{text('Loading career profile…', 'Career profile load ஆகிறது…')}</p></Card> : null}
    {error ? <Alert title={text('Career profile unavailable', 'Career profile கிடைக்கவில்லை')} tone="warning">{error}</Alert> : null}
    {!loading && profile?.provider_type === 'business' ? <Alert title={text('Individual career profile', 'Individual career profile')} tone="info">{text(
      'Resume and career data belongs to an individual professional identity. Business hiring/employer features will be a separate workflow.',
      'Resume / career data individual professional identity-க்கு. Business hiring / employer features தனி workflow ஆக இருக்கும்.',
    )}</Alert> : null}
    {!loading && profile?.provider_type === 'professional' ? <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong>{text('PDF resume export', 'PDF resume export')}</strong>
          <p style={{ margin: '.35rem 0 0', opacity: .78 }}>{text(
            'Open a clean A4 resume preview, then use Save as PDF or Print. Your private resume does not need to be published first.',
            'Clean A4 resume preview-ஐ open செய்து Save as PDF அல்லது Print செய்யலாம். Private resume-ஐ முதலில் public publish செய்ய வேண்டியதில்லை.',
          )}</p>
        </div>
        <Link href="/provider/resume/export" style={{ textDecoration: 'none', border: '1px solid currentColor', borderRadius: '.7rem', padding: '.65rem .9rem', fontWeight: 650 }}>
          {text('Export PDF', 'PDF Export')}
        </Link>
      </div>
    </Card> : null}
    {!loading && profile?.provider_type === 'professional' ? <ProfessionalResumeManager verified={profile.verified} /> : null}
  </LiveProviderShell>;
}
