'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { DiscoveryCategoryRail, DiscoveryEmptyState, DiscoveryFilterDrawer, DiscoveryFilterFields, DiscoverySection, FilterChips, defaultDiscoveryFilters, type DiscoveryFilters } from '../../components/discovery/DiscoveryEnhancements';
import { discoveryCategories, discoveryServices } from '../../data/discovery-fixtures';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultDiscoveryFilters);
  const [sort, setSort] = useState('relevance');
  const [showLoadingExample, setShowLoadingExample] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredServices = useMemo(() => discoveryServices
    .filter((service) => filters.category === 'all' || service.category_id === discoveryCategories.find((category) => category.slug === filters.category)?.id)
    .filter((service) => `${service.service_name.values.en} ${service.provider_name} ${service.location} ${service.service_area}`.toLowerCase().includes(query.toLowerCase()))
    .filter((service) => filters.location === 'Anywhere' || service.location.includes(filters.location) || service.service_area.includes(filters.location) || (filters.location === 'Remote delivery' && service.location === 'Remote delivery'))
    .filter((service) => filters.price === 'any' || (filters.price === 'under-1000' && service.pricing.base_price.amount < 100000) || (filters.price === '1000-5000' && service.pricing.base_price.amount >= 100000 && service.pricing.base_price.amount <= 500000) || (filters.price === 'over-5000' && service.pricing.base_price.amount > 500000))
    .filter((service) => filters.rating === 'any' || (filters.rating === '4-plus' && service.rating >= 4) || (filters.rating === '4.5-plus' && service.rating >= 4.5))
    .filter((service) => filters.availability === 'any' || (filters.availability === 'today' && service.availability === 'Available today') || (filters.availability === 'tomorrow' && service.availability === 'Next available tomorrow') || (filters.availability === 'remote' && service.availability === 'Remote delivery'))
    .filter((service) => filters.provider === 'any' || service.provider_type === filters.provider)
    .sort((first, second) => sort === 'rating' ? second.rating - first.rating : sort === 'price' ? first.pricing.base_price.amount - second.pricing.base_price.amount : 0), [filters, query, sort]);

  const recommended = discoveryServices.filter((service) => service.rating >= 4.8).slice(0, 3);
  const popular = discoveryServices.slice(0, 3);
  const recentlyViewed = discoveryServices.slice(3, 5);
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all' && value !== 'Anywhere' && value !== 'any').length;

  return (
    <div className="discovery-page discovery-workspace">
      <section className="page-intro"><span className="eyebrow">Customer discovery</span><h1>Find the right service for what comes next.</h1><p>Search and compare local presentation listings by category, location, price, rating, provider type, and availability.</p></section>
      <DiscoveryCategoryRail activeCategory={filters.category} onSelect={(category) => setFilters({ ...filters, category })} />
      <section className="discovery-search-panel" aria-label="Service search and filters"><div className="discovery-search-row"><Input label="Search services" placeholder="Try home cleaning or tutoring" value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="button" variant="secondary" className="mobile-filter-button" onClick={() => setDrawerOpen(true)}>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button></div><div className="desktop-filter-fields"><DiscoveryFilterFields filters={filters} onChange={setFilters} /></div><div className="discovery-search-footer"><FilterChips filters={filters} onChange={setFilters} /><div className="sort-control"><Select label="Sort results" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Most relevant</option><option value="rating">Highest rated</option><option value="price">Lowest starting price</option></Select></div></div></section>
      <DiscoveryFilterDrawer open={drawerOpen} filters={filters} onChange={setFilters} onClose={() => setDrawerOpen(false)} />
      <div className="results-heading"><div><span className="eyebrow">Presentation results</span><h2>{filteredServices.length} services to explore</h2></div><div className="results-actions"><span className="results-note">Showing around {filters.location}</span><Button type="button" variant="quiet" onClick={() => setShowLoadingExample((value) => !value)}>{showLoadingExample ? 'Hide loading example' : 'Loading example'}</Button></div></div>
      {showLoadingExample ? <div className="service-grid" aria-label="Loading services"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div></div> : filteredServices.length > 0 ? <div className="service-grid">{filteredServices.map((service) => <ServiceCard service={service} key={service.id} />)}</div> : <DiscoveryEmptyState query={query} onClear={() => { setQuery(''); setFilters(defaultDiscoveryFilters()); }} suggestions={recommended} />}
      {!query && activeFilterCount === 0 ? <><DiscoverySection eyebrow="Popular right now" title="Trending services" services={popular} /><DiscoverySection eyebrow="Picked for you" title="Recommended services" services={recommended} /><DiscoverySection eyebrow="Your trail" title="Recently viewed" services={recentlyViewed} /></> : null}
      <p className="explore-disclaimer">These listings are illustrative discovery data. Pricing, ratings, and availability will be confirmed by future server-backed catalog reads.</p>
    </div>
  );
}
