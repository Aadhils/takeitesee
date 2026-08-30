import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Badge, Card } from '../../../components/ui/primitives';
import { Breadcrumbs } from '../../../components/layout/NavigationContext';

const siteUrl = 'https://www.takeitesee.com';

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function seoText(value: string | null | undefined, fallback: string, max = 160) {
  const text = (value || fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const loadBusiness = cache(async (providerId: string) => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id,name,description,location,verified')
    .eq('id', providerId)
    .eq('verified', true)
    .maybeSingle();
  if (error || !business) return null;

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id,name,description,base_price,currency,duration_minutes,location')
    .eq('business_id', providerId)
    .eq('provider_type', 'business')
    .eq('status', 'active')
    .eq('active', true)
    .order('name');

  return {
    business: business as any,
    services: servicesError ? [] : (services ?? []) as any[],
  };
});

export async function generateMetadata({ params }: { params: Promise<{ providerId: string }> }): Promise<Metadata> {
  const { providerId } = await params;
  const record = await loadBusiness(providerId);

  if (!record) {
    return {
      title: 'Business unavailable',
      robots: { index: false, follow: false },
    };
  }

  const { business, services } = record;
  const location = business.location || '';
  const pageTitle = `${business.name}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const description = seoText(
    business.description,
    `Explore services from ${business.name}${location ? ` in ${location}` : ''} on TakeItEsee.`,
  );
  const canonical = `${siteUrl}/businesses/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0;

  return {
    title: pageTitle,
    description,
    alternates: indexable ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: indexable ? { title: socialTitle, description, url: canonical, type: 'website' } : undefined,
    twitter: indexable ? { card: 'summary', title: socialTitle, description } : undefined,
  };
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const record = await loadBusiness(providerId);
  if (!record) notFound();

  const { business, services } = record;
  const initials = business.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2);
  const canonical = `${siteUrl}/businesses/${encodeURIComponent(providerId)}`;
  const structuredData = services.length ? {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description || undefined,
    url: canonical,
    areaServed: business.location || undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Active services',
      itemListElement: services.slice(0, 20).map((service: any) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.name,
          url: `${siteUrl}/services/${encodeURIComponent(service.id)}`,
        },
      })),
    },
  } : null;

  return <div className="profile-page">
    {structuredData ? <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    /> : null}
    <Breadcrumbs items={[{ label: 'Explore', href: '/explore' }, { label: 'Business' }]} />
    <section className="profile-hero"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{initials}</div><div><div className="detail-badges"><Badge tone="success">Verified profile</Badge><Badge tone="info">Business provider</Badge></div><h1>{business.name}</h1><p className="profile-headline">{business.description || 'Verified business on takeitesee'}</p><p className="card-location">{business.location || 'Service area confirmed during booking'}</p></div></section>
    <div className="profile-layout"><main>
      <section className="detail-section"><span className="eyebrow">Business profile</span><h2>About {business.name}</h2><p className="detail-copy">{business.description || 'This verified business publishes live services through takeitesee.'}</p></section>
      <section className="detail-section"><div className="section-heading"><div><span className="eyebrow">Available services</span><h2>Choose a service</h2></div><Badge tone="info">{services.length} listed</Badge></div><div className="profile-services">{services.length ? services.map((service: any) => <Card className="profile-service" key={service.id}><div><h3>{service.name}</h3><p>{service.description || 'Service details are available on the listing page.'}</p><p>{service.duration_minutes ? `${service.duration_minutes} minutes · ` : ''}{money(Number(service.base_price || 0), service.currency || 'INR')}</p></div><Link href={`/services/${service.id}`} className="button button-primary">View service</Link></Card>) : <p className="empty-inline">No active services are currently published.</p>}</div></section>
    </main><aside className="profile-aside"><Card><span className="eyebrow">Live provider</span><h2>Verified business</h2><p>Only active, published services from this business are shown here.</p><Link href="/explore" className="button button-secondary">Explore services</Link></Card></aside></div>
  </div>;
}
