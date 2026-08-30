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

const loadProfessional = cache(async (providerId: string) => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: provider, error } = await supabase
    .from('professional_profiles')
    .select('id,headline,description,service_area,verified')
    .eq('id', providerId)
    .eq('verified', true)
    .maybeSingle();
  if (error || !provider) return null;

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id,name,description,base_price,currency,duration_minutes,location')
    .eq('professional_id', providerId)
    .eq('provider_type', 'professional')
    .eq('status', 'active')
    .eq('active', true)
    .order('name');

  return {
    provider: provider as any,
    services: servicesError ? [] : (services ?? []) as any[],
  };
});

export async function generateMetadata({ params }: { params: Promise<{ providerId: string }> }): Promise<Metadata> {
  const { providerId } = await params;
  const record = await loadProfessional(providerId);

  if (!record) {
    return {
      title: { absolute: 'Professional unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const { provider, services } = record;
  const displayName = provider.headline || 'Verified professional';
  const location = provider.service_area || '';
  const pageTitle = `${displayName}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const description = seoText(
    provider.description,
    `Explore services from ${displayName}${location ? ` in ${location}` : ''} on TakeItEsee.`,
  );
  const canonical = `${siteUrl}/professionals/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0;

  return {
    title: { absolute: socialTitle },
    description,
    alternates: indexable ? { canonical } : undefined,
    robots: { index: indexable, follow: indexable },
    openGraph: indexable ? { title: socialTitle, description, url: canonical, type: 'website' } : undefined,
    twitter: indexable ? { card: 'summary', title: socialTitle, description } : undefined,
  };
}

export default async function ProfessionalProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const record = await loadProfessional(providerId);
  if (!record) notFound();

  const { provider, services } = record;
  const displayName = provider.headline || 'Verified professional';
  const canonical = `${siteUrl}/professionals/${encodeURIComponent(providerId)}`;
  const structuredData = services.length ? {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: displayName,
    description: provider.description || undefined,
    url: canonical,
    areaServed: provider.service_area || undefined,
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
      kind="professional"
      provider={{
        name: provider.headline || '',
        description: provider.description || '',
        location: provider.service_area || '',
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
