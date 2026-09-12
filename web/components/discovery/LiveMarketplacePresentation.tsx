'use client';

import Link from 'next/link';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage, type TranslationKey } from '../i18n/LanguageProvider';

type LocalizedValue = string | { default_locale?: string; values?: Record<string, string> } | null | undefined;
type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type BusinessShopState = 'open' | 'closed';
type NearbyMatchMode = 'at_provider' | 'at_customer';
type DistanceBand = 'under_1km' | '1_3km' | '3_7km' | '7_15km' | '15_30km' | '30_60km' | 'over_60km';
type Translate = (key: TranslationKey) => string;

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
  business_shop_state?: BusinessShopState | null;
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

function formatLocalized(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-z_]+)\}/gi, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

function availabilityPresentation(mode: ProviderWorkMode | undefined, t: Translate) {
  if (mode === 'available') return { label: t('explore.card.availableNow'), tone: 'success' as const };
  if (mode === 'busy') return { label: t('explore.card.busyNow'), tone: 'warning' as const };
  if (mode === 'paused') return { label: t('explore.card.paused'), tone: 'neutral' as const };
  return { label: t('explore.card.offline'), tone: 'neutral' as const };
}

function businessShopPresentation(providerType: string | undefined, state: BusinessShopState | null | undefined, t: Translate) {
  if (providerType !== 'business' || !state) return null;
  if (state === 'open') return { label: t('explore.card.shopOpen'), tone: 'success' as const };
  return { label: t('explore.card.shopClosed'), tone: 'neutral' as const };
}

function distanceBandLabel(band: DistanceBand | null | undefined, t: Translate) {
  if (band === 'under_1km') return t('explore.card.within1km');
  if (band === '1_3km') return t('explore.card.distance1to3');
  if (band === '3_7km') return t('explore.card.distance3to7');
  if (band === '7_15km') return t('explore.card.distance7to15');
  if (band === '15_30km') return t('explore.card.distance15to30');
  if (band === '30_60km') return t('explore.card.distance30to60');
  if (band === 'over_60km') return t('explore.card.over60km');
  return '';
}

function reachLabel(mode: NearbyMatchMode | null | undefined, t: Translate) {
  if (mode === 'at_customer') return t('explore.card.travelsToYou');
  if (mode === 'at_provider') return t('explore.card.atProvider');
  return '';
}

export function LiveMarketplaceServiceCard({ service, contextQuery = '' }: { service: LiveMarketplaceService; contextQuery?: string }) {
  const { locale, t } = useLanguage();
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
  const providerType = service.provider_type === 'professional' ? t('explore.professional') : t('explore.business');
  const ratingLabel = formatLocalized(t('explore.card.ratingLabel'), {
    rating: rating.toFixed(1),
    count: reviewCount,
  });
  const availability = availabilityPresentation(service.live_work_mode, t);
  const shop = businessShopPresentation(service.provider_type, service.business_shop_state, t);
  const nearbyDistance = distanceBandLabel(service.distance_band, t);
  const nearbyReach = reachLabel(service.nearby_match_mode, t);

  return (
    <Card className="discovery-card service-discovery-card">
      <div className="service-card-art" aria-hidden="true"><span>{serviceName.slice(0, 1)}</span><span className="art-label">{category}</span></div>
      <div className="discovery-card-content">
        <div className="card-meta">
          <Badge tone={availability.tone}>{availability.label}</Badge>
          {shop ? <Badge tone={shop.tone}>{shop.label}</Badge> : null}
          {service.verified ? <Badge tone="info">{t('explore.card.verifiedProvider')}</Badge> : null}
        </div>
        <h3><Link href={serviceHref}>{serviceName}</Link></h3>
        <p className="card-description">{description}</p>
        <p className="card-provider"><Link href={providerHref}>{service.provider_name || t('explore.card.providerFallback')}</Link> <span aria-hidden="true">·</span> {providerType}</p>
        {nearbyDistance ? <p className="card-location"><span aria-hidden="true">◎</span> {nearbyDistance}{nearbyReach ? ` · ${nearbyReach}` : ''}</p> : service.location ? <p className="card-location"><span aria-hidden="true">⌖</span> {service.location}</p> : null}
        <div className="card-footer">
          <div>
            <span className="rating" aria-label={ratingLabel}><span aria-hidden="true">★</span> {rating.toFixed(1)} <small>({reviewCount})</small></span>
            {formattedPrice ? <span className="price">{t('explore.card.from')} {formattedPrice}{service.pricing.pricing_model === 'hourly' ? t('explore.card.perHour') : ''}</span> : null}
          </div>
          <Link href={serviceHref} className="icon-link" aria-label={formatLocalized(t('explore.card.viewService'), { service: serviceName })}>-&gt;</Link>
        </div>
      </div>
    </Card>
  );
}

export function LiveDiscoveryEmptyState({ query, onClear, errorState = false }: { query: string; onClear: () => void; suggestions?: unknown[]; errorState?: boolean }) {
  const { t } = useLanguage();
  const title = errorState
    ? t('empty.catalogUnavailable')
    : query
      ? `${t('empty.noServicesFor')} “${query}”`
      : t('empty.noFilters');
  const help = errorState ? t('empty.tryLoadingAgain') : t('empty.help');

  return (
    <div className="discovery-empty-wrap">
      <Card>
        <EmptyState title={title}>{help}</EmptyState>
        <div className="empty-actions">
          <Button type="button" variant="secondary" onClick={onClear}>{errorState ? t('empty.tryAgain') : t('explore.clearFilters')}</Button>
          {errorState ? null : <Link href="/categories" className="button button-quiet">{t('empty.browseCategories')}</Link>}
        </div>
      </Card>
    </div>
  );
}
