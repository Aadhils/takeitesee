'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { DiscoveryCategoryRail, DiscoveryEmptyState, DiscoveryFilterDrawer, DiscoveryFilterFields, FilterChips, defaultDiscoveryFilters, type DiscoveryFilters } from '../../components/discovery/DiscoveryEnhancements';
import { discoveryCategories, discoveryPriceBands, discoveryRatingFilters } from '../../data/discovery-fixtures';

type MarketplaceService = any;
const locationOptions = ['Anywhere', 'Chennai', 'Bengaluru', 'Kochi', 'Remote delivery'];
const validSorts = ['relevance', 'rating', 'price', 'price-desc'];

function matchingOption(value: string | null, options: string[], fallback: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? options.find((option) => option.toLowerCase() === normalized) ?? value!.trim() : fallback;
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters);
  const [sort, setSort] = useState('relevance');
  const [urlReady, setUrlReady] = useState(false);
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const defaults = defaultDiscoveryFilters();
    const categoryParam = params.get('category');
    const category = discoveryCategories.some((item) => item.slug === categoryParam) ? categoryParam! : defaults.category;
    const price = discoveryPriceBands.some((item) => item.value === params.get('price')) ? params.get('price')! as DiscoveryFilters['price'] : defaults.price;
    const rating = discoveryRatingFilters.some((item) => item.value === params.get('rating')) ? params.get('rating')! as DiscoveryFilters['rating'] : defaults.rating;
    const availability = ['any', 'today', 'tomorrow', 'remote'].includes(params.get('availability') ?? '') ? params.get('availability')! as DiscoveryFilters['availability'] : defaults.availability;
    const provider = ['any', 'professional', 'business'].includes(params.get('provider') ?? '') ? params.get('provider')! as DiscoveryFilters['provider'] : defaults.provider;
    setQuery(params.get('q')?.trim() ?? '');
    setFilters({ category, location: matchingOption(params.get('location'), locationOptions, defaults.location), price, rating, availability, provider });
    setSort(validSorts.includes(params.get('sort') ?? '') ? params.get('sort')! : 'relevance');
    setUrlReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError('');
      try {
        const response = await fetch('/api/marketplace/services', { cache: 'no-store' });
        if (!response.ok) throw new Error('Marketplace catalog unavailable');
        const payload = await response.json();
        if (!cancelled) setServices(Array.isArray(payload.services) ? payload.services : []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load services');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (filters.location !== 'Anywhere') params.set('location', filters.location);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.price !== 'any') params.set('price', filters.price);
    if (filters.rating !== 'any') params.set('rating', filters.rating);
    if (filters.availability !== 'any') params.set('availability', filters.availability);
    if (filters.provider !== 'any') params.set('provider', filters.provider);
    if (sort !== 'relevance') params.set('sort', sort);
    window.history.replaceState(null, '', params.toString() ? `/explore?${params}` : '/explore');
  }, [filters, query, sort, urlReady]);

  const filteredServices = useMemo(() => services
    .filter((service) => filters.category === 'all' || service.category_slug === filters.category)
    .filter((service) => !query.trim() || `${service.service_name?.en ?? service.service_name ?? ''} ${service.provider_name ?? ''} ${service.description?.en ?? service.description ?? ''} ${service.location ?? ''} ${service.service_area ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((service) => filters.location === 'Anywhere' || `${service.location ?? ''} ${service.service_area ?? ''}`.toLowerCase().includes(filters.location.toLowerCase()))
    .filter((service) => filters.price === 'any' || (filters.price === 'under-1000' && service.pricing.base_price.amount < 100000) || (filters.price === '1000-5000' && service.pricing.base_price.amount >= 100000 && service.pricing.base_price.amount <= 500000) || (filters.price === 'over-5000' && service.pricing.base_price.amount > 500000))
    .filter((service) => filters.rating === 'any' || (filters.rating === '4-plus' && service.rating >= 4) || (filters.rating === '4.5-plus' && service.rating >= 4.5))
    .filter((service) => filters.provider === 'any' || service.provider_type === filters.provider)
    .sort((a, b) => sort === 'rating' ? b.rating - a.rating : sort === 'price' ? a.pricing.base_price.amount - b.pricing.base_price.amount : sort === 'price-desc' ? b.pricing.base_price.amount - a.pricing.base_price.amount : 0), [services, filters, query, sort]);

  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all' && value !== 'Anywhere' && value !== 'any').length;
  const clearAll = () => { setQuery(''); setFilters(defaultDiscoveryFilters()); setSort('relevance'); };

  return <div className="discovery-page discovery-workspace">
    <section className="page-intro"><span className="eyebrow">Customer discovery</span><h1>Find the right service for what comes next.</h1><p>Search live services published by verified professionals and businesses.</p></section>
    <DiscoveryCategoryRail activeCategory={filters.category} onSelect={(category) => setFilters({ ...filters, category })} />
    <section className="discovery-search-panel"><div className="discovery-search-row"><Input label="Search services" placeholder="Try home cleaning or tutoring" value={query} onChange={(e) => setQuery(e.target.value)} /><Button type="button" variant="secondary" className="mobile-filter-button" onClick={() => setDrawerOpen(true)}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button></div><div className="desktop-filter-fields"><DiscoveryFilterFields filters={filters} onChange={setFilters} /></div><div className="discovery-search-footer"><FilterChips filters={filters} onChange={setFilters} /><div className="sort-control"><Select label="Sort results" value={sort} onChange={(e) => setSort(e.target.value)}><option value="relevance">Most relevant</option><option value="rating">Highest rated</option><option value="price">Lowest starting price</option><option value="price-desc">Highest starting price</option></Select></div></div></section>
    <DiscoveryFilterDrawer open={drawerOpen} filters={filters} onChange={setFilters} onClose={() => setDrawerOpen(false)} />
    <div className="results-heading"><div><span className="eyebrow">Live marketplace</span><h2>{loading ? 'Loading services…' : `${filteredServices.length} services to explore`}</h2></div></div>
    {loading ? <div className="service-grid"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /></div></div> : loadError ? <DiscoveryEmptyState query={loadError} onClear={() => location.reload()} suggestions={[]} /> : filteredServices.length ? <div className="service-grid">{filteredServices.map((service) => <ServiceCard service={service} key={service.id} />)}</div> : <DiscoveryEmptyState query={query} onClear={clearAll} suggestions={[]} />}
    <p className="explore-disclaimer">Marketplace listings are loaded from the live provider catalog. Draft and paused services are excluded.</p>
  </div>;
}
