'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { DiscoveryEmptyState } from '../../components/discovery/DiscoveryEnhancements';

type MarketplaceService = any;
type PriceFilter = 'any' | 'under-1000' | '1000-5000' | 'over-5000';
type RatingFilter = 'any' | '4-plus' | '4.5-plus';
type ProviderFilter = 'any' | 'professional' | 'business';

type Filters = {
  category: string;
  location: string;
  price: PriceFilter;
  rating: RatingFilter;
  provider: ProviderFilter;
};

const validSorts = ['relevance', 'rating', 'price', 'price-desc'];
const priceBands: { value: PriceFilter; label: string }[] = [
  { value: 'any', label: 'Any price' },
  { value: 'under-1000', label: 'Under INR 1,000' },
  { value: '1000-5000', label: 'INR 1,000-5,000' },
  { value: 'over-5000', label: 'Over INR 5,000' },
];
const ratingBands: { value: RatingFilter; label: string }[] = [
  { value: 'any', label: 'Any rating' },
  { value: '4-plus', label: '4.0 and above' },
  { value: '4.5-plus', label: '4.5 and above' },
];

function defaultFilters(): Filters {
  return { category: 'all', location: 'Anywhere', price: 'any', rating: 'any', provider: 'any' };
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

function buildExploreParams(query: string, filters: Filters, sort: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (filters.location !== 'Anywhere' && filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.price !== 'any') params.set('price', filters.price);
  if (filters.rating !== 'any') params.set('rating', filters.rating);
  if (filters.provider !== 'any') params.set('provider', filters.provider);
  if (sort !== 'relevance') params.set('sort', sort);
  return params;
}

function searchText(service: MarketplaceService) {
  return normalized([
    localized(service.service_name),
    service.provider_name,
    localized(service.description),
    service.location,
    service.service_area,
    labelFromSlug(service.category_slug || service.category_id || 'other'),
  ].filter(Boolean).join(' '));
}

function matchesSearch(service: MarketplaceService, query: string) {
  const tokens = normalized(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const haystack = searchText(service);
  return tokens.every((token) => haystack.includes(token));
}

function relevanceScore(service: MarketplaceService, query: string) {
  const fullQuery = normalized(query);
  if (!fullQuery) return 0;

  const tokens = fullQuery.split(' ').filter(Boolean);
  const name = normalized(localized(service.service_name));
  const provider = normalized(service.provider_name);
  const description = normalized(localized(service.description));
  const location = normalized(`${service.location ?? ''} ${service.service_area ?? ''}`);
  const category = normalized(labelFromSlug(service.category_slug || service.category_id || 'other'));
  let score = 0;

  if (name === fullQuery) score += 180;
  else if (name.startsWith(fullQuery)) score += 130;
  else if (name.includes(fullQuery)) score += 95;

  if (category === fullQuery) score += 90;
  else if (category.includes(fullQuery)) score += 55;
  if (provider.includes(fullQuery)) score += 45;
  if (location.includes(fullQuery)) score += 35;

  for (const token of tokens) {
    if (name.includes(token)) score += 24;
    if (category.includes(token)) score += 16;
    if (provider.includes(token)) score += 10;
    if (location.includes(token)) score += 8;
    if (description.includes(token)) score += 4;
  }

  score += Math.min(Number(service.rating || 0), 5) * 2;
  score += Math.min(Number(service.review_count || 0), 20) * 0.25;
  return score;
}

function normalizeService(service: MarketplaceService) {
  const categorySlug = service.category_slug || service.category_id || 'other';
  return {
    ...service,
    provider_id: service.provider_id || service.business_id || service.professional_id || '',
    service_name: { default_locale: 'en', values: { en: localized(service.service_name) } },
    description: { default_locale: 'en', values: { en: localized(service.description) } },
    category_id: categorySlug,
    category_slug: categorySlug,
    pricing: {
      base_price: service.pricing?.base_price ?? { amount: 0, currency: 'INR' },
      pricing_model: service.pricing?.pricing_model ?? 'fixed',
    },
    availability: 'Check availability',
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

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState('relevance');
  const [urlReady, setUrlReady] = useState(false);
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const defaults = defaultFilters();
    const price = priceBands.some((item) => item.value === params.get('price')) ? params.get('price') as PriceFilter : defaults.price;
    const rating = ratingBands.some((item) => item.value === params.get('rating')) ? params.get('rating') as RatingFilter : defaults.rating;
    const provider = ['any', 'professional', 'business'].includes(params.get('provider') ?? '') ? params.get('provider') as ProviderFilter : defaults.provider;
    setQuery(params.get('q')?.trim() ?? '');
    setFilters({
      category: params.get('category')?.trim() || defaults.category,
      location: params.get('location')?.trim() || defaults.location,
      price,
      rating,
      provider,
    });
    setSort(validSorts.includes(params.get('sort') ?? '') ? params.get('sort')! : 'relevance');
    setUrlReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch('/api/marketplace/services', { cache: 'no-store' });
        if (!response.ok) throw new Error('Marketplace catalog unavailable');
        const payload = await response.json();
        if (!cancelled) setServices(Array.isArray(payload.services) ? payload.services.map(normalizeService) : []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => Array.from(new Set(services.map((service) => service.category_slug).filter(Boolean))).sort(), [services]);

  useEffect(() => {
    if (!loading && filters.category !== 'all' && !categories.includes(filters.category)) setFilters((current) => ({ ...current, category: 'all' }));
  }, [categories, filters.category, loading]);

  const contextQuery = useMemo(() => buildExploreParams(query, filters, sort).toString(), [filters, query, sort]);

  useEffect(() => {
    if (!urlReady) return;
    window.history.replaceState(null, '', contextQuery ? `/explore?${contextQuery}` : '/explore');
  }, [contextQuery, urlReady]);

  const filteredServices = useMemo(() => {
    const locationNeedle = filters.location === 'Anywhere' ? '' : normalized(filters.location);
    return services
      .filter((service) => filters.category === 'all' || service.category_slug === filters.category)
      .filter((service) => matchesSearch(service, query))
      .filter((service) => !locationNeedle || normalized(`${service.location ?? ''} ${service.service_area ?? ''}`).includes(locationNeedle))
      .filter((service) => filters.price === 'any' || (filters.price === 'under-1000' && service.pricing.base_price.amount < 100000) || (filters.price === '1000-5000' && service.pricing.base_price.amount >= 100000 && service.pricing.base_price.amount <= 500000) || (filters.price === 'over-5000' && service.pricing.base_price.amount > 500000))
      .filter((service) => filters.rating === 'any' || (filters.rating === '4-plus' && service.rating >= 4) || (filters.rating === '4.5-plus' && service.rating >= 4.5))
      .filter((service) => filters.provider === 'any' || service.provider_type === filters.provider)
      .sort((a, b) => sort === 'rating'
        ? b.rating - a.rating
        : sort === 'price'
          ? a.pricing.base_price.amount - b.pricing.base_price.amount
          : sort === 'price-desc'
            ? b.pricing.base_price.amount - a.pricing.base_price.amount
            : query.trim()
              ? relevanceScore(b, query) - relevanceScore(a, query)
              : 0);
  }, [services, filters, query, sort]);

  const clearAll = () => { setQuery(''); setFilters(defaultFilters()); setSort('relevance'); };
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const resultHeading = loading
    ? 'Loading services…'
    : query.trim()
      ? `${filteredServices.length} ${filteredServices.length === 1 ? 'match' : 'matches'} for “${query.trim()}”`
      : `${filteredServices.length} services to explore`;

  return <div className="discovery-page discovery-workspace">
    <section className="page-intro"><span className="eyebrow">Customer discovery</span><h1>Find the right service for what comes next.</h1><p>Search live services published by verified professionals and businesses.</p></section>

    <section className="discovery-search-panel">
      <div className="discovery-search-row"><Input label="Search services" placeholder="Search services, categories or providers" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className="discovery-filter-fields">
        <Select label="Category" value={filters.category} onChange={(e) => update('category', e.target.value)}><option value="all">All live categories</option>{categories.map((category) => <option value={category} key={category}>{labelFromSlug(category)}</option>)}</Select>
        <Input label="Location" placeholder="City or neighbourhood" value={filters.location === 'Anywhere' ? '' : filters.location} onChange={(e) => update('location', e.target.value.trim() ? e.target.value : 'Anywhere')} />
        <Select label="Price range" value={filters.price} onChange={(e) => update('price', e.target.value as PriceFilter)}>{priceBands.map((band) => <option value={band.value} key={band.value}>{band.label}</option>)}</Select>
        <Select label="Rating" value={filters.rating} onChange={(e) => update('rating', e.target.value as RatingFilter)}>{ratingBands.map((band) => <option value={band.value} key={band.value}>{band.label}</option>)}</Select>
        <Select label="Provider type" value={filters.provider} onChange={(e) => update('provider', e.target.value as ProviderFilter)}><option value="any">Any provider</option><option value="professional">Professional</option><option value="business">Business</option></Select>
      </div>
      <div className="discovery-search-footer"><Button type="button" variant="quiet" onClick={clearAll}>Clear filters</Button><div className="sort-control"><Select label="Sort results" value={sort} onChange={(e) => setSort(e.target.value)}><option value="relevance">Most relevant</option><option value="rating">Highest rated</option><option value="price">Lowest starting price</option><option value="price-desc">Highest starting price</option></Select></div></div>
    </section>

    <div className="results-heading"><div><span className="eyebrow">Live marketplace</span><h2>{resultHeading}</h2></div></div>
    {loading ? <div className="service-grid"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /></div></div> : loadError ? <DiscoveryEmptyState query={loadError} onClear={() => location.reload()} suggestions={[]} /> : filteredServices.length ? <div className="service-grid">{filteredServices.map((service) => <ServiceCard service={service} contextQuery={contextQuery} key={service.id} />)}</div> : <><DiscoveryEmptyState query={query} onClear={clearAll} suggestions={[]} /><div className="empty-actions"><Link href="/requirements" className="button button-primary">Post a requirement</Link></div></>}
    <p className="explore-disclaimer">Categories and locations on this page are generated from the live provider catalog. Draft, paused, and unverified listings are excluded.</p>
  </div>;
}
