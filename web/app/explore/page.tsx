'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { DiscoveryCategoryRail, DiscoveryEmptyState, DiscoveryFilterDrawer, DiscoveryFilterFields, DiscoverySection, FilterChips, defaultDiscoveryFilters, type DiscoveryFilters } from '../../components/discovery/DiscoveryEnhancements';
import { categoryName, displayText, discoveryCategories, discoveryPriceBands, discoveryRatingFilters, discoveryServices } from '../../data/discovery-fixtures';

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
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [showLoadingExample, setShowLoadingExample] = useState(false);
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
    try {
      const stored = JSON.parse(window.localStorage.getItem('takeitesee.recentlyViewed') ?? '[]');
      if (Array.isArray(stored)) setRecentlyViewedIds(stored.filter((value): value is string => typeof value === 'string'));
    } catch {
      setRecentlyViewedIds([]);
    }
    setUrlReady(true);
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
    const nextUrl = params.toString() ? `/explore?${params.toString()}` : '/explore';
    window.history.replaceState(null, '', nextUrl);
  }, [filters, query, sort, urlReady]);

  const filteredServices = useMemo(() => discoveryServices
    .filter((service) => filters.category === 'all' || service.category_id === discoveryCategories.find((category) => category.slug === filters.category)?.id)
    .filter((service) => {
      const searchText = `${displayText(service.service_name)} ${categoryName(service.category_id)} ${service.provider_name} ${displayText(service.description)} ${service.location} ${service.service_area}`.toLowerCase();
      return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every((term) => searchText.includes(term));
    })
    .filter((service) => filters.location === 'Anywhere' || service.location.toLowerCase().includes(filters.location.toLowerCase()) || service.service_area.toLowerCase().includes(filters.location.toLowerCase()))
    .filter((service) => filters.price === 'any' || (filters.price === 'under-1000' && service.pricing.base_price.amount < 100000) || (filters.price === '1000-5000' && service.pricing.base_price.amount >= 100000 && service.pricing.base_price.amount <= 500000) || (filters.price === 'over-5000' && service.pricing.base_price.amount > 500000))
    .filter((service) => filters.rating === 'any' || (filters.rating === '4-plus' && service.rating >= 4) || (filters.rating === '4.5-plus' && service.rating >= 4.5))
    .filter((service) => filters.availability === 'any' || (filters.availability === 'today' && service.availability === 'Available today') || (filters.availability === 'tomorrow' && service.availability === 'Next available tomorrow') || (filters.availability === 'remote' && service.availability === 'Remote delivery'))
    .filter((service) => filters.provider === 'any' || service.provider_type === filters.provider)
    .sort((first, second) => sort === 'rating' ? second.rating - first.rating : sort === 'price' ? first.pricing.base_price.amount - second.pricing.base_price.amount : sort === 'price-desc' ? second.pricing.base_price.amount - first.pricing.base_price.amount : 0), [filters, query, sort]);

  const recommended = discoveryServices.filter((service) => service.rating >= 4.8).slice(0, 3);
  const popular = discoveryServices.slice(0, 3);
  const recentlyViewed = recentlyViewedIds.map((id) => discoveryServices.find((service) => service.id === id)).filter((service): service is typeof discoveryServices[number] => Boolean(service));
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all' && value !== 'Anywhere' && value !== 'any').length;
  const clearAll = () => { setQuery(''); setFilters(defaultDiscoveryFilters()); setSort('relevance'); };
  const exploreContext = new URLSearchParams();
  if (urlReady && query.trim()) exploreContext.set('q', query.trim());
  if (urlReady && filters.location !== 'Anywhere') exploreContext.set('location', filters.location);
  if (urlReady && filters.category !== 'all') exploreContext.set('category', filters.category);
  if (urlReady && filters.price !== 'any') exploreContext.set('price', filters.price);
  if (urlReady && filters.rating !== 'any') exploreContext.set('rating', filters.rating);
  if (urlReady && filters.availability !== 'any') exploreContext.set('availability', filters.availability);
  if (urlReady && filters.provider !== 'any') exploreContext.set('provider', filters.provider);
  if (urlReady && sort !== 'relevance') exploreContext.set('sort', sort);
  const contextQuery = exploreContext.toString();

  return (
    <div className="discovery-page discovery-workspace">
      <section className="page-intro"><span className="eyebrow">Customer discovery</span><h1>Find the right service for what comes next.</h1><p>Search and compare local presentation listings by category, location, price, rating, provider type, and availability.</p></section>
      <DiscoveryCategoryRail activeCategory={filters.category} onSelect={(category) => setFilters({ ...filters, category })} />
      <section className="discovery-search-panel" aria-label="Service search and filters"><div className="discovery-search-row"><Input label="Search services" placeholder="Try home cleaning or tutoring" value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="button" variant="secondary" className="mobile-filter-button" onClick={() => setDrawerOpen(true)}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button></div><div className="desktop-filter-fields"><DiscoveryFilterFields filters={filters} onChange={setFilters} /></div><div className="discovery-search-footer"><FilterChips filters={filters} onChange={setFilters} /><div className="sort-control"><Select label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Most relevant</option><option value="rating">Highest rated</option><option value="price">Lowest starting price</option><option value="price-desc">Highest starting price</option></Select></div></div></section>
      <DiscoveryFilterDrawer open={drawerOpen} filters={filters} onChange={setFilters} onClose={() => setDrawerOpen(false)} />
      <div className="results-heading"><div><span className="eyebrow">Presentation results</span><h2>{filteredServices.length} services to explore</h2></div><div className="results-actions"><span className="results-note">Showing around {filters.location}</span><Button type="button" variant="quiet" onClick={() => setShowLoadingExample((value) => !value)}>{showLoadingExample ? 'Hide loading example' : 'Loading example'}</Button></div></div>
      {showLoadingExample ? <div className="service-grid" aria-label="Loading services"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div></div> : filteredServices.length > 0 ? <div className="service-grid">{filteredServices.map((service) => <ServiceCard service={service} contextQuery={contextQuery} key={service.id} />)}</div> : <DiscoveryEmptyState query={query} onClear={clearAll} suggestions={recommended} />}
      {!query && activeFilterCount === 0 ? <><DiscoverySection eyebrow="Popular right now" title="Trending services" services={popular} /><DiscoverySection eyebrow="Picked for you" title="Recommended services" services={recommended} /><DiscoverySection eyebrow="Your trail" title="Recently viewed" services={recentlyViewed} /></> : null}
      <p className="explore-disclaimer">These listings are illustrative discovery data. Pricing, ratings, and availability will be confirmed by future server-backed catalog reads.</p>
    </div>
  );
}
