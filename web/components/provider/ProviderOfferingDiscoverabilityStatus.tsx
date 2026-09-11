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

async function loadTargetedReachability(endpoint: string, ids: string[]) {
  const reachable = new Set<string>();
  for (let start = 0; start < ids.length; start += reachabilityChunkSize) {
    const chunk = ids.slice(start, start + reachabilityChunkSize);
    const params = new URLSearchParams({ ids: chunk.join(',') });
    const response = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' });
    const payload = await response.json() as ReachabilityPayload;
    if (!response.ok || !Array.isArray(payload.ids)) {
      throw new Error(payload.error || 'Customer discovery reachability could not be confirmed.');
    }
    for (const id of payload.ids) if (id) reachable.add(String(id));
  }
  return reachable;
}

export default function ProviderOfferingDiscoverabilityStatus({ mode }: { mode: Mode }) {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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
          if (!catalogResponse.ok || !catalogPayload.services) throw new Error(catalogPayload.error || 'Unable to confirm service discoverability.');
          if (!setupResponse.ok || !setupPayload.readiness) throw new Error(setupPayload.error || 'Unable to load service readiness.');

          const nextServices = catalogPayload.services;
          const activeIds = nextServices.filter((service) => service.status === 'active').map((service) => service.id).filter(Boolean);
          let reachableIds: Set<string> | null = new Set<string>();
          let reachabilityError = '';
          try {
            reachableIds = await loadTargetedReachability('/api/marketplace/services/reachability', activeIds);
          } catch (cause) {
            reachableIds = null;
            reachabilityError = cause instanceof Error ? cause.message : 'Customer service discovery reachability could not be confirmed.';
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
          if (!catalogResponse.ok || !catalogPayload.products) throw new Error(catalogPayload.error || 'Unable to confirm product discoverability.');
          if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error || 'Unable to load Business public readiness.');

          const nextProducts = catalogPayload.products;
          const activeIds = nextProducts.filter((product) => product.status === 'active').map((product) => product.id).filter(Boolean);
          let reachableIds: Set<string> | null = new Set<string>();
          let reachabilityError = '';
          try {
            reachableIds = await loadTargetedReachability('/api/marketplace/products/reachability', activeIds);
          } catch (cause) {
            reachableIds = null;
            reachabilityError = cause instanceof Error ? cause.message : 'Customer product discovery reachability could not be confirmed.';
          }

          if (!cancelled) {
            setProducts(nextProducts);
            setProfile(profilePayload.profile);
            setCustomerListingIds(reachableIds);
            setListingError(reachabilityError);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to confirm public discoverability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [mode]);

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
    if (!setup) return { detail: tamil ? 'Service readiness இன்னும் load ஆகவில்லை.' : 'Service readiness is not available yet.', href: '/provider/setup', action: tamil ? 'Provider Setup திறக்க' : 'Open Provider Setup' };
    if (setup.trust_status === 'suspended') return { detail: tamil ? 'Provider suspension காரணமாக public visibility block ஆகிறது.' : 'Provider suspension is blocking public visibility.', href: '/account/support', action: tamil ? 'Platform Support திறக்க' : 'Open Platform Support' };
    if (setup.trust_status === 'reverification_required') return { detail: tamil ? 'Fresh verification approval தேவை.' : 'Fresh Provider verification approval is required.', href: '/provider/verification', action: tamil ? 'Verification தொடர' : 'Continue verification' };
    if (!setup.profile_complete) return { detail: tamil ? 'Provider profile basics complete ஆகவில்லை.' : 'Provider profile basics are incomplete.', href: '/provider/profile', action: tamil ? 'Profile complete செய்ய' : 'Complete profile' };
    if (!setup.verified) return { detail: tamil ? 'Provider verification complete ஆகவில்லை.' : 'Provider verification is incomplete.', href: '/provider/verification', action: tamil ? 'Verification திறக்க' : 'Open verification' };
    if (!setup.marketplace_disclosure_complete) return { detail: tamil ? 'Marketplace legal/contact/grievance disclosure incomplete.' : 'Marketplace legal, contact, and grievance disclosure is incomplete.', href: '/provider/verification', action: tamil ? 'Disclosure complete செய்ய' : 'Complete disclosure' };
    if (!current?.scope_enabled) return { detail: tamil ? 'Approved category/location scope இல்லை.' : 'Approved category/location scope is missing.', href: '/provider/setup', action: tamil ? 'Launch scope review செய்ய' : 'Review launch scope' };
    if (!current.launch_ready) return { detail: tamil ? 'Current service launch readiness இன்னும் complete ஆகவில்லை.' : 'The current service launch readiness checks are not complete.', href: '/provider/setup', action: tamil ? 'Provider Setup திறக்க' : 'Open Provider Setup' };
    return { detail: tamil ? 'Service Active என்றாலும் anonymous marketplace read இன்னும் இந்த row-ஐ confirm செய்யவில்லை. Public Readiness மற்றும் Setup state-ஐ review செய்யுங்கள்.' : 'The service is Active, but the anonymous marketplace read has not confirmed this row yet. Review Public Readiness and Provider Setup.', href: '/provider/public-readiness', action: tamil ? 'Public Readiness review செய்ய' : 'Review Public Readiness' };
  };

  const productBlocker = (product: Product): Blocker => {
    const currentApproved = product.launch?.product_revision === product.review_revision && product.launch.status === 'approved';
    if (!profile) return { detail: tamil ? 'Business public readiness இன்னும் load ஆகவில்லை.' : 'Business public readiness is not available yet.', href: '/provider/public-readiness', action: tamil ? 'Public Readiness திறக்க' : 'Open Public Readiness' };
    if (profile.trust_status === 'suspended') return { detail: tamil ? 'Provider suspension காரணமாக Product public visibility block ஆகிறது.' : 'Provider suspension is blocking Product public visibility.', href: '/account/support', action: tamil ? 'Platform Support திறக்க' : 'Open Platform Support' };
    if (profile.trust_status === 'reverification_required') return { detail: tamil ? 'Fresh Provider verification approval தேவை.' : 'Fresh Provider verification approval is required.', href: '/provider/verification', action: tamil ? 'Verification தொடர' : 'Continue verification' };
    if (!profile.verified) return { detail: tamil ? 'Business verification complete ஆகவில்லை.' : 'Business verification is incomplete.', href: '/provider/verification', action: tamil ? 'Verification திறக்க' : 'Open verification' };
    if (!profile.profile_complete) return { detail: tamil ? 'Business profile basics complete ஆகவில்லை.' : 'Business profile basics are incomplete.', href: '/provider/profile', action: tamil ? 'Profile complete செய்ய' : 'Complete profile' };
    if (!profile.marketplace_disclosure_complete) return { detail: tamil ? 'Marketplace disclosure incomplete.' : 'Marketplace disclosure is incomplete.', href: '/provider/verification', action: tamil ? 'Disclosure complete செய்ய' : 'Complete disclosure' };
    if (!currentApproved) return { detail: tamil ? `Current revision ${product.review_revision} இன்னும் approved public launch revision இல்லை.` : `Current revision ${product.review_revision} is not yet approved for public launch.`, href: '/provider/products', action: tamil ? 'Launch review status பார்க்க' : 'Review launch status' };
    return { detail: tamil ? 'Product Active + current revision approved என்றாலும் anonymous marketplace read இன்னும் இந்த row-ஐ confirm செய்யவில்லை. Business Public Readiness-ஐ review செய்யுங்கள்.' : 'The Product is Active with an approved current revision, but the anonymous marketplace read has not confirmed this row yet. Review Business Public Readiness.', href: '/provider/public-readiness', action: tamil ? 'Public Readiness review செய்ய' : 'Review Public Readiness' };
  };

  if (loading) return <Card className="mb-5"><p className="muted">{tamil ? 'Customer discoverability verify செய்யப்படுகிறது…' : 'Confirming customer discoverability…'}</p></Card>;
  if (error) return <Alert title={tamil ? 'Public visibility confirmation unavailable' : 'Public visibility confirmation unavailable'} tone="warning">{error}</Alert>;
  if (!activeCount) return <Alert title={tamil ? 'Active offering இல்லை' : 'No active offering to confirm'} tone="info">{tamil ? 'Service/Product manual-ஆ Active ஆன பிறகு customer-facing discoverability confirmation இங்கே காட்டப்படும்.' : 'Customer-facing discoverability confirmation will appear here after a Service or Product is manually Active.'}</Alert>;

  return <Card className="mb-5 overflow-hidden">
    <div style={{ display: 'grid', gap: '1rem', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">{tamil ? 'Customer discoverability' : 'Customer discoverability'}</span>
          <h2 style={{ margin: '.35rem 0 0' }}>
            {tamil
              ? `${visibleCount}/${activeCount} public · ${listingReachableCount === null ? '—' : listingReachableCount}/${activeCount} customer search`
              : `${visibleCount}/${activeCount} public · ${listingReachableCount === null ? '—' : listingReachableCount}/${activeCount} customer search`}
          </h2>
          <p className="muted" style={{ margin: '.4rem 0 0' }}>{tamil ? 'Direct anonymous RLS visibility மற்றும் அதே marketplace eligibility rules பயன்படுத்தும் targeted customer discovery probe இரண்டையும் verify செய்கிறது.' : 'This verifies direct anonymous RLS visibility and a targeted customer-discovery probe using the same marketplace eligibility rules.'}</p>
          {listingError ? <p className="muted" style={{ margin: '.35rem 0 0' }}>{tamil ? `Customer search check கிடைக்கவில்லை: ${listingError}` : `Customer search check unavailable: ${listingError}`}</p> : null}
        </div>
        <Badge tone={fullyReachable ? 'success' : 'warning'}>{fullyReachable ? (tamil ? 'Search reachable' : 'Search reachable') : (tamil ? 'Review needed' : 'Review needed')}</Badge>
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
            ? (tamil ? 'Public RLS மற்றும் targeted customer discovery probe இரண்டிலும் இந்த offering கிடைக்கிறது.' : 'Both the public RLS path and the targeted customer-discovery probe return this offering.')
            : visible === true && listingReachable === false
              ? (tamil ? 'Public RLS இந்த offering-ஐ பார்க்கிறது; ஆனால் targeted customer discovery probe அதை return செய்யவில்லை. இது search reachability mismatch — catalog state மாற்றாமல் Public Readiness-ஐ review செய்யுங்கள்.' : 'Public RLS can see this offering, but the targeted customer-discovery probe did not return it. This is a search reachability mismatch; keep the catalog state unchanged and review Public Readiness.')
              : visible === true
                ? (tamil ? 'Public RLS visibility confirm ஆகியுள்ளது; customer search check தற்போது கிடைக்கவில்லை.' : 'Public RLS visibility is confirmed; the customer search check is currently unavailable.')
                : visible === false
                  ? blocker?.detail
                  : (tamil ? 'Anonymous public probe result கிடைக்கவில்லை; catalog state மாற்றப்படவில்லை.' : 'The anonymous public probe is unavailable; catalog state was not changed.');
          return <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap', padding: '.8rem 0', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ minWidth: 0 }}>
              <strong>{entry.name}</strong>
              <p className="muted" style={{ margin: '.25rem 0 0' }}>{detail}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
              <Badge tone={visibilityTone(visible)}>{visible === true ? (tamil ? 'Public-visible' : 'Public-visible') : visible === false ? (tamil ? 'Hidden' : 'Hidden') : (tamil ? 'Public unknown' : 'Public unknown')}</Badge>
              <Badge tone={listingTone(listingReachable)}>{listingReachable === true ? (tamil ? 'Search reachable' : 'Search reachable') : listingReachable === false ? (tamil ? 'Search missing' : 'Search missing') : (tamil ? 'Search unknown' : 'Search unknown')}</Badge>
              {visible === true ? <Link href={publicHref} target="_blank" rel="noreferrer" className="text-link">{tamil ? 'Public view பார்க்க ↗' : 'View public page ↗'}</Link> : null}
              {listingReachable === true ? <Link href={discoveryHref} target="_blank" rel="noreferrer" className="text-link">{mode === 'services' ? (tamil ? 'Customer search-ல் பார்க்க ↗' : 'Find in customer search ↗') : (tamil ? 'Product search-ல் பார்க்க ↗' : 'Find in product search ↗')}</Link> : null}
              {visible === true && listingReachable === false ? <Link href="/provider/public-readiness" className="text-link">{tamil ? 'Public Readiness review செய்ய →' : 'Review Public Readiness →'}</Link> : null}
              {blocker ? <Link href={blocker.href} className="text-link">{blocker.action} →</Link> : null}
            </div>
          </div>;
        })}
      </div>
    </div>
  </Card>;
}
