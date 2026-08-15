'use client';

import { useState } from 'react';
import { Button, EmptyState, Input, Select, Skeleton } from '../../components/ui/primitives';
import { ServiceCard } from '../../components/discovery/MarketplaceCards';
import { discoveryCategories, discoveryServices } from '../../data/discovery-fixtures';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('Chennai');
  const [sort, setSort] = useState('relevance');
  const [showLoadingExample, setShowLoadingExample] = useState(false);

  const filteredServices = discoveryServices
    .filter((service) => category === 'all' || service.category_id === discoveryCategories.find((item) => item.slug === category)?.id)
    .filter((service) => `${service.service_name.values.en} ${service.provider_name} ${service.location}`.toLowerCase().includes(query.toLowerCase()))
    .filter((service) => location === 'Anywhere' || service.location.includes(location) || service.location === 'Remote delivery')
    .sort((first, second) => sort === 'rating' ? second.rating - first.rating : sort === 'price' ? first.pricing.base_price.amount - second.pricing.base_price.amount : 0);

  return (
    <div className="discovery-page">
      <section className="page-intro"><span className="eyebrow">Customer discovery</span><h1>Explore services that fit your day.</h1><p>Search presentation is local for now. Live search, geolocation, and availability remain future integrations.</p></section>
      <section className="explore-toolbar" aria-label="Service search and filters">
        <div className="explore-search"><Input label="Search services" placeholder="Try home cleaning or tutoring" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select label="Location" value={location} onChange={(event) => setLocation(event.target.value)}><option>Chennai</option><option>Bengaluru</option><option>Kochi</option><option>Anywhere</option></Select>
        <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{discoveryCategories.map((item) => <option value={item.slug} key={item.id}>{item.name.values.en}</option>)}</Select>
        <Select label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Relevance</option><option value="rating">Highest rated</option><option value="price">Lowest starting price</option></Select>
        <Button type="button" variant="secondary" onClick={() => setShowLoadingExample((value) => !value)}>{showLoadingExample ? 'Hide example' : 'Show loading'}</Button>
      </section>
      <div className="results-heading"><div><span className="eyebrow">Presentation results</span><h2>{filteredServices.length} services to explore</h2></div><span className="results-note">Showing around {location}</span></div>
      {showLoadingExample ? <div className="service-grid" aria-label="Loading services"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /><Skeleton className="loading-line" /></div></div> : filteredServices.length > 0 ? <div className="service-grid">{filteredServices.map((service) => <ServiceCard service={service} key={service.id} />)}</div> : <div className="card"><EmptyState title="No services match those filters">Try a broader search or choose Anywhere to see remote and nearby presentation fixtures.</EmptyState></div>}
      <p className="explore-disclaimer">These listings are illustrative discovery data. Pricing, ratings, and availability will be confirmed by future server-backed catalog reads.</p>
    </div>
  );
}
