'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, EmptyState, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { DiscoveryEmptyState } from '../../components/discovery/DiscoveryEnhancements';
import { TaxonomySearchInput } from '../../components/discovery/TaxonomySearchInput';
import { parseMarketplaceSearchIntent } from '../../components/discovery/marketplaceSearchIntent';
import { resolveMarketplaceZeroResultRecovery } from '../../components/discovery/marketplaceZeroResultRecovery';
import { useLanguage } from '../../components/i18n/LanguageProvider';

type MarketplaceService = any;
type PriceFilter = 'any' | 'under-1000' | '1000-5000' | 'over-5000';
type RatingFilter = 'any' | '4-plus' | '4.5-plus';
type ProviderFilter = 'any' | 'professional' | 'business';
type AvailabilityFilter = 'any' | 'available-now';
type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type GeoStatus = 'not_requested' | 'ready' | 'unavailable';
type GeoOrigin = { latitude: number; longitude: number };
type DistanceBand = 'under_1km' | '1_3km' | '3_7km' | '7_15km' | '15_30km' | '30_60km' | 'over_60km';
type ServerCategory = { slug: string; name: string };
type ServerPage = { limit: number; next_cursor: string | null; has_more: boolean };
type ServerSearchPayload = {
  services?: MarketplaceService[];
  categories?: ServerCategory[];
  total?: number;
  geo_status?: GeoStatus;
  page?: ServerPage;
  error?: string;
};

type Filters = {
  category: string;
  location: string;
  price: PriceFilter;
  rating: RatingFilter;
  provider: ProviderFilter;
  availability: AvailabilityFilter;
};

const serverPageSize = 24;
const validSorts = ['relevance', 'rating', 'price', 'price-desc'];
const priceValues: PriceFilter[] = ['any', 'under-1000', '1000-5000', 'over-5000'];
const ratingValues: RatingFilter[] = ['any', '4-plus', '4.5-plus'];
const workModes: ProviderWorkMode[] = ['available', 'busy', 'offline', 'paused'];
const distanceBands: DistanceBand[] = ['under_1km', '1_3km', '3_7km', '7_15km', '15_30km', '30_60km', 'over_60km'];
const tamilAvailabilityTokens = new Set(['கிடைக்கும்', 'கிடைக்கிறார்', 'கிடைக்கிறது']);

function defaultFilters(): Filters {
  return { category: 'all', location: 'Anywhere', price: 'any', rating: 'any', provider: 'any', availability: 'any' };
}

function localized(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, any>;
    return record.en ?? record.values?.en ?? record.values?.[record.default_locale] ?? '';
  }
  return '';
}

function labelFromSlug(value: string) {
  return value.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Other';
}

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function categoryAliasValues(service: MarketplaceService): string[] {
  if (!Array.isArray(service.category_aliases)) return [];
  return service.category_aliases.map((alias: unknown) => String(alias ?? '').trim()).filter(Boolean);
}

function hasAvailableNowIntent(query: string) {
  const tokens = normalized(query).split(' ').filter(Boolean);
  const englishIntent = tokens.includes('available') && tokens.includes('now');
  const tamilIntent = tokens.includes('இப்போது') && tokens.some((token) => tamilAvailabilityTokens.has(token));
  return englishIntent || tamilIntent;
}

function withoutAvailabilityIntent(value: string) {
  return value
    .replace(/\bavailable\s+now\b/giu, ' ')
    .replace(/இப்போது\s+(கிடைக்கும்|கிடைக்கிறார்|கிடைக்கிறது)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExploreParams(query: string, filters: Filters, sort: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (filters.location !== 'Anywhere' && filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.price !== 'any') params.set('price', filters.price);
  if (filters.rating !== 'any') params.set('rating', filters.rating);
  if (filters.provider !== 'any') params.set('provider', filters.provider);
  if (filters.availability === 'available-now') params.set('availability', 'now');
  if (sort !== 'relevance' && sort !== 'nearest') params.set('sort', sort);
  return params;
}

function buildServerSearchParams(query: string, filters: Filters, sort: string, location: string, availableNow: boolean, cursor?: string | null) {
  const params = new URLSearchParams({ limit: String(serverPageSize) });
  if (query.trim()) params.set('q', query.trim());
  if (filters.category !== 'all') params.set('category', filters.category);
  if (location.trim()) params.set('location', location.trim());
  if (filters.price !== 'any') params.set('price', filters.price);
  if (filters.rating !== 'any') params.set('rating', filters.rating);
  if (filters.provider !== 'any') params.set('provider', filters.provider);
  if (availableNow) params.set('availability', 'now');
  if (sort !== 'relevance' && sort !== 'nearest') params.set('sort', sort);
  if (cursor) params.set('cursor', cursor);
  return params;
}

function buildRequirementHref(search: string, service: string, location: string) {
  const params = new URLSearchParams({ source: 'explore' });
  if (search.trim()) params.set('search', search.trim().slice(0, 180));
  if (service.trim()) params.set('service', service.trim().slice(0, 120));
  if (location.trim()) params.set('location', location.trim().slice(0, 120));
  return `/requirements?${params.toString()}`;
}

function normalizeService(service: MarketplaceService) {
  const categorySlug = service.category_slug || service.category_id || 'other';
  const liveWorkMode = workModes.includes(service.live_work_mode as ProviderWorkMode)
    ? service.live_work_mode as ProviderWorkMode
    : 'offline';
  const distanceBand = distanceBands.includes(service.distance_band as DistanceBand)
    ? service.distance_band as DistanceBand
    : null;
  const distancePriorityValue = Number(service.distance_priority || 0);
  return {
    ...service,
    provider_id: service.provider_id || service.business_id || service.professional_id || '',
    service_name: { default_locale: 'en', values: { en: localized(service.service_name) } },
    description: { default_locale: 'en', values: { en: localized(service.description) } },
    category_id: categorySlug,
    category_slug: categorySlug,
    category_code: typeof service.category_code === 'string' ? service.category_code : null,
    category_group: typeof service.category_group === 'string' ? service.category_group : '',
    category_aliases: categoryAliasValues(service),
    pricing: {
      base_price: service.pricing?.base_price ?? { amount: 0, currency: 'INR' },
      pricing_model: service.pricing?.pricing_model ?? 'fixed',
    },
    live_work_mode: liveWorkMode,
    availability: service.availability || 'Offline',
    distance_band: distanceBand,
    distance_priority: Number.isFinite(distancePriorityValue) && distancePriorityValue > 0 ? Math.min(distancePriorityValue, 24) : 0,
    nearby_match_mode: ['at_provider', 'at_customer'].includes(service.nearby_match_mode) ? service.nearby_match_mode : null,
    rating: Number(service.rating || 0),
    review_count: Number(service.review_count || 0),
    verified: Boolean(service.verified),
    duration_minutes: Number(service.duration_minutes || 0),
    service_area: service.service_area || service.location || '',
    long_description: localized(service.description),
    highlights: [],
    inclusions: [],
    policy: '',
  };
}

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'Location permission was not granted. Allow location access to rank useful nearby services.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'Your current location could not be determined.';
  if (error.code === error.TIMEOUT) return 'Location lookup timed out. Please try again.';
  return error.message || 'Unable to read your current location.';
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [resolvedTaxonomyIntent, setResolvedTaxonomyIntent] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState('relevance');
  const [urlReady, setUrlReady] = useState(false);
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [serverCategories, setServerCategories] = useState<string[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [geoOrigin, setGeoOrigin] = useState<GeoOrigin | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('not_requested');
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const { locale, t } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const defaults = defaultFilters();
    const price = priceValues.includes(params.get('price') as PriceFilter) ? params.get('price') as PriceFilter : defaults.price;
    const rating = ratingValues.includes(params.get('rating') as RatingFilter) ? params.get('rating') as RatingFilter : defaults.rating;
    const provider = ['any', 'professional', 'business'].includes(params.get('provider') ?? '') ? params.get('provider') as ProviderFilter : defaults.provider;
    const availability: AvailabilityFilter = params.get('availability') === 'now' ? 'available-now' : defaults.availability;
    setQuery(params.get('q')?.trim() ?? '');
    setFilters({
      category: params.get('category')?.trim() || defaults.category,
      location: params.get('location')?.trim() || defaults.location,
      price,
      rating,
      provider,
      availability,
    });
    setSort(validSorts.includes(params.get('sort') ?? '') ? params.get('sort')! : 'relevance');
    setUrlReady(true);
  }, []);

  const searchIntent = useMemo(() => parseMarketplaceSearchIntent(query), [query]);
  const availableNowFromQuery = useMemo(() => hasAvailableNowIntent(query), [query]);
  const availableNowActive = filters.availability === 'available-now' || availableNowFromQuery;
  const effectiveSearchQuery = resolvedTaxonomyIntent || searchIntent.serviceQuery || query;
  const manualLocationQuery = filters.location === 'Anywhere' ? '' : filters.location.trim();
  const effectiveLocationQuery = manualLocationQuery || searchIntent.locationQuery;
  const preciseNearbyActive = Boolean(geoOrigin && geoStatus === 'ready' && !effectiveLocationQuery);
  const namedLocationOverridesNearby = Boolean(geoOrigin && effectiveLocationQuery);
  const hasNarrowingFilters = filters.category !== 'all'
    || filters.price !== 'any'
    || filters.rating !== 'any'
    || filters.provider !== 'any'
    || filters.availability !== 'any'
    || availableNowFromQuery;
  const requirementHref = useMemo(
    () => buildRequirementHref(query, effectiveSearchQuery, effectiveLocationQuery),
    [effectiveLocationQuery, effectiveSearchQuery, query],
  );
  const serverSearchKey = useMemo(
    () => buildServerSearchParams(effectiveSearchQuery, filters, sort, effectiveLocationQuery, availableNowActive).toString(),
    [availableNowActive, effectiveLocationQuery, effectiveSearchQuery, filters, sort],
  );
  const serverSearchKeyRef = useRef(serverSearchKey);
  serverSearchKeyRef.current = serverSearchKey;
  const nearbySearchBody = useMemo(() => geoOrigin && !effectiveLocationQuery ? {
    origin: geoOrigin,
    q: effectiveSearchQuery,
    category: filters.category,
    location: '',
    price: filters.price,
    rating: filters.rating,
    provider: filters.provider,
    available_now: availableNowActive,
    sort,
    near_me: searchIntent.nearMe,
    limit: serverPageSize,
  } : null, [availableNowActive, effectiveLocationQuery, effectiveSearchQuery, filters, geoOrigin, searchIntent.nearMe, sort]);
  const nearbySearchKey = useMemo(() => nearbySearchBody ? JSON.stringify(nearbySearchBody) : '', [nearbySearchBody]);
  const nearbySearchKeyRef = useRef(nearbySearchKey);
  nearbySearchKeyRef.current = nearbySearchKey;

  useEffect(() => {
    if (!urlReady || (geoOrigin && !effectiveLocationQuery)) return;
    let cancelled = false;
    const requestKey = serverSearchKey;
    setLoading(true);
    setLoadError('');
    setLoadMoreError('');
    setLoadingMore(false);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/marketplace/services/search?${requestKey}`, { cache: 'no-store' });
          const payload = await response.json() as ServerSearchPayload;
          if (!response.ok) throw new Error(payload.error || 'Marketplace catalog unavailable');
          if (cancelled || serverSearchKeyRef.current !== requestKey) return;

          const nextServices = Array.isArray(payload.services) ? payload.services.map(normalizeService) : [];
          const nextCategories = Array.isArray(payload.categories)
            ? Array.from(new Set(payload.categories.map((category) => String(category.slug || '')).filter(Boolean))).sort()
            : [];
          const totalValue = Number(payload.total ?? nextServices.length);
          setServices(nextServices);
          setServerCategories(nextCategories);
          setServerTotal(Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : nextServices.length);
          setNextCursor(payload.page?.next_cursor ?? null);
          setHasMore(Boolean(payload.page?.has_more));
          setGeoStatus('not_requested');
        } catch (error) {
          if (!cancelled && serverSearchKeyRef.current === requestKey) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load services');
          }
        } finally {
          if (!cancelled && serverSearchKeyRef.current === requestKey) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [effectiveLocationQuery, geoOrigin, serverSearchKey, urlReady]);

  useEffect(() => {
    if (!urlReady || !nearbySearchBody || !nearbySearchKey) return;
    let cancelled = false;
    const requestKey = nearbySearchKey;
    setLoading(true);
    setLoadError('');
    setLoadMoreError('');
    setLoadingMore(false);
    setGeoError('');

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch('/api/marketplace/services/nearby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nearbySearchBody),
            cache: 'no-store',
          });
          const payload = await response.json() as ServerSearchPayload;
          if (!response.ok) throw new Error(payload.error || 'Marketplace catalog unavailable');
          if (cancelled || nearbySearchKeyRef.current !== requestKey) return;

          const nextServices = Array.isArray(payload.services) ? payload.services.map(normalizeService) : [];
          const nextCategories = Array.isArray(payload.categories)
            ? Array.from(new Set(payload.categories.map((category) => String(category.slug || '')).filter(Boolean))).sort()
            : [];
          const totalValue = Number(payload.total ?? nextServices.length);
          setServices(nextServices);
          setServerCategories(nextCategories);
          setServerTotal(Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : nextServices.length);
          setNextCursor(payload.page?.next_cursor ?? null);
          setHasMore(Boolean(payload.page?.has_more));
          const nextGeoStatus = payload.geo_status ?? 'unavailable';
          setGeoStatus(nextGeoStatus);
          if (nextGeoStatus === 'unavailable') {
            setGeoError('Precise nearby matching is temporarily unavailable. Showing the normal marketplace ranking instead.');
          }
        } catch (error) {
          if (!cancelled && nearbySearchKeyRef.current === requestKey) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load services');
          }
        } finally {
          if (!cancelled && nearbySearchKeyRef.current === requestKey) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nearbySearchBody, nearbySearchKey, urlReady]);

  const categories = serverCategories;

  useEffect(() => {
    if (loading) return;
    if (filters.category !== 'all' && !categories.includes(filters.category)) setFilters((current) => ({ ...current, category: 'all' }));
  }, [categories, filters.category, loading]);

  const contextQuery = useMemo(() => buildExploreParams(query, filters, sort).toString(), [filters, query, sort]);

  useEffect(() => {
    if (!urlReady) return;
    window.history.replaceState(null, '', contextQuery ? `/explore?${contextQuery}` : '/explore');
  }, [contextQuery, urlReady]);

  useEffect(() => {
    if (sort === 'nearest' && !preciseNearbyActive) setSort('relevance');
  }, [preciseNearbyActive, sort]);

  // Search/filter/ranking/pagination are server-authoritative for both normal and
  // precise-nearby discovery. Preserve the server page order exactly so client-side
  // fallback logic cannot drift from canonical taxonomy, multilingual tokenization,
  // availability/capability weighting, geo distance weighting, or deterministic ties.
  const filteredServices = services;

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    const nearbyMode = Boolean(nearbySearchBody && nearbySearchKey);
    const requestKey = nearbyMode ? nearbySearchKey : serverSearchKey;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      let response: Response;
      if (nearbyMode && nearbySearchBody) {
        response = await fetch('/api/marketplace/services/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...nearbySearchBody, cursor: nextCursor }),
          cache: 'no-store',
        });
      } else {
        const params = new URLSearchParams(serverSearchKey);
        params.set('cursor', nextCursor);
        response = await fetch(`/api/marketplace/services/search?${params.toString()}`, { cache: 'no-store' });
      }

      const payload = await response.json() as ServerSearchPayload;
      if (!response.ok) throw new Error(payload.error || 'Unable to load more services');
      const currentRequest = nearbyMode ? nearbySearchKeyRef.current === requestKey : serverSearchKeyRef.current === requestKey;
      if (!currentRequest) return;

      const incoming = Array.isArray(payload.services) ? payload.services.map(normalizeService) : [];
      setServices((current) => {
        const ids = new Set(current.map((service) => String(service.id)));
        return [...current, ...incoming.filter((service) => !ids.has(String(service.id)))];
      });
      if (Array.isArray(payload.categories)) {
        setServerCategories(Array.from(new Set(payload.categories.map((category) => String(category.slug || '')).filter(Boolean))).sort());
      }
      const totalValue = Number(payload.total);
      if (Number.isFinite(totalValue) && totalValue >= 0) setServerTotal(totalValue);
      setNextCursor(payload.page?.next_cursor ?? null);
      setHasMore(Boolean(payload.page?.has_more));
      if (nearbyMode) {
        const nextGeoStatus = payload.geo_status ?? 'unavailable';
        setGeoStatus(nextGeoStatus);
        setGeoError(nextGeoStatus === 'unavailable'
          ? 'Precise nearby matching is temporarily unavailable. Showing the normal marketplace ranking instead.'
          : '');
      }
    } catch (error) {
      const currentRequest = nearbyMode ? nearbySearchKeyRef.current === requestKey : serverSearchKeyRef.current === requestKey;
      if (currentRequest) setLoadMoreError(error instanceof Error ? error.message : 'Unable to load more services');
    } finally {
      const currentRequest = nearbyMode ? nearbySearchKeyRef.current === requestKey : serverSearchKeyRef.current === requestKey;
      if (currentRequest) setLoadingMore(false);
    }
  };

  const clearAll = () => { setQuery(''); setResolvedTaxonomyIntent(null); setFilters(defaultFilters()); setSort('relevance'); };
  const clearSearch = () => { setQuery(''); setResolvedTaxonomyIntent(null); setSort('relevance'); };
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  const broadenFilters = () => {
    setFilters((current) => ({
      ...current,
      category: 'all',
      price: 'any',
      rating: 'any',
      provider: 'any',
      availability: 'any',
    }));
    if (availableNowFromQuery) setQuery((current) => withoutAvailabilityIntent(current));
    setSort('relevance');
  };

  const broadenNamedLocation = () => {
    setFilters((current) => ({ ...current, location: 'Anywhere' }));
    if (searchIntent.locationQuery) {
      const nextQuery = (resolvedTaxonomyIntent || searchIntent.serviceQuery || query).trim();
      setQuery(nextQuery);
    }
    setSort('relevance');
  };

  const useCurrentLocation = () => {
    if (geoLocating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Location matching is not supported by this browser.');
      return;
    }
    setGeoLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setGeoLocating(false);
      },
      (positionError) => {
        setGeoError(geolocationMessage(positionError));
        setGeoLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const clearNearbyLocation = () => {
    setGeoOrigin(null);
    setGeoStatus('not_requested');
    setGeoError('');
  };

  const applyTaxonomySuggestion = (categoryName: string) => {
    if (searchIntent.nearMe) setQuery(`${categoryName} near me`);
    else if (searchIntent.locationQuery) setQuery(`${categoryName} in ${searchIntent.locationQuery}`);
    else setQuery(categoryName);
    setResolvedTaxonomyIntent(categoryName);
  };

  const resultCount = serverTotal;
  const resultHeading = loading
    ? t('explore.loading')
    : query.trim()
      ? locale === 'ta-IN'
        ? `“${query.trim()}” ${t('explore.forQuery')} ${resultCount} ${resultCount === 1 ? t('explore.match') : t('explore.matches')}`
        : `${resultCount} ${resultCount === 1 ? t('explore.match') : t('explore.matches')} ${t('explore.forQuery')} “${query.trim()}”`
      : `${resultCount} ${t('explore.servicesToExplore')}`;

  const nearbyReady = preciseNearbyActive;
  const zeroResultRecovery = resolveMarketplaceZeroResultRecovery({
    loading,
    hasError: Boolean(loadError),
    resultCount: filteredServices.length,
    queryPresent: Boolean(query.trim()),
    locationPresent: Boolean(effectiveLocationQuery),
    hasNarrowingFilters,
    preciseNearbyActive,
  });
  const showRecoveryEmptyState = zeroResultRecovery.show;
  const tamil = locale === 'ta-IN';
  const recoveryTitle = zeroResultRecovery.mode === 'named_location'
    ? (tamil ? `“${effectiveLocationQuery}” பகுதியில் live match இல்லை` : `No live match in “${effectiveLocationQuery}”`)
    : zeroResultRecovery.mode === 'nearby' && query.trim()
      ? (tamil ? `“${query.trim()}” க்கு nearby live match இல்லை` : `No live nearby match for “${query.trim()}”`)
      : zeroResultRecovery.mode === 'nearby'
        ? (tamil ? 'உங்கள் தற்போதைய இடத்திற்கு அருகில் live services கிடைக்கவில்லை' : 'No live services found near your current location')
        : zeroResultRecovery.mode === 'query'
          ? (tamil ? `“${query.trim()}” க்கு live match இல்லை` : `No live match for “${query.trim()}”`)
          : (tamil ? 'தற்போதைய filters-க்கு live match இல்லை' : 'No live match with the current filters');
  const recoveryHelp = zeroResultRecovery.mode === 'named_location'
    ? (tamil
      ? 'இந்த இடத்தைத் தாண்டி தேடலாம், filters-ஐ தளர்த்தலாம், approved category-களை பார்க்கலாம் அல்லது requirement post செய்யலாம்.'
      : 'Search beyond this location, broaden the filters, browse approved categories, or post a requirement.')
    : zeroResultRecovery.mode === 'nearby'
      ? (tamil
        ? 'Current-location ranking-ஐ நீக்கி முழு marketplace-ல் தேடலாம், filters-ஐ தளர்த்தலாம், approved category-களை பார்க்கலாம் அல்லது requirement post செய்யலாம்.'
        : 'Search without current-location ranking, broaden the filters, browse an approved category, or post a requirement.')
      : zeroResultRecovery.mode === 'query'
        ? (tamil
          ? 'தேடல் சொல்லை மாற்றி முயற்சிக்கலாம், active filters இருந்தால் தளர்த்தலாம், approved category-களை பார்க்கலாம் அல்லது requirement post செய்யலாம்.'
          : 'Try a broader service phrase, loosen any active filters, browse approved categories, or post a requirement.')
        : (tamil
          ? 'ஒரு filter-ஐ தளர்த்தி மீண்டும் முயற்சிக்கலாம், approved category-களை பார்க்கலாம் அல்லது requirement post செய்யலாம்.'
          : 'Try broader filters, browse approved categories, or post a requirement so providers can respond.');

  return <div className="discovery-page discovery-workspace">
    <section className="page-intro"><span className="eyebrow">{t('explore.eyebrow')}</span><h1>{t('explore.title')}</h1><p>{t('explore.subtitle')}</p></section>

    <section className="discovery-search-panel">
      <div className="discovery-search-row"><TaxonomySearchInput label={t('explore.searchLabel')} placeholder={t('explore.searchPlaceholder')} value={query} intentValue={searchIntent.serviceQuery} locale={locale} onChange={(value) => { setQuery(value); setResolvedTaxonomyIntent(null); }} onResolvedIntent={setResolvedTaxonomyIntent} onSuggestionSelect={applyTaxonomySuggestion} /></div>
      <div className="discovery-filter-fields">
        <Select label={t('explore.category')} value={filters.category} onChange={(e) => update('category', e.target.value)}><option value="all">{t('explore.allCategories')}</option>{categories.map((category) => <option value={category} key={category}>{labelFromSlug(category)}</option>)}</Select>
        <Input label={t('explore.location')} placeholder={t('explore.locationPlaceholder')} value={filters.location === 'Anywhere' ? '' : filters.location} onChange={(e) => update('location', e.target.value.trim() ? e.target.value : 'Anywhere')} />
        <Select label={t('explore.price')} value={filters.price} onChange={(e) => update('price', e.target.value as PriceFilter)}><option value="any">{t('explore.anyPrice')}</option><option value="under-1000">{t('explore.under1000')}</option><option value="1000-5000">{t('explore.range1000to5000')}</option><option value="over-5000">{t('explore.over5000')}</option></Select>
        <Select label={t('explore.rating')} value={filters.rating} onChange={(e) => update('rating', e.target.value as RatingFilter)}><option value="any">{t('explore.anyRating')}</option><option value="4-plus">{t('explore.rating4')}</option><option value="4.5-plus">{t('explore.rating45')}</option></Select>
        <Select label={t('explore.providerType')} value={filters.provider} onChange={(e) => update('provider', e.target.value as ProviderFilter)}><option value="any">{t('explore.anyProvider')}</option><option value="professional">{t('explore.professional')}</option><option value="business">{t('explore.business')}</option></Select>
        <Select label={locale === 'ta-IN' ? 'நேரடி கிடைப்பாடு' : 'Live availability'} value={filters.availability} onChange={(e) => update('availability', e.target.value as AvailabilityFilter)}><option value="any">{locale === 'ta-IN' ? 'எந்த live நிலையும்' : 'Any live status'}</option><option value="available-now">{locale === 'ta-IN' ? 'இப்போது கிடைப்பவர்கள் மட்டும்' : 'Available now only'}</option></Select>
      </div>
      <div className="discovery-search-footer">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button type="button" variant="quiet" onClick={clearAll}>{t('explore.clearFilters')}</Button>
          {geoOrigin
            ? <Button type="button" variant="secondary" onClick={clearNearbyLocation}>{nearbyReady ? 'Nearby ranking on · Clear' : 'Clear current location'}</Button>
            : <Button type="button" variant="secondary" loading={geoLocating} onClick={useCurrentLocation}>{searchIntent.nearMe ? 'Use my location for nearby results' : 'Use my location'}</Button>}
        </div>
        <div className="sort-control"><Select label={t('explore.sort')} value={sort} onChange={(e) => setSort(e.target.value)}><option value="relevance">{t('explore.relevance')}</option>{preciseNearbyActive ? <option value="nearest">{locale === 'ta-IN' ? 'அருகிலுள்ளவை முதலில்' : 'Nearest first'}</option> : null}<option value="rating">{t('explore.highestRated')}</option><option value="price">{t('explore.lowestPrice')}</option><option value="price-desc">{t('explore.highestPrice')}</option></Select></div>
      </div>
      {searchIntent.locationQuery && !manualLocationQuery ? <p style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>{locale === 'ta-IN' ? 'தேடலில் இடம் கண்டறியப்பட்டது:' : 'Location intent detected:'} <strong>{searchIntent.locationQuery}</strong>. {locale === 'ta-IN' ? 'இந்த இடத்துடன் பொருந்தும் சேவைகள் மட்டும் காட்டப்படும்.' : 'Only services matching this location are shown.'}</p> : null}
      {searchIntent.nearMe && !geoOrigin ? <p style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>{locale === 'ta-IN' ? '“எனக்கு அருகில்” intent கண்டறியப்பட்டது. துல்லியமான அருகாமை ranking-க்கு Use my location தேர்வு செய்யவும்.' : '“Near me” intent was detected. Choose Use my location to enable precise nearby ranking.'}</p> : null}
      {availableNowFromQuery ? <p style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>{locale === 'ta-IN' ? 'உங்கள் தேடலில் “இப்போது கிடைக்கும்” intent கண்டறியப்பட்டது. Available Providers மட்டும் காட்டப்படுகிறார்கள்.' : '“Available now” was detected in your search. Only currently Available Providers are shown.'}</p> : null}
      {namedLocationOverridesNearby ? <p style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>{locale === 'ta-IN' ? 'Named location தேடல் active ஆக இருப்பதால் current-location distance ranking தற்காலிகமாக பயன்படுத்தப்படவில்லை.' : 'A named location is active, so current-location distance ranking is paused for these results.'}</p> : null}
      {nearbyReady ? <p style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>Nearby ranking is active for this browser session. Your precise location is used for this marketplace request only; the public response contains only coarse distance bands and is not added to the page URL or saved as a customer location record.</p> : null}
      {geoError ? <p role="alert" style={{ margin: 0, fontSize: '.78rem', lineHeight: 1.5 }}>{geoError}</p> : null}
    </section>

    <div className="results-heading"><div><span className="eyebrow">{t('explore.marketplace')}</span><h2>{resultHeading}</h2></div></div>
    {loading ? <div className="service-grid"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /></div></div> : loadError ? <DiscoveryEmptyState query={loadError} onClear={() => location.reload()} suggestions={[]} errorState /> : filteredServices.length ? <><div className="service-grid">{filteredServices.map((service) => <ServiceCard service={preciseNearbyActive ? service : { ...service, distance_band: null, distance_priority: 0, nearby_match_mode: null }} contextQuery={contextQuery} key={service.id} />)}</div>{hasMore ? <div className="empty-actions" style={{ marginTop: '1rem' }}><Button type="button" variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>{tamil ? 'மேலும் Services ஏற்று' : 'Load more services'}</Button></div> : null}{loadMoreError ? <p className="field-error" role="alert" style={{ marginTop: '1rem' }}>{loadMoreError}</p> : null}</> : showRecoveryEmptyState ? <><div className="discovery-empty-wrap"><Card><EmptyState title={recoveryTitle}>{recoveryHelp}</EmptyState><div className="empty-actions">{zeroResultRecovery.showBroadenLocation ? <Button type="button" variant="secondary" onClick={broadenNamedLocation}>{tamil ? 'இந்த இடத்தைத் தாண்டி தேடு' : 'Search beyond this location'}</Button> : null}{zeroResultRecovery.showClearNearby ? <Button type="button" variant="secondary" onClick={clearNearbyLocation}>{tamil ? 'தற்போதைய இடத்தைத் தாண்டி தேடு' : 'Search beyond current location'}</Button> : null}{zeroResultRecovery.showBroadenFilters ? <Button type="button" variant="secondary" onClick={broadenFilters}>{tamil ? 'Filters-ஐ தளர்த்து' : 'Broaden filters'}</Button> : null}{zeroResultRecovery.showClearQuery ? <Button type="button" variant="secondary" onClick={clearSearch}>{tamil ? 'தேடலை நீக்கு' : 'Clear search'}</Button> : null}<Link href="/categories" className="button button-quiet">{t('empty.browseCategories')}</Link></div></Card></div><div className="empty-actions"><Link href={requirementHref} className="button button-primary">{t('explore.postRequirement')}</Link></div></> : <><DiscoveryEmptyState query={query} onClear={clearAll} suggestions={[]} /><div className="empty-actions"><Link href={requirementHref} className="button button-primary">{t('explore.postRequirement')}</Link></div></>}
    <p className="explore-disclaimer">{t('explore.disclaimer')}</p>
  </div>;
}