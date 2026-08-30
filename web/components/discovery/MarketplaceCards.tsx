import Link from 'next/link';
import { Badge, Card } from '../ui/primitives';
import { categoryName, displayText, type DiscoveryBusiness, type DiscoveryCategory, type DiscoveryProfessional, type DiscoveryService } from '../../data/discovery-fixtures';
import { formatMoney } from '../../types/money';

export function Rating({ value, count }: { value: number; count: number }) {
  return <span className="rating" aria-label={`${value} out of 5 stars from ${count} reviews`}><span aria-hidden="true">★</span> {value.toFixed(1)} <small>({count})</small></span>;
}

export function Price({ service }: { service: DiscoveryService }) {
  return <span className="price">From {formatMoney(service.pricing.base_price)}{service.pricing.pricing_model === 'hourly' ? ' / hour' : ''}</span>;
}

export function Availability({ label }: { label: DiscoveryService['availability'] }) {
  const tone = label === 'Available today' ? 'success' : label === 'Remote delivery' ? 'info' : 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

export function CategoryCard({ category }: { category: DiscoveryCategory }) {
  return (
    <Link href={`/explore?category=${category.slug}`} className="category-card">
      <span className="category-icon" aria-hidden="true">{category.icon}</span>
      <span className="category-card-body"><strong>{displayText(category.name)}</strong><span>{category.description}</span><small>{category.service_count} services</small></span>
      <span className="card-arrow" aria-hidden="true">-&gt;</span>
    </Link>
  );
}

export function ServiceCard({ service, contextQuery = '' }: { service: DiscoveryService; contextQuery?: string }) {
  const serviceHref = `/services/${service.id}${contextQuery ? `?${contextQuery}` : ''}`;
  const providerBaseHref = service.provider_type === 'professional'
    ? `/professionals/${service.provider_id}`
    : `/businesses/${service.provider_id}`;
  const providerHref = contextQuery ? `${providerBaseHref}?${contextQuery}` : providerBaseHref;
  return (
    <Card className="discovery-card service-discovery-card">
      <div className="service-card-art" aria-hidden="true"><span>{displayText(service.service_name).slice(0, 1)}</span><span className="art-label">{categoryName(service.category_id)}</span></div>
      <div className="discovery-card-content">
        <div className="card-meta"><Availability label={service.availability} />{service.verified ? <Badge tone="info">Verified provider</Badge> : null}</div>
        <h3><Link href={serviceHref}>{displayText(service.service_name)}</Link></h3>
        <p className="card-description">{displayText(service.description)}</p>
        <p className="card-provider"><Link href={providerHref}>{service.provider_name}</Link> <span aria-hidden="true">·</span> {service.provider_type === 'professional' ? 'Professional' : 'Business'}</p>
        <p className="card-location"><span aria-hidden="true">⌖</span> {service.location}</p>
        <div className="card-footer"><div><Rating value={service.rating} count={service.review_count} /><Price service={service} /></div><Link href={serviceHref} className="icon-link" aria-label={`View ${displayText(service.service_name)}`}>-&gt;</Link></div>
      </div>
    </Card>
  );
}

export function ProviderCard({ provider }: { provider: DiscoveryProfessional }) {
  const availability = provider.availability_mode === 'unavailable' ? 'Away' : provider.availability_mode === 'full_time' ? 'Available today' : 'Accepting projects';
  return (
    <Card className="discovery-card provider-card">
      <div className="provider-avatar" aria-hidden="true">{provider.display_name.split(' ').map((part) => part[0]).join('')}</div>
      <div className="discovery-card-content"><div className="card-meta"><Badge tone={provider.verified ? 'info' : 'neutral'}>{provider.verified ? 'Verified' : 'Independent'}</Badge><span className="availability-dot"><span aria-hidden="true">●</span> {availability}</span></div><h3>{provider.display_name}</h3><p className="provider-headline">{provider.headline}</p><p className="card-specialty">{provider.specialty}</p><p className="card-location"><span aria-hidden="true">⌖</span> {provider.location}</p><div className="card-footer"><Rating value={provider.rating} count={provider.review_count} /><Link href={`/professionals/${provider.id}`} className="button button-secondary">View profile</Link></div></div>
    </Card>
  );
}

export function BusinessCard({ business }: { business: DiscoveryBusiness }) {
  return (
    <Card className="discovery-card business-card"><div className="business-banner" aria-hidden="true"><span>{business.business_name.slice(0, 1)}</span></div><div className="discovery-card-content"><div className="card-meta"><Badge tone={business.verified ? 'success' : 'neutral'}>{business.verified ? 'Verified business' : 'Business profile'}</Badge><span className="availability-dot"><span aria-hidden="true">●</span> Open for enquiries</span></div><h3>{business.business_name}</h3><p className="card-specialty">{business.category}</p><p className="card-description">{business.service_summary}</p><p className="card-location"><span aria-hidden="true">⌖</span> {business.location}</p><div className="card-footer"><Rating value={business.rating} count={business.review_count} /><Link href={`/businesses/${business.id}`} className="button button-secondary">View business</Link></div></div></Card>
  );
}
