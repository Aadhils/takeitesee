import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import PublicProviderProfile from './PublicProviderProfile';
import ProviderProfileShareAction from './ProviderProfileShareAction';
import BusinessStorefrontQuickBook from './BusinessStorefrontQuickBook';
import BusinessStorefrontProducts from './BusinessStorefrontProducts';
import { createSupabaseServiceClient } from '../../lib/supabase/service';
import { loadProductImagePresence } from '../../server/marketplace/public-product-media';

export const publicSiteUrl = 'https://www.takeitesee.com';

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type ServiceFulfillmentMode = 'at_provider' | 'at_customer' | 'remote';
type BookingAvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

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

type PublicBusinessProduct = {
  id: string;
  business_id: string;
  name: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  unit_label: string | null;
  stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
  has_primary_image: boolean;
};

export type PublicBusinessRecord = {
  business: PublicBusiness;
  services: PublicBusinessService[];
  products: PublicBusinessProduct[];
};

type StorefrontOperations = {
  live_work_mode: ProviderWorkMode;
  service_modes: Map<string, ServiceFulfillmentMode[]>;
  availability_modes: Map<string, BookingAvailabilityMode>;
};

const providerWorkModes: ProviderWorkMode[] = ['available', 'busy', 'offline', 'paused'];
const serviceFulfillmentModes: ServiceFulfillmentMode[] = ['at_provider', 'at_customer', 'remote'];
const bookingAvailabilityModes: BookingAvailabilityMode[] = ['always_available', 'on_request', 'scheduled'];

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

function effectiveLiveWorkMode(row: { work_mode?: unknown; mode_expires_at?: unknown } | null | undefined): ProviderWorkMode {
  const mode = providerWorkModes.includes(row?.work_mode as ProviderWorkMode)
    ? row?.work_mode as ProviderWorkMode
    : 'offline';
  if (mode !== 'available' && mode !== 'busy') return mode;
  if (typeof row?.mode_expires_at !== 'string' || !row.mode_expires_at) return 'offline';
  const expiry = new Date(row.mode_expires_at).getTime();
  return Number.isFinite(expiry) && expiry > Date.now() ? mode : 'offline';
}

async function loadStorefrontOperations(providerId: string, serviceIds: string[]): Promise<StorefrontOperations> {
  const fallback: StorefrontOperations = {
    live_work_mode: 'offline',
    service_modes: new Map(),
    availability_modes: new Map(),
  };
  if (!serviceIds.length) return fallback;

  const publicClient = publicSupabase();
  const livePromise = publicClient
    ? publicClient
        .from('provider_live_availability')
        .select('work_mode,mode_expires_at')
        .eq('provider_type', 'business')
        .eq('business_id', providerId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  try {
    const serviceRole = createSupabaseServiceClient();
    const [{ data: liveRow }, { data: fulfillmentRows, error: fulfillmentError }, { data: availabilityRows, error: availabilityError }] = await Promise.all([
      livePromise,
      serviceRole
        .from('service_fulfillment_modes')
        .select('service_id,mode')
        .in('service_id', serviceIds)
        .eq('active', true),
      serviceRole
        .from('service_availability')
        .select('service_id,mode')
        .in('service_id', serviceIds),
    ]);

    const serviceModes = new Map<string, ServiceFulfillmentMode[]>();
    if (!fulfillmentError) {
      for (const row of fulfillmentRows ?? []) {
        const serviceId = String(row.service_id || '');
        const mode = row.mode as ServiceFulfillmentMode;
        if (!serviceId || !serviceFulfillmentModes.includes(mode)) continue;
        const current = serviceModes.get(serviceId) ?? [];
        if (!current.includes(mode)) serviceModes.set(serviceId, [...current, mode]);
      }
    }

    const availabilityModes = new Map<string, BookingAvailabilityMode>();
    if (!availabilityError) {
      for (const row of availabilityRows ?? []) {
        const serviceId = String(row.service_id || '');
        const mode = row.mode as BookingAvailabilityMode;
        if (serviceId && bookingAvailabilityModes.includes(mode)) availabilityModes.set(serviceId, mode);
      }
    }

    return {
      live_work_mode: effectiveLiveWorkMode(liveRow),
      service_modes: serviceModes,
      availability_modes: availabilityModes,
    };
  } catch {
    const { data: liveRow } = await livePromise;
    return { ...fallback, live_work_mode: effectiveLiveWorkMode(liveRow) };
  }
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

  const [{ data: services, error: servicesError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from('services')
      .select('id,name,description,base_price,currency,duration_minutes,location')
      .eq('business_id', providerId)
      .eq('provider_type', 'business')
      .eq('status', 'active')
      .eq('active', true)
      .order('name'),
    supabase
      .from('business_products')
      .select('id,business_id,name,description,price,currency,unit_label,stock_mode')
      .eq('business_id', providerId)
      .order('name'),
  ]);

  const publicProducts = productsError ? [] : (products ?? []) as Omit<PublicBusinessProduct, 'has_primary_image'>[];
  const imagePresence = await loadProductImagePresence(publicProducts.map((product) => String(product.id)));

  return {
    business: business as PublicBusiness,
    services: servicesError ? [] : (services ?? []) as PublicBusinessService[],
    products: publicProducts.map((product) => ({
      ...product,
      has_primary_image: imagePresence.has(String(product.id)),
    })),
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

  const { business, services, products } = record;
  const operations = await loadStorefrontOperations(providerId, services.map((service) => String(service.id)));
  const serviceOffers = services.map((service) => ({
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: service.name || undefined,
      url: `${publicSiteUrl}/services/${encodeURIComponent(service.id)}`,
    },
  }));
  const productOffers = products.map((product) => ({
    '@type': 'Offer',
    price: product.price ?? undefined,
    priceCurrency: product.currency || undefined,
    url: `${publicSiteUrl}/products/${encodeURIComponent(product.id)}`,
    itemOffered: {
      '@type': 'Product',
      name: product.name || undefined,
      description: product.description || undefined,
      url: `${publicSiteUrl}/products/${encodeURIComponent(product.id)}`,
    },
  }));
  const offerItems = [...serviceOffers, ...productOffers].slice(0, 20);
  const structuredData = offerItems.length ? {
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
      name: services.length > 0 && products.length > 0
        ? 'Services and products'
        : products.length > 0
          ? 'Products'
          : 'Active services',
      itemListElement: offerItems,
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
    live_work_mode: operations.live_work_mode,
    fulfillment_modes: operations.service_modes.get(String(service.id)) ?? [],
    availability_mode: operations.availability_modes.get(String(service.id)) ?? 'on_request',
  }));

  const storefrontProducts = products.map((product) => ({
    id: String(product.id),
    name: String(product.name || ''),
    description: String(product.description || ''),
    price: product.price ?? 0,
    currency: product.currency || 'INR',
    unit_label: product.unit_label || 'item',
    stock_mode: product.stock_mode,
    has_primary_image: product.has_primary_image,
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
    <BusinessStorefrontProducts products={storefrontProducts} />
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
