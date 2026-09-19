'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';
type Visibility = boolean | null;
type Service = { id: string; name: string; status: 'draft' | 'active' | 'paused'; public_discoverable: Visibility };
type ServiceReadiness = { id: string; scope_enabled: boolean; launch_ready: boolean };
type SetupReadiness = {
  verified: boolean;
  profile_complete: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: TrustStatus;
  services: ServiceReadiness[];
};
type ProductLaunch = { product_revision: number; status: 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn' } | null;
type Product = { id: string; name: string; status: 'draft' | 'active' | 'paused'; review_revision: number; launch: ProductLaunch; public_discoverable: Visibility };
type ProfileReadiness = {
  verified: boolean;
  profile_complete: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: TrustStatus;
};
type Mode = 'services' | 'products';
type Blocker = { detail: string; href: string; action: string };
type ReachabilityPayload = { ids?: string[]; error?: string };

const reachabilityChunkSize = 40;

function visibilityTone(value: Visibility): 'success' | 'warning' | 'neutral' {
  if (value === true) return 'success';
  if (value === false) return 'warning';
  return 'neutral';
}

function listingTone(value: Visibility): 'success' | 'warning' | 'neutral' {
  if (value === true) return 'success';
  if (value === false) return 'warning';
  return 'neutral';
}

async function loadTargetedReachability(endpoint: string, ids: string[], fallbackMessage: string) {
  const reachable = new Set<string>();
  for (let start = 0; start < ids.length; start += reachabilityChunkSize) {
    const chunk = ids.slice(start, start + reachabilityChunkSize);
    const params = new URLSearchParams({ ids: chunk.join(',') });
    const response = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' });
    const payload = await response.json() as ReachabilityPayload;
    if (!response.ok || !Array.isArray(payload.ids)) {
      throw new Error(payload.error || fallbackMessage);
    }
    for (const id of payload.ids) if (id) reachable.add(String(id));
  }
  return reachable;
}

export default function ProviderOfferingDiscoverabilityStatus({ mode }: { mode: Mode }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [setup, setSetup] = useState<SetupReadiness | null>(null);
  const [profile, setProfile] = useState<ProfileReadiness | null>(null);
  const [customerListingIds, setCustomerListingIds] = useState<Set<string> | null>(null);
  const [listingError, setListingError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setListingError('');
    setCustomerListingIds(null);

    const load = async () => {
      try {
        if (mode === 'services') {
          const [catalogResponse, setupResponse] = await Promise.all([
            fetch('/api/provider/services', { cache: 'no-store' }),
            fetch('/api/provider/setup', { cache: 'no-store' }),
          ]);
          const catalogPayload = await catalogResponse.json() as { services?: Service[]; error?: string };
          const setupPayload = await setupResponse.json() as { readiness?: SetupReadiness; error?: string };
          if (!catalogResponse.ok || !catalogPayload.services) throw new Error(catalogPayload.error || t('provider.discoverability.serviceLoadFallback'));
          if (!setupResponse.ok || !setupPayload.readiness) throw new Error(setupPayload.error || t('provider.discoverability.serviceReadinessFallback'));

          const nextServices = catalogPayload.services;
          const activeIds = nextServices.filter((service) => service.status === 'active').map((service) => service.id).filter(Boolean);
          let reachableIds: Set<string> | null = new Set<string>();
          let reachabilityError = '';
          try {
            reachableIds = await loadTargetedReachability('/api/marketplace/services/reachability', activeIds, t('provider.discoverability.reachabilityFallback'));
          } catch (cause) {
            reachableIds = null;
            reachabilityError = cause instanceof Error ? cause.message : t('provider.discoverability.serviceReachabilityFallback');
          }

          if (!cancelled) {
            setServices(nextServices);
            setSetup(setupPayload.readiness);
            setCustomerListingIds(reachableIds);
            setListingError(reachabilityError);
          }
        } else {
          const [catalogResponse, profileResponse] = await Promise.all([
            fetch('/api/provider/products', { cache: 'no-store' }),
            fetch('/api/provider/profile', { cache: 'no-store' }),
          ]);
          const catalogPayload = await catalogResponse.json() as { products?: Product[]; error?: string };
          const profilePayload = await profileResponse.json() as { profile?: ProfileReadiness; error?: string };
          if (!catalogResponse.ok || !catalogPayload.products) throw new Error(catalogPayload.error || t('provider.discoverability.productLoadFallback'));
          if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error || t('provider.discoverability.businessReadinessFallback'));

          const nextProducts = catalogPayload.products;
          const activeIds = nextProducts.filter((product) => product.status === 'active').map((product) => product.id).filter(Boolean);
          let reachableIds: Set<string> | null = new Set<string>();
          let reachabilityError = '';
          try {
            reachableIds = await loadTargetedReachability('/api/marketplace/products/reachability', activeIds, t('provider.discoverability.reachabilityFallback'));
          } catch (cause) {
            reachableIds = null;
            reachabilityError = cause instanceof Error ? cause.message : t('provider.discoverability.productReachabilityFallback');
          }

          if (!cancelled) {
            setProducts(nextProducts);
            setProfile(profilePayload.profile);
            setCustomerListingIds(reachableIds);
            setListingError(reachabilityError);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('provider.discoverability.publicFallback'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [mode, t]);

  const serviceReadyById = useMemo(() => new Map((setup?.services ?? []).map((service) => [service.id, service])), [setup]);
  const activeServices = useMemo(() => services.filter((service) => service.status === 'active'), [services]);
  const activeProducts = useMemo(() => products.filter((product) => product.status === 'active'), [products]);
  const activeCount = mode === 'services' ? activeServices.length : activeProducts.length;
  const visibleCount = mode === 'services'
    ? activeServices.filter((service) => service.public_discoverable === true).length
    : activeProducts.filter((product) => product.public_discoverable === true).length;
  const entries = mode === 'services' ? activeServices : activeProducts;
  const listingReachableCount = customerListingIds
    ? entries.filter((entry) => customerListingIds.has(entry.id)).length
    : null;
  const fullyReachable = visibleCount === activeCount
    && listingReachableCount !== null
    && listingReachableCount === activeCount;

  const serviceBlocker = (service: Service): Blocker => {
    const current = serviceReadyById.get(service.id);
    if (!setup) return { detail: t('provider.discoverability.serviceReadinessUnavailable'), href: '/provider/setup', action: t('provider.discoverability.openSetup') };
    if (setup.trust_status === 'suspended') return { detail: t('provider.discoverability.suspensionBlocksPublic'), href: '/account/support', action: t('provider.discoverability.openSupport') };
    if (setup.trust_status === 'reverification_required') return { detail: t('provider.discoverability.reverificationRequired'), href: '/provider/verification', action: t('provider.discoverability.continueVerification') };
    if (!setup.profile_complete) return { detail: t('provider.discoverability.providerProfileIncomplete'), href: '/provider/profile', action: t('provider.discoverability.completeProfile') };
    if (!setup.verified) return { detail: t('provider.discoverability.providerVerificationIncomplete'), href: '/provider/verification', action: t('provider.discoverability.openVerification') };
    if (!setup.marketplace_disclosure_complete) return { detail: t('provider.discoverability.legalDisclosureIncomplete'), href: '/provider/verification', action: t('provider.discoverability.completeDisclosure') };
    if (!current?.scope_enabled) return { detail: t('provider.discoverability.scopeMissing'), href: '/provider/setup', action: t('provider.discoverability.reviewLaunchScope') };
    if (!current.launch_ready) return { detail: t('provider.discoverability.launchNotReady'), href: '/provider/setup', action: t('provider.discoverability.openSetup') };
    return { detail: t('provider.discoverability.activeServiceNotConfirmed'), href: '/provider/public-readiness', action: t('provider.discoverability.reviewPublicReadiness') };
  };

  const productBlocker = (product: Product): Blocker => {
    const currentApproved = product.launch?.product_revision === product.review_revision && product.launch.status === 'approved';
    if (!profile) return { detail: t('provider.discoverability.businessReadinessUnavailable'), href: '/provider/public-readiness', action: t('provider.discoverability.openPublicReadiness') };
    if (profile.trust_status === 'suspended') return { detail: t('provider.discoverability.productSuspensionBlocksPublic'), href: '/account/support', action: t('provider.discoverability.openSupport') };
    if (profile.trust_status === 'reverification_required') return { detail: t('provider.discoverability.reverificationRequired'), href: '/provider/verification', action: t('provider.discoverability.continueVerification') };
    if (!profile.verified) return { detail: t('provider.discoverability.businessVerificationIncomplete'), href: '/provider/verification', action: t('provider.discoverability.openVerification') };
    if (!profile.profile_complete) return { detail: t('provider.discoverability.businessProfileIncomplete'), href: '/provider/profile', action: t('provider.discoverability.completeProfile') };
    if (!profile.marketplace_disclosure_complete) return { detail: t('provider.discoverability.marketplaceDisclosureIncomplete'), href: '/provider/verification', action: t('provider.discoverability.completeDisclosure') };
    if (!currentApproved) return { detail: `${t('provider.discoverability.currentRevisionPrefix')} ${product.review_revision} ${t('provider.discoverability.currentRevisionSuffix')}`, href: '/provider/products', action: t('provider.discoverability.reviewLaunchStatus') };
    return { detail: t('provider.discoverability.activeProductNotConfirmed'), href: '/provider/public-readiness', action: t('provider.discoverability.reviewPublicReadiness') };
  };

  if (loading) return <Card className="mb-5"><p className="muted">{t('provider.discoverability.loading')}</p></Card>;
  if (error) return <Alert title={t('provider.discoverability.unavailableTitle')} tone="warning">{error}</Alert>;
  if (!activeCount) return <Alert title={t('provider.discoverability.noActiveTitle')} tone="info">{t('provider.discoverability.noActiveBody')}</Alert>;

  return <Card className="mb-5 overflow-hidden">
    <div style={{ display: 'grid', gap: '1rem', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">{t('provider.discoverability.eyebrow')}</span>
          <h2 style={{ margin: '.35rem 0 0' }}>
            {`${visibleCount}/${activeCount} ${t('provider.discoverability.publicLabel')} · ${listingReachableCount === null ? '—' : listingReachableCount}/${activeCount} ${t('provider.discoverability.customerSearchLabel')}`}
          </h2>
          <p className="muted" style={{ margin: '.4rem 0 0' }}>{t('provider.discoverability.intro')}</p>
          {listingError ? <p className="muted" style={{ margin: '.35rem 0 0' }}>{t('provider.discoverability.searchCheckUnavailable')} {listingError}</p> : null}
        </div>
        <Badge tone={fullyReachable ? 'success' : 'warning'}>{fullyReachable ? t('provider.discoverability.searchReachable') : t('provider.discoverability.reviewNeeded')}</Badge>
      </div>

      <div style={{ display: 'grid', gap: '.7rem' }}>
        {entries.map((entry) => {
          const visible = entry.public_discoverable;
          const listingReachable: Visibility = customerListingIds ? customerListingIds.has(entry.id) : null;
          const blocker = visible === false
            ? (mode === 'services' ? serviceBlocker(entry as Service) : productBlocker(entry as Product))
            : null;
          const publicHref = mode === 'services' ? `/services/${encodeURIComponent(entry.id)}` : `/products/${encodeURIComponent(entry.id)}`;
          const discoveryHref = mode === 'services'
            ? `/explore?q=${encodeURIComponent(entry.name)}`
            : `/products?q=${encodeURIComponent(entry.name)}`;
          const detail = visible === true && listingReachable === true
            ? t('provider.discoverability.bothReachable')
            : visible === true && listingReachable === false
              ? t('provider.discoverability.searchMismatch')
              : visible === true
                ? t('provider.discoverability.publicConfirmedSearchUnavailable')
                : visible === false
                  ? blocker?.detail
                  : t('provider.discoverability.publicProbeUnavailable');
          return <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap', padding: '.8rem 0', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ minWidth: 0 }}>
              <strong>{entry.name}</strong>
              <p className="muted" style={{ margin: '.25rem 0 0' }}>{detail}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
              <Badge tone={visibilityTone(visible)}>{visible === true ? t('provider.discoverability.publicVisible') : visible === false ? t('provider.discoverability.hidden') : t('provider.discoverability.publicUnknown')}</Badge>
              <Badge tone={listingTone(listingReachable)}>{listingReachable === true ? t('provider.discoverability.searchReachable') : listingReachable === false ? t('provider.discoverability.searchMissing') : t('provider.discoverability.searchUnknown')}</Badge>
              {visible === true ? <Link href={publicHref} target="_blank" rel="noreferrer" className="text-link">{t('provider.discoverability.viewPublic')}</Link> : null}
              {listingReachable === true ? <Link href={discoveryHref} target="_blank" rel="noreferrer" className="text-link">{mode === 'services' ? t('provider.discoverability.findServiceSearch') : t('provider.discoverability.findProductSearch')}</Link> : null}
              {visible === true && listingReachable === false ? <Link href="/provider/public-readiness" className="text-link">{t('provider.discoverability.reviewPublicReadinessLink')}</Link> : null}
              {blocker ? <Link href={blocker.href} className="text-link">{blocker.action} →</Link> : null}
            </div>
          </div>;
        })}
      </div>
    </div>
  </Card>;
}
