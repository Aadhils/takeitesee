import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderProfile from './PublicProviderProfile';
import ProviderProfileShareAction from './ProviderProfileShareAction';
import BusinessStorefrontQuickBook from './BusinessStorefrontQuickBook';

export const publicSiteUrl = 'https://www.takeitesee.com';

type PublicBusiness = {
  id: string;
  name: string | null;
  description: string | null;
  location: string | null;
  verified: boolean;
  legal_name: string | null;
  principal_address: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  website_url: string | null;
  grievance_officer_name: string | null;
  grievance_officer_designation: string | null;
  grievance_email: string | null;
  grievance_phone: string | null;
};

type PublicBusinessService = {
  id: string;
  name: string | null;
  description: string | null;
  base_price: number | string | null;
  currency: string | null;
  duration_minutes: number | null;
  location: string | null;
};

export type PublicBusinessRecord = {
  business: PublicBusiness;
  services: PublicBusinessService[];
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hasMarketplaceDisclosure(provider: PublicBusiness) {
  return Boolean(
    provider.legal_name?.trim() && provider.principal_address?.trim() && provider.public_contact_email?.trim() && provider.public_contact_phone?.trim()
    && provider.grievance_officer_name?.trim() && provider.grievance_officer_designation?.trim() && provider.grievance_email?.trim() && provider.grievance_phone?.trim(),
  );
}

export function publicBusinessSeoText(value: string | null | undefined, fallback: string, max = 160) {
  const text = (value || fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export const loadPublicBusiness = cache(async (providerId: string): Promise<PublicBusinessRecord | null> => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id,name,description,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
    .eq('id', providerId)
    .eq('verified', true)
    .maybeSingle();

  if (error || !business || !hasMarketplaceDisclosure(business as PublicBusiness)) return null;

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id,name,description,base_price,currency,duration_minutes,location')
    .eq('business_id', providerId)
    .eq('provider_type', 'business')
    .eq('status', 'active')
    .eq('active', true)
    .order('name');

  return {
    business: business as PublicBusiness,
    services: servicesError ? [] : (services ?? []) as PublicBusinessService[],
  };
});

export default async function BusinessPublicProfileContent({
  providerId,
  canonicalUrl,
}: {
  providerId: string;
  canonicalUrl: string;
}) {
  const record = await loadPublicBusiness(providerId);
  if (!record) return null;

  const { business, services } = record;
  const structuredData = services.length ? {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name || undefined,
    description: business.description || undefined,
    url: canonicalUrl,
    areaServed: business.location || undefined,
    email: business.public_contact_email || undefined,
    telephone: business.public_contact_phone || undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Active services',
      itemListElement: services.slice(0, 20).map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.name || undefined,
          url: `${publicSiteUrl}/services/${encodeURIComponent(service.id)}`,
        },
      })),
    },
  } : null;

  const storefrontServices = services.map((service) => ({
    id: String(service.id),
    name: String(service.name || ''),
    description: String(service.description || ''),
    base_price: service.base_price,
    currency: service.currency || 'INR',
    duration_minutes: service.duration_minutes ? Number(service.duration_minutes) : null,
    location: service.location ? String(service.location) : null,
  }));

  return <>
    {structuredData ? <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    /> : null}
    <div className="container" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
      <ProviderProfileShareAction providerId={providerId} providerName={business.name || ''} kind="business" />
    </div>
    <BusinessStorefrontQuickBook
      businessName={business.name || 'Verified business'}
      businessLocation={business.location || ''}
      services={storefrontServices}
    />
    <PublicProviderProfile
      kind="business"
      provider={{
        name: business.name || '',
        description: business.description || '',
        location: business.location || '',
        legal_name: business.legal_name || '',
        principal_address: business.principal_address || '',
        public_contact_email: business.public_contact_email || '',
        public_contact_phone: business.public_contact_phone || '',
        website_url: business.website_url || null,
        grievance_officer_name: business.grievance_officer_name || '',
        grievance_officer_designation: business.grievance_officer_designation || '',
        grievance_email: business.grievance_email || '',
        grievance_phone: business.grievance_phone || '',
      }}
      services={storefrontServices.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        base_price: service.base_price,
        currency: service.currency,
        duration_minutes: service.duration_minutes,
      }))}
    />
  </>;
}
