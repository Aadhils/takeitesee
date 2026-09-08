'use client';

import Link from 'next/link';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

type LocalizedValue = string | { default_locale?: string; values?: Record<string, string> } | null | undefined;
type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type NearbyMatchMode = 'at_provider' | 'at_customer';
type DistanceBand = 'under_1km' | '1_3km' | '3_7km' | '7_15km' | '15_30km' | '30_60km' | 'over_60km';

type LiveMarketplaceService = {
  id: string;
  provider_id?: string;
  provider_type?: string;
  provider_name?: string;
  service_name: LocalizedValue;
  description: LocalizedValue;
  category_id?: string;
  category_slug?: string;
  pricing: {
    base_price: { amount: number; currency: string };
    pricing_model?: string;
  };
  rating?: number;
  review_count?: number;
  verified?: boolean;
  location?: string;
  live_work_mode?: ProviderWorkMode;
  availability?: string;
  distance_band?: DistanceBand | null;
  distance_priority?: number;
  nearby_match_mode?: NearbyMatchMode | null;
};

function sourceText(value: LocalizedValue) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const values = value.values ?? {};
  return values.en ?? values[value.default_locale ?? ''] ?? Object.values(values)[0] ?? '';
}

function labelFromSlug(value: string) {
  return value.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Other';
}

function availabilityPresentation(mode: ProviderWorkMode | undefined, tamil: boolean) {
  if (mode === 'available') return { label: tamil ? 'இப்போது கிடைக்கிறார்' : 'Available now', tone: 'success' as const };
  if (mode === 'busy') return { label: tamil ? 'இப்போது பிஸி' : 'Busy now', tone: 'warning' as const };
  if (mode === 'paused') return { label: tamil ? 'தற்காலிக இடைநிறுத்தம்' : 'Paused', tone: 'neutral' as const };
  return { label: tamil ? 'ஆஃப்லைன்' : 'Offline', tone: 'neutral' as const };
}

function distanceBandLabel(band: DistanceBand | null | undefined, tamil: boolean) {
  if (band === 'under_1km') return tamil ? '1 கி.மீ-க்குள்' : 'Within 1 km';
  if (band === '1_3km') return tamil ? '1–3 கி.மீ தொலைவில்' : '1–3 km away';
  if (band === '3_7km') return tamil ? '3–7 கி.மீ தொலைவில்' : '3–7 km away';
  if (band === '7_15km') return tamil ? '7–15 கி.மீ தொலைவில்' : '7–15 km away';
  if (band === '15_30km') return tamil ? '15–30 கி.மீ தொலைவில்' : '15–30 km away';
  if (band === '30_60km') return tamil ? '30–60 கி.மீ தொலைவில்' : '30–60 km away';
  if (band === 'over_60km') return tamil ? '60 கி.மீ-க்கு மேல்' : 'Over 60 km away';
  return '';
}

function reachLabel(mode: NearbyMatchMode | null | undefined, tamil: boolean) {
  if (mode === 'at_customer') return tamil ? 'உங்கள் இடத்திற்கு வருவார்' : 'Travels to you';
  if (mode === 'at_provider') return tamil ? 'சேவை வழங்குநர் இடத்தில்' : 'At provider location';
  return '';
}

export function LiveMarketplaceServiceCard({ service, contextQuery = '' }: { service: LiveMarketplaceService; contextQuery?: string }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const serviceName = sourceText(service.service_name);
  const description = sourceText(service.description);
  const category = labelFromSlug(service.category_slug || service.category_id || 'other');
  const serviceHref = `/services/${service.id}${contextQuery ? `?${contextQuery}` : ''}`;
  const providerDirectory = service.provider_type === 'professional' ? '/professionals' : '/businesses';
  const providerBaseHref = service.provider_id ? `${providerDirectory}/${service.provider_id}` : providerDirectory;
  const providerHref = contextQuery ? `${providerBaseHref}?${contextQuery}` : providerBaseHref;
  const rating = Number(service.rating || 0);
  const reviewCount = Number(service.review_count || 0);
  const money = service.pricing?.base_price;
  const formattedPrice = money
    ? new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency || 'INR', maximumFractionDigits: 2 }).format(Number(money.amount || 0) / 100)
    : '';
  const providerType = service.provider_type === 'professional'
    ? (tamil ? 'நிபுணர்' : 'Professional')
    : (tamil ? 'வணிகம்' : 'Business');
  const ratingLabel = tamil
    ? `5-ல் ${rating.toFixed(1)} மதிப்பீடு, ${reviewCount} விமர்சனங்கள்`
    : `${rating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`;
  const availability = availabilityPresentation(service.live_work_mode, tamil);
  const nearbyDistance = distanceBandLabel(service.distance_band, tamil);
  const nearbyReach = reachLabel(service.nearby_match_mode, tamil);

  return (
    <Card className="discovery-card service-discovery-card">
      <div className="service-card-art" aria-hidden="true"><span>{serviceName.slice(0, 1)}</span><span className="art-label">{category}</span></div>
      <div className="discovery-card-content">
        <div className="card-meta">
          <Badge tone={availability.tone}>{availability.label}</Badge>
          {service.verified ? <Badge tone="info">{tamil ? 'சரிபார்க்கப்பட்ட வழங்குநர்' : 'Verified provider'}</Badge> : null}
        </div>
        <h3><Link href={serviceHref}>{serviceName}</Link></h3>
        <p className="card-description">{description}</p>
        <p className="card-provider"><Link href={providerHref}>{service.provider_name || (tamil ? 'சேவை வழங்குநர்' : 'Provider')}</Link> <span aria-hidden="true">·</span> {providerType}</p>
        {nearbyDistance ? <p className="card-location"><span aria-hidden="true">◎</span> {nearbyDistance}{nearbyReach ? ` · ${nearbyReach}` : ''}</p> : service.location ? <p className="card-location"><span aria-hidden="true">⌖</span> {service.location}</p> : null}
        <div className="card-footer">
          <div>
            <span className="rating" aria-label={ratingLabel}><span aria-hidden="true">★</span> {rating.toFixed(1)} <small>({reviewCount})</small></span>
            {formattedPrice ? <span className="price">{tamil ? 'முதல்' : 'From'} {formattedPrice}{service.pricing.pricing_model === 'hourly' ? (tamil ? ' / மணி' : ' / hour') : ''}</span> : null}
          </div>
          <Link href={serviceHref} className="icon-link" aria-label={tamil ? `${serviceName} சேவையை பார்க்க` : `View ${serviceName}`}>-&gt;</Link>
        </div>
      </div>
    </Card>
  );
}

export function LiveDiscoveryEmptyState({ query, onClear, errorState = false }: { query: string; onClear: () => void; suggestions?: unknown[]; errorState?: boolean }) {
  const { locale, t } = useLanguage();
  const tamil = locale === 'ta-IN';
  const title = errorState
    ? (tamil ? 'மார்க்கெட்ப்ளேஸ் பட்டியலை தற்போது ஏற்ற முடியவில்லை.' : 'Marketplace catalog unavailable')
    : query
      ? `${t('empty.noServicesFor')} “${query}”`
      : t('empty.noFilters');
  const help = errorState
    ? (tamil ? 'மார்க்கெட்ப்ளேஸை மீண்டும் ஏற்ற முயற்சிக்கவும்.' : 'Please try loading the marketplace again.')
    : t('empty.help');

  return (
    <div className="discovery-empty-wrap">
      <Card>
        <EmptyState title={title}>{help}</EmptyState>
        <div className="empty-actions">
          <Button type="button" variant="secondary" onClick={onClear}>{errorState ? (tamil ? 'மீண்டும் முயற்சி' : 'Try again') : t('explore.clearFilters')}</Button>
          {errorState ? null : <Link href="/categories" className="button button-quiet">{t('empty.browseCategories')}</Link>}
        </div>
      </Card>
    </div>
  );
}
