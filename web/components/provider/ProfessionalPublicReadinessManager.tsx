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
  const { t } = useIdentityWorkspaceTranslations();
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
        throw new Error(profilePayload.error ?? t('provider.publicReadiness.unableToLoadProviderProfile'));
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
      if (!rolesResponse.ok) throw new Error(rolesPayload.error ?? t('provider.publicReadiness.unableToLoadProfessionalRoles'));
      if (!resumeResponse.ok) throw new Error(resumePayload.error ?? t('provider.publicReadiness.unableToLoadCareerProfile'));
      setRoles(rolesPayload.roles ?? []);
      setPublicResumeEnabled(Boolean(resumePayload.career_profile?.public_resume_enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.publicReadiness.unableToLoadPublicProfileReadiness'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      ? t('provider.publicReadiness.publicMarketplaceVisibilityIsPausedWhileThisProviderAccountIs')
      : profile.trust_status === 'reverification_required'
        ? t('provider.publicReadiness.freshVerificationIsRequiredBeforeMarketplaceTrustAccessAndPublic')
        : t('provider.publicReadiness.marketplaceTrustStateAllowsThisProviderIdentityToBeShown');
    const trustStep: ReadinessStep = {
      key: 'trust',
      done: trustNormal,
      label: t('provider.publicReadiness.marketplaceTrustAccess'),
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
        label: t('provider.publicReadiness.completePublicProfileBasics'),
        detail: t('provider.publicReadiness.headlineNameDescriptionAndServiceAreaMustBeCompleteBefore'),
        href: '/provider/profile',
      },
      {
        key: 'verification',
        done: profile.verified,
        label: t('provider.publicReadiness.completeProviderVerification'),
        detail: t('provider.publicReadiness.theProfessionalIdentityMustBeVerifiedBeforeThePublicProfile'),
        href: '/provider/verification',
      },
      {
        key: 'disclosure',
        done: profile.marketplace_disclosure_complete,
        label: t('provider.publicReadiness.completeMarketplaceDisclosure'),
        detail: t('provider.publicReadiness.legalIdentityPublicContactPrincipalAddressAndGrievanceContactMust'),
        href: '/provider/verification',
      },
      trustStep,
    ] : [
      {
        key: 'verification',
        done: profile.verified,
        label: t('provider.publicReadiness.completeProviderVerification'),
        detail: t('provider.publicReadiness.theBusinessIdentityMustBeVerifiedBeforeThePublicStorefront'),
        href: '/provider/verification',
      },
      {
        key: 'disclosure',
        done: profile.marketplace_disclosure_complete,
        label: t('provider.publicReadiness.completeMarketplaceDisclosure'),
        detail: t('provider.publicReadiness.legalIdentityPublicContactPrincipalAddressAndGrievanceContactMust2'),
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
  }, [profile, publicResumeEnabled, roles, t]);

  const publicHref = profile
    ? profile.provider_type === 'business'
      ? `/businesses/${encodeURIComponent(profile.id)}`
      : `/professionals/${encodeURIComponent(profile.id)}`
    : '/provider/public-readiness';

  return <LiveProviderShell active="/provider/public-readiness">
    <ProviderHeading
      eyebrow={t('provider.publicReadiness.publicMarketplace')}
      title={profile?.provider_type === 'business'
        ? t('provider.publicReadiness.businessPublicStorefrontReadiness')
        : t('provider.publicReadiness.professionalPublicProfileReadiness')}
      description={profile?.provider_type === 'business'
        ? t('provider.publicReadiness.seeExactlyWhatIsRequiredBeforeCustomersCanOpenYour')
        : t('provider.publicReadiness.seeExactlyWhatIsRequiredBeforeCustomersCanOpenYour2')}
    />

    {loading ? <Card><p>{t('provider.publicReadiness.checkingPublicProfileReadiness')}</p></Card> : null}
    {error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('provider.publicReadiness.reload')}</Button></Card> : null}

    {readiness && profile ? <>
      <Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('provider.publicReadiness.publicVisibility')}</span>
            <h2>{readiness.completed}/{readiness.steps.length} {t('provider.publicReadiness.visibilityGatesComplete')}</h2>
          </div>
          <Badge tone={readiness.publicProfileReady ? 'success' : 'warning'}>
            {readiness.publicProfileReady
              ? profile.provider_type === 'business' ? t('provider.publicReadiness.publicStorefrontReady') : t('provider.publicReadiness.publicProfileReady')
              : t('provider.publicReadiness.actionRequired')}
          </Badge>
        </div>
        <p>{readiness.publicProfileReady
          ? profile.provider_type === 'business'
            ? t('provider.publicReadiness.yourVerifiedBusinessIdentityMarketplaceDisclosureAndTrustStateAre')
            : t('provider.publicReadiness.yourProfessionalProfileBasicsVerificationMarketplaceDisclosureAndTrustState')
          : t('provider.publicReadiness.completeOnlyTheItemsMarkedRequiredBelowCompletedItemsDo')}</p>
        {readiness.publicProfileReady ? <Link href={publicHref} className="button button-primary">{profile.provider_type === 'business' ? t('provider.publicReadiness.viewPublicStorefront') : t('provider.publicReadiness.viewPublicProfile')}</Link> : null}
      </Card>

      <div className="provider-profile-grid">
        {readiness.steps.map((step, index) => <Card className="provider-profile-card" key={step.key}>
          <div className="section-heading">
            <div><span className="eyebrow">{`${t('provider.publicReadiness.gate')} ${index + 1}`}</span><h2>{step.label}</h2></div>
            <Badge tone={step.done ? 'success' : 'warning'}>{step.done ? t('provider.publicReadiness.done') : t('provider.publicReadiness.required')}</Badge>
          </div>
          <p>{step.detail}</p>
          <Link href={step.href} className="text-link">{step.done ? t('provider.publicReadiness.review') : t('provider.publicReadiness.continue')} →</Link>
        </Card>)}
      </div>

      {profile.trust_status === 'normal' && readiness.pausedOfferingCount > 0 ? <Card>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('provider.publicReadiness.marketplaceReEntry')}</span>
            <h2>{t('provider.publicReadiness.reviewPausedOfferingsBeforePublishingAgain')}</h2>
          </div>
          <Badge tone="warning">{readiness.pausedOfferingCount} {t('provider.publicReadiness.paused')}</Badge>
        </div>
        <p>{t('provider.publicReadiness.yourTrustStateIsNormalButPausedServicesOrProducts')}</p>
        <div className="provider-review-summary">
          <div><strong>{profile.services_paused}</strong><span>{t('provider.publicReadiness.pausedServices')}</span></div>
          {profile.provider_type === 'business' ? <div><strong>{profile.products_paused}</strong><span>{t('provider.publicReadiness.pausedProducts')}</span></div> : null}
        </div>
        <div className="button-row">
          {profile.services_paused > 0 ? <Link href="/provider/services" className="button button-primary">{t('provider.publicReadiness.reviewServices')}</Link> : null}
          {profile.provider_type === 'business' && profile.products_paused > 0 ? <Link href="/provider/products" className="button button-secondary">{t('provider.publicReadiness.reviewProducts')}</Link> : null}
          <Link href="/provider/handle" className="button button-secondary">{t('provider.publicReadiness.reviewHandleHandle')}</Link>
        </div>
      </Card> : null}

      {profile.provider_type === 'business' ? <Card>
        <div className="section-heading">
          <div><span className="eyebrow">{t('provider.publicReadiness.serviceLaunchQuality')}</span><h2>{t('provider.publicReadiness.businessProfileBasics')}</h2></div>
          <Badge tone={profile.profile_complete ? 'success' : 'warning'}>{profile.profile_complete ? t('provider.publicReadiness.complete') : t('provider.publicReadiness.requiredForServices')}</Badge>
        </div>
        <p>{profile.profile_complete
          ? t('provider.publicReadiness.businessNameDescriptionAndServiceAreaAreCompleteForService')
          : t('provider.publicReadiness.yourStorefrontIdentityMayHaveSeparateVisibilityRulesButActive')}</p>
        {!profile.profile_complete ? <Link href="/provider/profile" className="button button-secondary">{t('provider.publicReadiness.completeBusinessProfile')}</Link> : null}
      </Card> : null}

      <Card>
        <div className="section-heading">
          <div><span className="eyebrow">{t('provider.publicReadiness.discoveryContent')}</span><h2>{profile.provider_type === 'business' ? t('provider.publicReadiness.whatCustomersCanDiscoverFromServices') : t('provider.publicReadiness.whatCustomersCanDiscover')}</h2></div>
          <Badge tone={readiness.contentReady ? 'success' : 'warning'}>{readiness.contentReady ? t('provider.publicReadiness.contentAvailable') : t('provider.publicReadiness.addContent')}</Badge>
        </div>
        {profile.provider_type === 'professional' ? <div className="provider-review-summary">
          <div><strong>{profile.services_active}</strong><span>{t('provider.publicReadiness.activeServices')}</span></div>
          <div><strong>{readiness.activeRoles}</strong><span>{t('provider.publicReadiness.activeProfessionalRoles')}</span></div>
          <div><strong>{publicResumeEnabled ? 'Yes' : 'No'}</strong><span>{t('provider.publicReadiness.publishedCareerProfile')}</span></div>
        </div> : <div className="provider-review-summary">
          <div><strong>{profile.services_active}</strong><span>{t('provider.publicReadiness.activeServices')}</span></div>
        </div>}
        <p className="summary-note">{profile.provider_type === 'business'
          ? t('provider.publicReadiness.activeServicesImproveMarketplaceDiscoveryApprovedPublicProductsAreManaged')
          : t('provider.publicReadiness.anActiveServiceActiveProfessionalRoleOrPublishedCareerProfile')}</p>
        {!readiness.contentReady ? <div className="button-row">
          {profile.provider_type === 'professional' ? <>
            <Link href="/provider/profile" className="button button-secondary">{t('provider.publicReadiness.addProfessionalRole')}</Link>
            <Link href="/provider/services" className="button button-secondary">{t('provider.publicReadiness.createService')}</Link>
            <Link href="/provider/resume" className="button button-secondary">{t('provider.publicReadiness.publishCareerProfile')}</Link>
          </> : <>
            <Link href="/provider/services" className="button button-secondary">{t('provider.publicReadiness.createService')}</Link>
            <Link href="/provider/products" className="button button-secondary">{t('provider.publicReadiness.manageProducts')}</Link>
          </>}
        </div> : null}
      </Card>

      {profile.trust_status !== 'normal' ? <Alert title={t('provider.publicReadiness.publicVisibilityPausedByTrustState')} tone={profile.trust_status === 'suspended' ? 'danger' : 'warning'}>
        {profile.trust_status === 'suspended' ? <>
          <p>{t('provider.publicReadiness.yourProviderPublicProfileStorefrontPublicTalentsAndPublishedCareer')}</p>
          <div className="button-row"><Link href="/account/support" className="button button-secondary">{t('provider.publicReadiness.openPlatformSupport')}</Link></div>
        </> : <>
          <p>{t('provider.publicReadiness.yourPublicMarketplacePresenceStaysUnavailableUntilFreshVerificationRestores')}</p>
          <div className="button-row"><Link href="/provider/verification" className="button button-secondary">{t('provider.publicReadiness.continueReVerification')}</Link></div>
        </>}
      </Alert> : null}

      {!profile.marketplace_disclosure_complete ? <Alert title={t('provider.publicReadiness.whyDisclosureIsRequired')} tone="warning">
        {profile.provider_type === 'business'
          ? t('provider.publicReadiness.thePublicBusinessStorefrontStaysUnavailableUntilTheApprovedMarketplace')
          : t('provider.publicReadiness.thePublicProfessionalPageStaysUnavailableUntilTheApprovedMarketplace')}
      </Alert> : null}
    </> : null}
  </LiveProviderShell>;
}
