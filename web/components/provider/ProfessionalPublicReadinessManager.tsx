'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type ProviderProfile = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  description: string;
  location: string;
  verified: boolean;
  marketplace_disclosure_complete: boolean;
  services_active: number;
};

type ProfessionalRole = { id: string; active: boolean };
type ResumePayload = { career_profile?: { public_resume_enabled?: boolean } | null; error?: string };

type ReadinessStep = {
  key: string;
  done: boolean;
  label: string;
  detail: string;
  href: string;
};

export default function ProfessionalPublicReadinessManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = (en: string, ta: string) => tamil ? ta : en;
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [publicResumeEnabled, setPublicResumeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileResponse, rolesResponse, resumeResponse] = await Promise.all([
        fetch('/api/provider/profile', { cache: 'no-store' }),
        fetch('/api/provider/profile/roles', { cache: 'no-store' }),
        fetch('/api/provider/resume', { cache: 'no-store' }),
      ]);
      const profilePayload = await profileResponse.json() as { profile?: ProviderProfile; error?: string };
      const rolesPayload = await rolesResponse.json() as { roles?: ProfessionalRole[]; error?: string };
      const resumePayload = await resumeResponse.json() as ResumePayload;
      if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error ?? text('Unable to load provider profile.', 'Provider profile load செய்ய முடியவில்லை.'));
      if (profilePayload.profile.provider_type !== 'professional') {
        setProfile(profilePayload.profile);
        setRoles([]);
        setPublicResumeEnabled(false);
        return;
      }
      if (!rolesResponse.ok) throw new Error(rolesPayload.error ?? text('Unable to load professional roles.', 'Professional roles load செய்ய முடியவில்லை.'));
      if (!resumeResponse.ok) throw new Error(resumePayload.error ?? text('Unable to load career profile.', 'Career profile load செய்ய முடியவில்லை.'));
      setProfile(profilePayload.profile);
      setRoles(rolesPayload.roles ?? []);
      setPublicResumeEnabled(Boolean(resumePayload.career_profile?.public_resume_enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Unable to load public profile readiness.', 'Public profile readiness load செய்ய முடியவில்லை.'));
    } finally {
      setLoading(false);
    }
  }, [tamil]);

  useEffect(() => { void load(); }, [load]);

  const readiness = useMemo(() => {
    if (!profile || profile.provider_type !== 'professional') return null;
    const basicsComplete = profile.display_name.trim().length >= 2
      && profile.description.trim().length >= 20
      && profile.location.trim().length >= 2;
    const activeRoles = roles.filter((role) => role.active).length;
    const contentReady = profile.services_active > 0 || activeRoles > 0 || publicResumeEnabled;
    const steps: ReadinessStep[] = [
      {
        key: 'basics',
        done: basicsComplete,
        label: text('Complete public profile basics', 'Public profile அடிப்படை விவரங்களை முடிக்கவும்'),
        detail: text('Headline/name, description and service area must be complete.', 'Headline/name, description மற்றும் service area முழுமையாக இருக்க வேண்டும்.'),
        href: '/provider/profile',
      },
      {
        key: 'verification',
        done: profile.verified,
        label: text('Complete provider verification', 'Provider verification-ஐ முடிக்கவும்'),
        detail: text('The professional identity must be verified before the public profile can open.', 'Public profile open ஆக professional identity verified ஆக இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      {
        key: 'disclosure',
        done: profile.marketplace_disclosure_complete,
        label: text('Complete marketplace disclosure', 'Marketplace disclosure-ஐ முடிக்கவும்'),
        detail: text('Legal identity, public contact, principal address and grievance contact must be present on the verified profile.', 'Legal identity, public contact, principal address மற்றும் grievance contact verified profile-ல் இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      {
        key: 'content',
        done: contentReady,
        label: text('Publish at least one professional offering', 'குறைந்தது ஒரு professional offering-ஐ publish செய்யவும்'),
        detail: text('An active service, an active professional role, or a published career profile is enough to make the profile useful and indexable.', 'Active service, active professional role அல்லது published career profile — இவற்றில் ஏதேனும் ஒன்று இருந்தால் profile useful மற்றும் indexable ஆகும்.'),
        href: '/provider/profile',
      },
    ];
    return {
      basicsComplete,
      activeRoles,
      contentReady,
      steps,
      ready: steps.every((step) => step.done),
      completed: steps.filter((step) => step.done).length,
    };
  }, [profile, publicResumeEnabled, roles, tamil]);

  return <LiveProviderShell active="/provider/public-readiness">
    <ProviderHeading
      eyebrow={text('Public marketplace', 'Public marketplace')}
      title={text('Professional public profile readiness', 'Professional public profile readiness')}
      description={text(
        'See exactly what is blocking your verified professional profile from becoming a useful public TakeItEsee profile.',
        'உங்கள் verified professional profile public TakeItEsee profile ஆக வர எந்த item pending என்று இங்கே தெளிவாக பார்க்கலாம்.',
      )}
    />

    {loading ? <Card><p>{text('Checking public profile readiness…', 'Public profile readiness check ஆகிறது…')}</p></Card> : null}
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{text('Reload', 'மீண்டும் load செய்')}</Button></Card> : null}

    {!loading && profile?.provider_type === 'business' ? <Alert title={text('Professional profile required', 'Professional profile தேவை')} tone="warning">
      {text('This readiness workspace is only for Professional providers.', 'இந்த readiness workspace Professional providers-க்கு மட்டும்.')}
    </Alert> : null}

    {readiness && profile ? <>
      <Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{text('Readiness summary', 'Readiness summary')}</span>
            <h2>{readiness.completed}/4 {text('public gates complete', 'public gates complete')}</h2>
          </div>
          <Badge tone={readiness.ready ? 'success' : 'warning'}>{readiness.ready ? text('Public profile ready', 'Public profile ready') : text('Action required', 'Action required')}</Badge>
        </div>
        <p>{readiness.ready
          ? text('Your professional profile has the identity, disclosure and public content needed for the public marketplace.', 'உங்கள் professional profile-க்கு public marketplace தேவையான identity, disclosure மற்றும் public content அனைத்தும் உள்ளது.')
          : text('Complete only the items marked Required below. Existing completed items do not need to be repeated.', 'கீழே Required என்று உள்ள items மட்டும் complete செய்யுங்கள். ஏற்கனவே Done ஆனவற்றை repeat செய்ய தேவையில்லை.')}</p>
        {readiness.ready ? <Link href={`/professionals/${encodeURIComponent(profile.id)}`} className="button button-primary">{text('View public profile', 'Public profile பார்க்க')}</Link> : null}
      </Card>

      <div className="provider-profile-grid">
        {readiness.steps.map((step, index) => <Card className="provider-profile-card" key={step.key}>
          <div className="section-heading">
            <div><span className="eyebrow">{text(`Gate ${index + 1}`, `Gate ${index + 1}`)}</span><h2>{step.label}</h2></div>
            <Badge tone={step.done ? 'success' : 'warning'}>{step.done ? text('Done', 'Done') : text('Required', 'Required')}</Badge>
          </div>
          <p>{step.detail}</p>
          <Link href={step.href} className="text-link">{step.done ? text('Review', 'Review') : text('Continue', 'Continue')} →</Link>
        </Card>)}
      </div>

      <Card>
        <div className="section-heading">
          <div><span className="eyebrow">{text('Public content signals', 'Public content signals')}</span><h2>{text('What customers can discover', 'Customers என்ன discover செய்யலாம்')}</h2></div>
          <Badge tone={readiness.contentReady ? 'success' : 'warning'}>{readiness.contentReady ? text('Content available', 'Content available') : text('Add one', 'ஒன்று சேர்க்கவும்')}</Badge>
        </div>
        <div className="provider-review-summary">
          <div><strong>{profile.services_active}</strong><span>{text('Active services', 'Active services')}</span></div>
          <div><strong>{readiness.activeRoles}</strong><span>{text('Active professional roles', 'Active professional roles')}</span></div>
          <div><strong>{publicResumeEnabled ? 'Yes' : 'No'}</strong><span>{text('Published career profile', 'Published career profile')}</span></div>
        </div>
        {!readiness.contentReady ? <div className="button-row">
          <Link href="/provider/profile" className="button button-secondary">{text('Add professional role', 'Professional role சேர்க்க')}</Link>
          <Link href="/provider/services" className="button button-secondary">{text('Create service', 'Service உருவாக்க')}</Link>
          <Link href="/provider/resume" className="button button-secondary">{text('Publish career profile', 'Career profile publish செய்ய')}</Link>
        </div> : null}
      </Card>

      {!profile.marketplace_disclosure_complete ? <Alert title={text('Why disclosure is required', 'Disclosure ஏன் தேவை')} tone="warning">
        {text(
          'The public Professional page intentionally stays unavailable until the approved marketplace disclosure is complete. Open Verification to submit or refresh those public legal and grievance details.',
          'Approved marketplace disclosure complete ஆகும் வரை public Professional page intentionally unavailable ஆக இருக்கும். Public legal மற்றும் grievance details-ஐ submit/refresh செய்ய Verification-ஐ திறக்கவும்.',
        )}
      </Alert> : null}
    </> : null}
  </LiveProviderShell>;
}
