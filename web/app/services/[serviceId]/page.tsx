import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import LiveServiceDetail from '../../../components/detail/LiveServiceDetail';

const siteUrl = 'https://www.takeitesee.com';
const exploreContextKeys = ['q', 'location', 'category', 'price', 'rating', 'provider', 'sort'] as const;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function relation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function seoText(value: string | null | undefined, fallback: string, max = 160) {
  const text = (value || fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildExploreHref(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const key of exploreContextKeys) {
    const value = firstParam(searchParams[key])?.trim();
    if (value) params.set(key, value);
  }
  return params.toString() ? `/explore?${params.toString()}` : '/explore';
}

const loadPublicService = cache(async (serviceId: string) => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from('services')
    .select('id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,status,active,professional_profiles(headline,description,service_area,verified),businesses(name,description,location,verified)')
    .eq('id', serviceId)
    .eq('status', 'active')
    .eq('active', true)
    .maybeSingle();

  if (error || !row) return null;

  const provider: any = row.provider_type === 'business' ? relation(row.businesses) : relation(row.professional_profiles);
  if (!provider?.verified) return null;

  const providerName = row.provider_type === 'business' ? provider.name : provider.headline;
  const providerLocation = row.provider_type === 'business' ? provider.location : provider.service_area;

  return {
    row: row as any,
    provider,
    providerName: providerName || '',
    providerLocation: providerLocation || row.location || '',
  };
});

export async function generateMetadata({ params }: { params: Promise<{ serviceId: string }> }): Promise<Metadata> {
  const { serviceId } = await params;
  const record = await loadPublicService(serviceId);

  if (!record) {
    return {
      title: 'Service unavailable',
      robots: { index: false, follow: false },
    };
  }

  const { row, providerLocation } = record;
  const location = row.location || providerLocation || '';
  const pageTitle = `${row.name}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const description = seoText(
    row.description,
    `Book ${row.name}${location ? ` in ${location}` : ''} from a verified provider on TakeItEsee.`,
  );
  const canonical = `${siteUrl}/services/${encodeURIComponent(serviceId)}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      type: 'website',
      images: ['/brand/social'],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/brand/social'],
    },
  };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ serviceId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const record = await loadPublicService(serviceId);
  if (!record) notFound();

  const { row, provider, providerName, providerLocation } = record;
  const supabase = publicSupabase();
  if (!supabase) notFound();

  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('id,rating,comment,created_at,customer_id,users(name)')
    .eq('service_id', serviceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const reviews = (reviewRows ?? []).map((review: any) => ({
    id: review.id,
    reviewer_name: relation(review.users)?.name || '',
    rating: Number(review.rating),
    comment: review.comment || '',
    date: review.created_at,
    verified_booking: true,
  }));
  const rating = reviews.length ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length : 0;
  const providerDescription = provider.description || '';

  const service = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || '',
    provider_name: providerName,
    provider_type: row.provider_type as 'professional' | 'business',
    provider_id: row.business_id || row.professional_id || row.id,
    provider_description: providerDescription,
    location: row.location || providerLocation || '',
    service_area: providerLocation || row.location || '',
    duration_minutes: row.duration_minutes || 0,
    base_price: Number(row.base_price || 0),
    currency: row.currency || 'INR',
    verified: true,
    rating,
    review_count: reviews.length,
  };

  const canonical = `${siteUrl}/services/${encodeURIComponent(serviceId)}`;
  const providerUrl = service.provider_type === 'business'
    ? `${siteUrl}/businesses/${encodeURIComponent(service.provider_id)}`
    : `${siteUrl}/professionals/${encodeURIComponent(service.provider_id)}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description || undefined,
    url: canonical,
    category: service.category || undefined,
    areaServed: service.service_area || undefined,
    provider: {
      '@type': service.provider_type === 'business' ? 'LocalBusiness' : 'ProfessionalService',
      name: service.provider_name || 'Verified provider',
      url: providerUrl,
    },
    offers: service.base_price > 0 ? {
      '@type': 'Offer',
      price: service.base_price,
      priceCurrency: service.currency,
      url: canonical,
      availability: 'https://schema.org/InStock',
    } : undefined,
    aggregateRating: service.review_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: Number(service.rating.toFixed(2)),
      reviewCount: service.review_count,
    } : undefined,
  };

  return <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    />
    <LiveServiceDetail service={service} reviews={reviews} exploreHref={buildExploreHref(resolvedSearchParams)} />
  </>;
}
