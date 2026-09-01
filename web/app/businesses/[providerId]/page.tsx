import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderProfile from '../../../components/detail/PublicProviderProfile';

const siteUrl = 'https://www.takeitesee.com';

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
      title: { absolute: 'Business unavailable | TakeItEsee' },
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
    title: { absolute: socialTitle },
    description,
    alternates: indexable ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: indexable ? {
      title: socialTitle,
      description,
      url: canonical,
      type: 'website',
      images: ['/brand/social'],
    } : undefined,
    twitter: indexable ? {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/brand/social'],
    } : undefined,
  };
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const record = await loadBusiness(providerId);
  if (!record) notFound();

  const { business, services } = record;
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

  return <>
    {structuredData ? <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    /> : null}
    <PublicProviderProfile
      kind="business"
      provider={{
        name: business.name || '',
        description: business.description || '',
        location: business.location || '',
      }}
      services={services.map((service: any) => ({
        id: String(service.id),
        name: String(service.name || ''),
        description: String(service.description || ''),
        base_price: service.base_price,
        currency: service.currency || 'INR',
        duration_minutes: service.duration_minutes ? Number(service.duration_minutes) : null,
      }))}
    />
  </>;
}
