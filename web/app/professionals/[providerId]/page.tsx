import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderProfile from '../../../components/detail/PublicProviderProfile';
import { createSupabaseServiceClient } from '../../../lib/supabase/service';

const siteUrl = 'https://www.takeitesee.com';
const portfolioBucket = 'professional-portfolio-media';
const signedMediaTtlSeconds = 15 * 60;

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

function hasMarketplaceDisclosure(provider: any) {
  return Boolean(
    provider?.legal_name?.trim() && provider?.principal_address?.trim() && provider?.public_contact_email?.trim() && provider?.public_contact_phone?.trim()
    && provider?.grievance_officer_name?.trim() && provider?.grievance_officer_designation?.trim() && provider?.grievance_email?.trim() && provider?.grievance_phone?.trim(),
  );
}

async function loadSignedPortfolioMedia(providerId: string, roles: any[]) {
  try {
    const service = createSupabaseServiceClient();
    const { data: mediaRows, error } = await service
      .from('professional_portfolio_media')
      .select('id,professional_role_id,media_type,object_path,caption,alt_text,display_order,created_at')
      .eq('professional_id', providerId)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !mediaRows?.length) return [];

    const roleTitle = new Map(roles.map((role: any) => [String(role.id), String(role.title || '')]));
    const visibleRows = mediaRows.filter((row: any) => !row.professional_role_id || roleTitle.has(String(row.professional_role_id)));
    const signed = await Promise.all(visibleRows.map(async (row: any) => {
      const { data, error: signedError } = await service.storage.from(portfolioBucket).createSignedUrl(String(row.object_path), signedMediaTtlSeconds);
      if (signedError || !data?.signedUrl) return null;
      return {
        id: String(row.id),
        media_type: row.media_type === 'video' ? 'video' as const : 'image' as const,
        signed_url: data.signedUrl,
        caption: String(row.caption || ''),
        alt_text: String(row.alt_text || ''),
        role_title: row.professional_role_id ? roleTitle.get(String(row.professional_role_id)) || null : null,
      };
    }));
    return signed.filter((item): item is NonNullable<typeof item> => Boolean(item));
  } catch {
    return [];
  }
}

const loadProfessional = cache(async (providerId: string) => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: provider, error } = await supabase
    .from('professional_profiles')
    .select('id,headline,description,service_area,verified,legal_name,principal_address,public_contact_email,public_contact_phone,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
    .eq('id', providerId)
    .eq('verified', true)
    .maybeSingle();
  if (error || !provider || !hasMarketplaceDisclosure(provider)) return null;

  const [servicesResult, rolesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id,name,description,base_price,currency,duration_minutes,location')
      .eq('professional_id', providerId)
      .eq('provider_type', 'professional')
      .eq('status', 'active')
      .eq('active', true)
      .order('name'),
    supabase
      .from('professional_roles')
      .select('id,title,summary,experience_years,service_bookings_enabled,freelance_enabled,part_time_enabled,full_time_enabled,contract_enabled,display_order,created_at')
      .eq('professional_id', providerId)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const services = servicesResult.error ? [] : (servicesResult.data ?? []) as any[];
  const roles = rolesResult.error ? [] : (rolesResult.data ?? []) as any[];
  const media = await loadSignedPortfolioMedia(providerId, roles);

  return {
    provider: provider as any,
    services,
    roles,
    media,
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

  const { provider, services, roles } = record;
  const displayName = provider.headline || 'Verified professional';
  const location = provider.service_area || '';
  const primaryTalent = roles[0]?.title ? ` · ${String(roles[0].title)}` : '';
  const pageTitle = `${displayName}${primaryTalent}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const talentText = roles.length ? ` Skills include ${roles.slice(0, 3).map((role: any) => role.title).join(', ')}.` : '';
  const description = seoText(
    provider.description,
    `Explore services, professional talents and work samples from ${displayName}${location ? ` in ${location}` : ''} on TakeItEsee.${talentText}`,
  );
  const canonical = `${siteUrl}/professionals/${encodeURIComponent(providerId)}`;
  const indexable = services.length > 0 || roles.length > 0;

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

export default async function ProfessionalProfilePage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const record = await loadProfessional(providerId);
  if (!record) notFound();

  const { provider, services, roles, media } = record;
  const displayName = provider.headline || 'Verified professional';
  const canonical = `${siteUrl}/professionals/${encodeURIComponent(providerId)}`;
  const structuredData = services.length || roles.length ? {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: displayName,
    description: provider.description || undefined,
    url: canonical,
    areaServed: provider.service_area || undefined,
    email: provider.public_contact_email || undefined,
    telephone: provider.public_contact_phone || undefined,
    knowsAbout: roles.length ? roles.map((role: any) => String(role.title)) : undefined,
    hasOfferCatalog: services.length ? {
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
    } : undefined,
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
        legal_name: provider.legal_name || '',
        principal_address: provider.principal_address || '',
        public_contact_email: provider.public_contact_email || '',
        public_contact_phone: provider.public_contact_phone || '',
        website_url: provider.website_url || null,
        grievance_officer_name: provider.grievance_officer_name || '',
        grievance_officer_designation: provider.grievance_officer_designation || '',
        grievance_email: provider.grievance_email || '',
        grievance_phone: provider.grievance_phone || '',
      }}
      roles={roles.map((role: any) => ({
        id: String(role.id),
        title: String(role.title || ''),
        summary: String(role.summary || ''),
        experience_years: role.experience_years === null || role.experience_years === undefined ? null : Number(role.experience_years),
        service_bookings_enabled: Boolean(role.service_bookings_enabled),
        freelance_enabled: Boolean(role.freelance_enabled),
        part_time_enabled: Boolean(role.part_time_enabled),
        full_time_enabled: Boolean(role.full_time_enabled),
        contract_enabled: Boolean(role.contract_enabled),
      }))}
      media={media}
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