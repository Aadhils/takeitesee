'use client';

import Link from 'next/link';
import { Badge, Button, Card, EmptyState, Input, Select } from '../ui/primitives';
import { Price, Rating, Availability } from './MarketplaceCards';
import { categoryName, displayText, discoveryCategories, discoveryPriceBands, discoveryRatingFilters, type DiscoveryAvailabilityFilter, type DiscoveryPriceBand, type DiscoveryProviderFilter, type DiscoveryRatingFilter, type DiscoveryService } from '../../data/discovery-fixtures';

export type DiscoveryFilters = {
  category: string;
  location: string;
  price: DiscoveryPriceBand;
  rating: DiscoveryRatingFilter;
  availability: DiscoveryAvailabilityFilter;
  provider: DiscoveryProviderFilter;
};

export function defaultDiscoveryFilters(): DiscoveryFilters {
  return { category: 'all', location: 'Anywhere', price: 'any', rating: 'any', availability: 'any', provider: 'any' };
}

export function DiscoveryFilterFields({ filters, onChange }: { filters: DiscoveryFilters; onChange: (filters: DiscoveryFilters) => void }) {
  const update = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) => onChange({ ...filters, [key]: value });
  return <div className="discovery-filter-fields"><Select label="Category" value={filters.category} onChange={(event) => update('category', event.target.value)}><option value="all">All categories</option>{discoveryCategories.map((category) => <option value={category.slug} key={category.id}>{displayText(category.name)}</option>)}</Select><Select label="Location" value={filters.location} onChange={(event) => update('location', event.target.value)}><option>Anywhere</option><option>Chennai</option><option>Bengaluru</option><option>Kochi</option><option>Remote delivery</option></Select><Select label="Price range" value={filters.price} onChange={(event) => update('price', event.target.value as DiscoveryPriceBand)}>{discoveryPriceBands.map((band) => <option value={band.value} key={band.value}>{band.label}</option>)}</Select><Select label="Rating" value={filters.rating} onChange={(event) => update('rating', event.target.value as DiscoveryRatingFilter)}>{discoveryRatingFilters.map((rating) => <option value={rating.value} key={rating.value}>{rating.label}</option>)}</Select><Select label="Availability" value={filters.availability} onChange={(event) => update('availability', event.target.value as DiscoveryAvailabilityFilter)}><option value="any">Any availability</option><option value="today">Available today</option><option value="tomorrow">Next available tomorrow</option><option value="remote">Remote delivery</option></Select><Select label="Provider type" value={filters.provider} onChange={(event) => update('provider', event.target.value as DiscoveryProviderFilter)}><option value="any">Any provider</option><option value="professional">Professional</option><option value="business">Business</option></Select></div>;
}

export function FilterChips({ filters, onChange }: { filters: DiscoveryFilters; onChange: (filters: DiscoveryFilters) => void }) {
  const chips = [{ key: 'category', value: filters.category === 'all' ? '' : discoveryCategories.find((category) => category.slug === filters.category)?.name.values.en }, { key: 'location', value: filters.location === 'Anywhere' ? '' : filters.location }, { key: 'price', value: discoveryPriceBands.find((band) => band.value === filters.price)?.label }, { key: 'rating', value: discoveryRatingFilters.find((rating) => rating.value === filters.rating)?.label }, { key: 'availability', value: filters.availability === 'any' ? '' : filters.availability === 'today' ? 'Available today' : filters.availability === 'tomorrow' ? 'Tomorrow' : 'Remote delivery' }, { key: 'provider', value: filters.provider === 'any' ? '' : filters.provider === 'professional' ? 'Professional' : 'Business' }].filter((chip) => chip.value);
  if (!chips.length) return null;
  return <div className="filter-chips" aria-label="Active filters">{chips.map((chip) => <button type="button" className="filter-chip" onClick={() => onChange({ ...filters, [chip.key]: chip.key === 'category' ? 'all' : chip.key === 'location' ? 'Anywhere' : chip.key === 'price' ? 'any' : chip.key === 'rating' ? 'any' : chip.key === 'availability' ? 'any' : 'any' } as DiscoveryFilters)} key={chip.key}>{chip.value}<span aria-hidden="true">x</span><span className="sr-only">Remove filter</span></button>)}<button type="button" className="clear-filters" onClick={() => onChange(defaultDiscoveryFilters())}>Clear all</button></div>;
}

export function DiscoveryFilterDrawer({ open, filters, onChange, onClose }: { open: boolean; filters: DiscoveryFilters; onChange: (filters: DiscoveryFilters) => void; onClose: () => void }) {
  if (!open) return null;
  return <div className="filter-drawer-backdrop" role="presentation" onMouseDown={onClose}><section className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-heading" onMouseDown={(event) => event.stopPropagation()}><div className="filter-drawer-heading"><div><span className="eyebrow">Refine results</span><h2 id="filter-drawer-heading">Filters</h2></div><button type="button" className="icon-button" aria-label="Close filters" onClick={onClose}>x</button></div><DiscoveryFilterFields filters={filters} onChange={onChange} /><Button type="button" onClick={onClose}>Show results</Button></section></div>;
}

export function DiscoveryCategoryRail({ activeCategory, onSelect }: { activeCategory: string; onSelect: (category: string) => void }) {
  return <section className="category-rail" aria-labelledby="category-rail-heading"><div className="section-heading"><div><span className="eyebrow">Browse by need</span><h2 id="category-rail-heading">Popular categories</h2></div><Link href="/categories" className="text-link">All categories</Link></div><div className="category-rail-items"><button type="button" className={activeCategory === 'all' ? 'category-rail-item category-rail-active' : 'category-rail-item'} onClick={() => onSelect('all')}><span aria-hidden="true">✦</span><strong>All services</strong></button>{discoveryCategories.map((category) => <button type="button" className={activeCategory === category.slug ? 'category-rail-item category-rail-active' : 'category-rail-item'} onClick={() => onSelect(category.slug)} key={category.id}><span aria-hidden="true">{category.icon}</span><strong>{displayText(category.name)}</strong><small>{category.service_count}</small></button>)}</div></section>;
}

export function DiscoveryServiceMiniCard({ service }: { service: DiscoveryService }) {
  return <Card className="service-mini-card"><div><span className="eyebrow">{categoryName(service.category_id)}</span><h3><Link href={`/services/${service.id}`}>{displayText(service.service_name)}</Link></h3><p>{service.provider_name}</p></div><div><Rating value={service.rating} count={service.review_count} /><Price service={service} /><Availability label={service.availability} /></div></Card>;
}

export function DiscoverySection({ title, eyebrow, services }: { title: string; eyebrow: string; services: DiscoveryService[] }) {
  return <section className="discovery-section" aria-labelledby={`${title.replace(/\s/g, '-').toLowerCase()}-heading`}><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id={`${title.replace(/\s/g, '-').toLowerCase()}-heading`}>{title}</h2></div></div><div className="service-mini-grid">{services.map((service) => <DiscoveryServiceMiniCard service={service} key={service.id} />)}</div></section>;
}

export function DiscoveryEmptyState({ query, onClear, suggestions }: { query: string; onClear: () => void; suggestions: DiscoveryService[] }) {
  return <div className="discovery-empty-wrap"><Card><EmptyState title={query ? `No services found for “${query}”` : 'No services match these filters'}>Try clearing one filter or browse a popular category to broaden your search.</EmptyState><div className="empty-actions"><Button type="button" variant="secondary" onClick={onClear}>Clear filters</Button><Link href="/categories" className="button button-quiet">Browse categories</Link></div></Card>{suggestions.length ? <DiscoverySection eyebrow="You may like" title="Suggested services" services={suggestions} /> : null}</div>;
}
