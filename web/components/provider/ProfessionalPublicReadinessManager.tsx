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
  profile_complete: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: 'normal' | 'reverification_required' | 'suspended';
  services_active: number;
  services_paused: number;
  products_paused: number;
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

export default function ProviderPublicReadinessManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const text = useCallback((en: string, ta: string) => tamil ? ta : en, [tamil]);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [publicResumeEnabled, setPublicResumeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profileResponse = await fetch('/api/provider/profile', { cache: 'no-store' });
      const profilePayload = await profileResponse.json() as { profile?: ProviderProfile; error?: string };
      if (!profileResponse.ok || !profilePayload.profile) {
        throw new Error(profilePayload.error ?? text('Unable to load provider profile.', 'Provider profile load செய்ய முடியவில்லை.'));
      }

      setProfile(profilePayload.profile);
      if (profilePayload.profile.provider_type === 'business') {
        setRoles([]);
        setPublicResumeEnabled(false);
        return;
      }

      const [rolesResponse, resumeResponse] = await Promise.all([
        fetch('/api/provider/profile/roles', { cache: 'no-store' }),
        fetch('/api/provider/resume', { cache: 'no-store' }),
      ]);
      const rolesPayload = await rolesResponse.json() as { roles?: ProfessionalRole[]; error?: string };
      const resumePayload = await resumeResponse.json() as ResumePayload;
      if (!rolesResponse.ok) throw new Error(rolesPayload.error ?? text('Unable to load professional roles.', 'Professional roles load செய்ய முடியவில்லை.'));
      if (!resumeResponse.ok) throw new Error(resumePayload.error ?? text('Unable to load career profile.', 'Career profile load செய்ய முடியவில்லை.'));
      setRoles(rolesPayload.roles ?? []);
      setPublicResumeEnabled(Boolean(resumePayload.career_profile?.public_resume_enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Unable to load public profile readiness.', 'Public profile readiness load செய்ய முடியவில்லை.'));
    } finally {
      setLoading(false);
    }
  }, [text]);

  useEffect(() => { void load(); }, [load]);

  const readiness = useMemo(() => {
    if (!profile) return null;
    const professional = profile.provider_type === 'professional';
    const activeRoles = professional ? roles.filter((role) => role.active).length : 0;
    const contentReady = professional
      ? profile.services_active > 0 || activeRoles > 0 || publicResumeEnabled
      : profile.services_active > 0;
    const trustNormal = profile.trust_status === 'normal';
    const trustDetail = profile.trust_status === 'suspended'
      ? text('Public marketplace visibility is paused while this Provider account is suspended. Open Platform Support if you need help with the suspension or restoration path.', 'இந்த Provider account suspended நிலையில் இருக்கும் வரை public marketplace visibility pause ஆகும். Suspension அல்லது restoration path குறித்து உதவி தேவைப்பட்டால் Platform Support-ஐ திறக்கவும்.')
      : profile.trust_status === 'reverification_required'
        ? text('Fresh verification is required before marketplace trust access and public visibility can resume.', 'Marketplace trust access மற்றும் public visibility மீண்டும் தொடங்க fresh verification தேவை.')
        : text('Marketplace trust state allows this Provider identity to be shown publicly.', 'Marketplace trust state இந்த Provider identity-ஐ public-ஆக காட்ட அனுமதிக்கிறது.');
    const trustStep: ReadinessStep = {
      key: 'trust',
      done: trustNormal,
      label: text('Marketplace trust access', 'Marketplace trust access'),
      detail: trustDetail,
      href: profile.trust_status === 'reverification_required'
        ? '/provider/verification'
        : profile.trust_status === 'suspended'
          ? '/account/support'
          : '/provider/public-readiness',
    };

    const steps: ReadinessStep[] = professional ? [
      {
        key: 'basics',
        done: profile.profile_complete,
        label: text('Complete public profile basics', 'Public profile அடிப்படை விவரங்களை முடிக்கவும்'),
        detail: text('Headline/name, description and service area must be complete before the Professional profile can open publicly.', 'Professional profile public ஆக திறக்க headline/name, description மற்றும் service area முழுமையாக இருக்க வேண்டும்.'),
        href: '/provider/profile',
      },
      {
        key: 'verification',
        done: profile.verified,
        label: text('Complete provider verification', 'Provider verification-ஐ முடிக்கவும்'),
        detail: text('The Professional identity must be verified before the public profile can open.', 'Public profile open ஆக Professional identity verified ஆக இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      {
        key: 'disclosure',
        done: profile.marketplace_disclosure_complete,
        label: text('Complete marketplace disclosure', 'Marketplace disclosure-ஐ முடிக்கவும்'),
        detail: text('Legal identity, public contact, principal address and grievance contact must be present.', 'Legal identity, public contact, principal address மற்றும் grievance contact இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      trustStep,
    ] : [
      {
        key: 'verification',
        done: profile.verified,
        label: text('Complete provider verification', 'Provider verification-ஐ முடிக்கவும்'),
        detail: text('The Business identity must be verified before the public storefront can open.', 'Public storefront open ஆக Business identity verified ஆக இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      {
        key: 'disclosure',
        done: profile.marketplace_disclosure_complete,
        label: text('Complete marketplace disclosure', 'Marketplace disclosure-ஐ முடிக்கவும்'),
        detail: text('Legal identity, public contact, principal address and grievance contact must be present on the Business profile.', 'Business profile-ல் legal identity, public contact, principal address மற்றும் grievance contact இருக்க வேண்டும்.'),
        href: '/provider/verification',
      },
      trustStep,
    ];

    return {
      professional,
      activeRoles,
      contentReady,
      steps,
      publicProfileReady: steps.every((step) => step.done),
      completed: steps.filter((step) => step.done).length,
      pausedOfferingCount: profile.services_paused + (professional ? 0 : profile.products_paused),
    };
  }, [profile, publicResumeEnabled, roles, text]);

  const publicHref = profile
    ? profile.provider_type === 'business'
      ? `/businesses/${encodeURIComponent(profile.id)}`
      : `/professionals/${encodeURIComponent(profile.id)}`
    : '/provider/public-readiness';

  return <LiveProviderShell active="/provider/public-readiness">
    <ProviderHeading
      eyebrow={text('Public marketplace', 'Public marketplace')}
      title={profile?.provider_type === 'business'
        ? text('Business public storefront readiness', 'Business public storefront readiness')
        : text('Professional public profile readiness', 'Professional public profile readiness')}
      description={profile?.provider_type === 'business'
        ? text('See exactly what is required before customers can open your public Business storefront, and keep service-launch readiness separate.', 'Customers உங்கள் public Business storefront-ஐ பார்க்க என்ன தேவை, service-launch readiness எது என்று தனித்தனியாக இங்கே பார்க்கலாம்.')
        : text('See exactly what is required before customers can open your public Professional profile, and keep discovery content separate.', 'Customers உங்கள் public Professional profile-ஐ பார்க்க என்ன தேவை, discovery content எது என்று தனித்தனியாக இங்கே பார்க்கலாம்.')}
    />

    {loading ? <Card><p>{text('Checking public profile readiness…', 'Public profile readiness check ஆகிறது…')}</p></Card> : null}
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{text('Reload', 'மீண்டும் load செய்')}</Button></Card> : null}

    {readiness && profile ? <>
      <Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{text('Public visibility', 'Public visibility')}</span>
            <h2>{readiness.completed}/{readiness.steps.length} {text('visibility gates complete', 'visibility gates complete')}</h2>
          </div>
          <Badge tone={readiness.publicProfileReady ? 'success' : 'warning'}>
            {readiness.publicProfileReady
              ? profile.provider_type === 'business' ? text('Public storefront ready', 'Public storefront ready') : text('Public profile ready', 'Public profile ready')
              : text('Action required', 'Action required')}
          </Badge>
        </div>
        <p>{readiness.publicProfileReady
          ? profile.provider_type === 'business'
            ? text('Your verified Business identity, marketplace disclosure and trust state are ready for the public storefront.', 'உங்கள் verified Business identity, marketplace disclosure மற்றும் trust state public storefront-க்கு ready.')
            : text('Your Professional profile basics, verification, marketplace disclosure and trust state are ready for public visibility.', 'உங்கள் Professional profile basics, verification, marketplace disclosure மற்றும் trust state public visibility-க்கு ready.')
          : text('Complete only the items marked Required below. Completed items do not need to be repeated.', 'கீழே Required என்று உள்ள items மட்டும் complete செய்யுங்கள். ஏற்கனவே Done ஆனவற்றை repeat செய்ய தேவையில்லை.')}</p>
        {readiness.publicProfileReady ? <Link href={publicHref} className="button button-primary">{profile.provider_type === 'business' ? text('View public storefront', 'Public storefront பார்க்க') : text('View public profile', 'Public profile பார்க்க')}</Link> : null}
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

      {profile.trust_status === 'normal' && readiness.pausedOfferingCount > 0 ? <Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{text('Marketplace re-entry', 'Marketplace re-entry')}</span>
            <h2>{text('Review paused offerings before publishing again', 'மீண்டும் publish செய்வதற்கு முன் paused offerings-ஐ review செய்யவும்')}</h2>
          </div>
          <Badge tone="warning">{readiness.pausedOfferingCount} {text('paused', 'paused')}</Badge>
        </div>
        <p>{text('Your trust state is normal, but paused Services or Products stay private until you explicitly review and reactivate what should return to the marketplace. Nothing is auto-published after recovery.', 'உங்கள் trust state normal. ஆனால் paused Services அல்லது Products நீங்கள் review செய்து re-activate செய்யும் வரை private-ஆகவே இருக்கும். Recovery பிறகு எதுவும் automatically publish ஆகாது.')}</p>
        <div className="provider-review-summary">
          <div><strong>{profile.services_paused}</strong><span>{text('Paused services', 'Paused services')}</span></div>
          {profile.provider_type === 'business' ? <div><strong>{profile.products_paused}</strong><span>{text('Paused products', 'Paused products')}</span></div> : null}
        </div>
        <div className="button-row">
          {profile.services_paused > 0 ? <Link href="/provider/services" className="button button-primary">{text('Review Services', 'Services review செய்ய')}</Link> : null}
          {profile.provider_type === 'business' && profile.products_paused > 0 ? <Link href="/provider/products" className="button button-secondary">{text('Review Products', 'Products review செய்ய')}</Link> : null}
          <Link href="/provider/handle" className="button button-secondary">{text('Review @handle', '@handle review செய்ய')}</Link>
        </div>
      </Card> : null}

      {profile.provider_type === 'business' ? <Card>
        <div className="section-heading">
          <div><span className="eyebrow">{text('Service launch quality', 'Service launch quality')}</span><h2>{text('Business profile basics', 'Business profile basics')}</h2></div>
          <Badge tone={profile.profile_complete ? 'success' : 'warning'}>{profile.profile_complete ? text('Complete', 'Complete') : text('Required for services', 'Services-க்கு required')}</Badge>
        </div>
        <p>{profile.profile_complete
          ? text('Business name, description and service area are complete for service activation.', 'Business name, description மற்றும் service area service activation-க்கு complete.')
          : text('Your storefront identity may have separate visibility rules, but active marketplace services still require Business name, description and service area to be complete.', 'Storefront visibility rules தனியாக இருந்தாலும் active marketplace services-க்கு Business name, description மற்றும் service area complete ஆக வேண்டும்.')}</p>
        {!profile.profile_complete ? <Link href="/provider/profile" className="button button-secondary">{text('Complete Business profile', 'Business profile complete செய்ய')}</Link> : null}
      </Card> : null}

      <Card>
        <div className="section-heading">
          <div><span className="eyebrow">{text('Discovery content', 'Discovery content')}</span><h2>{profile.provider_type === 'business' ? text('What customers can discover from services', 'Services மூலம் customers என்ன discover செய்யலாம்') : text('What customers can discover', 'Customers என்ன discover செய்யலாம்')}</h2></div>
          <Badge tone={readiness.contentReady ? 'success' : 'warning'}>{readiness.contentReady ? text('Content available', 'Content available') : text('Add content', 'Content சேர்க்கவும்')}</Badge>
        </div>
        {profile.provider_type === 'professional' ? <div className="provider-review-summary">
          <div><strong>{profile.services_active}</strong><span>{text('Active services', 'Active services')}</span></div>
          <div><strong>{readiness.activeRoles}</strong><span>{text('Active professional roles', 'Active professional roles')}</span></div>
          <div><strong>{publicResumeEnabled ? 'Yes' : 'No'}</strong><span>{text('Published career profile', 'Published career profile')}</span></div>
        </div> : <div className="provider-review-summary">
          <div><strong>{profile.services_active}</strong><span>{text('Active services', 'Active services')}</span></div>
        </div>}
        <p className="summary-note">{profile.provider_type === 'business'
          ? text('Active services improve marketplace discovery. Approved public Products are managed separately in the Business Products workspace and can also appear on the storefront.', 'Active services marketplace discovery-ஐ மேம்படுத்தும். Approved public Products Business Products workspace-ல் தனியாக manage செய்யப்படும்; அவையும் storefront-ல் தோன்றலாம்.')
          : text('An active service, active professional role or published career profile adds useful discovery content. These are discovery signals, not the base public-profile visibility gate.', 'Active service, active professional role அல்லது published career profile discovery content சேர்க்கும். இவை base public-profile visibility gate அல்ல.')}</p>
        {!readiness.contentReady ? <div className="button-row">
          {profile.provider_type === 'professional' ? <>
            <Link href="/provider/profile" className="button button-secondary">{text('Add professional role', 'Professional role சேர்க்க')}</Link>
            <Link href="/provider/services" className="button button-secondary">{text('Create service', 'Service உருவாக்க')}</Link>
            <Link href="/provider/resume" className="button button-secondary">{text('Publish career profile', 'Career profile publish செய்ய')}</Link>
          </> : <>
            <Link href="/provider/services" className="button button-secondary">{text('Create service', 'Service உருவாக்க')}</Link>
            <Link href="/provider/products" className="button button-secondary">{text('Manage Products', 'Products manage செய்ய')}</Link>
          </>}
        </div> : null}
      </Card>

      {profile.trust_status !== 'normal' ? <Alert title={text('Public visibility paused by trust state', 'Trust state காரணமாக public visibility pause')} tone={profile.trust_status === 'suspended' ? 'danger' : 'warning'}>
        {profile.trust_status === 'suspended' ? <>
          <p>{text('Your Provider public profile/storefront, public talents and published career data stay unavailable while the account is suspended. Existing private account and booking operations remain separate.', 'Provider account suspended இருக்கும் வரை public profile/storefront, public talents மற்றும் published career data unavailable ஆக இருக்கும். Existing private account மற்றும் booking operations தனியாக தொடரும்.')}</p>
          <div className="button-row"><Link href="/account/support" className="button button-secondary">{text('Open Platform Support', 'Platform Support திறக்க')}</Link></div>
        </> : <>
          <p>{text('Your public marketplace presence stays unavailable until fresh verification restores normal trust access.', 'Fresh verification normal trust access-ஐ restore செய்யும் வரை public marketplace presence unavailable ஆக இருக்கும்.')}</p>
          <div className="button-row"><Link href="/provider/verification" className="button button-secondary">{text('Continue re-verification', 'Re-verification continue செய்ய')}</Link></div>
        </>}
      </Alert> : null}

      {!profile.marketplace_disclosure_complete ? <Alert title={text('Why disclosure is required', 'Disclosure ஏன் தேவை')} tone="warning">
        {profile.provider_type === 'business'
          ? text('The public Business storefront stays unavailable until the approved marketplace disclosure is complete. Open Verification to submit or refresh public legal and grievance details.', 'Approved marketplace disclosure complete ஆகும் வரை public Business storefront unavailable ஆக இருக்கும். Public legal மற்றும் grievance details-ஐ submit/refresh செய்ய Verification-ஐ திறக்கவும்.')
          : text('The public Professional page stays unavailable until the approved marketplace disclosure is complete. Open Verification to submit or refresh public legal and grievance details.', 'Approved marketplace disclosure complete ஆகும் வரை public Professional page unavailable ஆக இருக்கும். Public legal மற்றும் grievance details-ஐ submit/refresh செய்ய Verification-ஐ திறக்கவும்.')}
      </Alert> : null}
    </> : null}
  </LiveProviderShell>;
}
