import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { hasMarketplaceDisclosure } from '../../../../server/marketplace/public-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pageSize = 1000;
const maxServiceRows = 15000;
const maxAvailabilityRows = 15000;
const reviewServiceChunkSize = 200;
const maxReviewRowsPerChunk = 15000;
const geoServiceChunkSize = 2000;
const shopBusinessChunkSize = 1000;

type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
type BusinessShopState = 'open' | 'closed';
type NearbyMatchMode = 'at_provider' | 'at_customer';
type DistanceBand = 'under_1km' | '1_3km' | '3_7km' | '7_15km' | '15_30km' | '30_60km' | 'over_60km';
type MarketplaceOrigin = { latitude: number; longitude: number };
type GeoMatch = { distance_band: DistanceBand; distance_priority: number; match_mode: NearbyMatchMode };

function providerKey(providerType: unknown, professionalId: unknown, businessId: unknown) {
  if (providerType === 'professional' && professionalId) return `professional:${String(professionalId)}`;
  if (providerType === 'business' && businessId) return `business:${String(businessId)}`;
  return '';
}

function effectiveWorkMode(row: any): ProviderWorkMode {
  const workMode = ['available', 'busy', 'offline', 'paused'].includes(row?.work_mode)
    ? row.work_mode as ProviderWorkMode
    : 'offline';

  if (workMode === 'available' || workMode === 'busy') {
    if (!row?.mode_expires_at) return 'offline';
    const expiry = new Date(row.mode_expires_at).getTime();
    if (Number.isNaN(expiry) || expiry <= Date.now()) return 'offline';
  }

  return workMode;
}

function availabilityLabel(workMode: ProviderWorkMode) {
  if (workMode === 'available') return 'Available now';
  if (workMode === 'busy') return 'Busy now';
  if (workMode === 'paused') return 'Paused';
  return 'Offline';
}

function parseOrigin(value: unknown): MarketplaceOrigin {
  if (!value || typeof value !== 'object') throw new Error('Location is required.');
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude is invalid.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude is invalid.');
  return { latitude, longitude };
}

function summarizeDistance(distanceMeters: number): Pick<GeoMatch, 'distance_band' | 'distance_priority'> {
  if (distanceMeters <= 1000) return { distance_band: 'under_1km', distance_priority: 24 };
  if (distanceMeters <= 3000) return { distance_band: '1_3km', distance_priority: 20 };
  if (distanceMeters <= 7000) return { distance_band: '3_7km', distance_priority: 16 };
  if (distanceMeters <= 15000) return { distance_band: '7_15km', distance_priority: 12 };
  if (distanceMeters <= 30000) return { distance_band: '15_30km', distance_priority: 8 };
  if (distanceMeters <= 60000) return { distance_band: '30_60km', distance_priority: 4 };
  return { distance_band: 'over_60km', distance_priority: 1 };
}

async function loadGeoMatches(serviceIds: string[], origin: MarketplaceOrigin) {
  const matches = new Map<string, GeoMatch>();
  if (!serviceIds.length) return { matches, status: 'ready' as const };

  try {
    const serviceRole = createSupabaseServiceClient();
    for (let start = 0; start < serviceIds.length; start += geoServiceChunkSize) {
      const chunk = serviceIds.slice(start, start + geoServiceChunkSize);
      const { data, error } = await serviceRole.rpc('get_marketplace_geo_distances', {
        target_service_ids: chunk,
        origin_lat: origin.latitude,
        origin_long: origin.longitude,
      });
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const distance = Number(row.distance_meters);
        const mode = row.match_mode as NearbyMatchMode;
        if (row.service_id && Number.isFinite(distance) && distance >= 0 && ['at_provider', 'at_customer'].includes(mode)) {
          matches.set(String(row.service_id), {
            ...summarizeDistance(distance),
            match_mode: mode,
          });
        }
      }
    }
    return { matches, status: 'ready' as const };
  } catch {
    // Nearby enrichment is optional. Public catalog eligibility continues to come
    // only from the anon/RLS path below, so a geo failure never broadens access.
    return { matches, status: 'unavailable' as const };
  }
}

async function loadBusinessShopStates(businessIds: string[]) {
  const states = new Map<string, BusinessShopState>();
  const uniqueBusinessIds = Array.from(new Set(businessIds.filter(Boolean)));
  if (!uniqueBusinessIds.length) return states;

  try {
    const serviceRole = createSupabaseServiceClient();
    for (let start = 0; start < uniqueBusinessIds.length; start += shopBusinessChunkSize) {
      const chunk = uniqueBusinessIds.slice(start, start + shopBusinessChunkSize);
      const { data, error } = await serviceRole
        .from('business_shop_status')
        .select('business_id,shop_state')
        .in('business_id', chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (row.business_id && row.shop_state === 'open') states.set(String(row.business_id), 'open');
        else if (row.business_id && row.shop_state === 'closed') states.set(String(row.business_id), 'closed');
      }
    }
  } catch {
    // Shop-status enrichment never decides public eligibility. Missing or failed
    // enrichment is interpreted fail-safe as Closed when response rows are built.
    return new Map<string, BusinessShopState>();
  }

  return states;
}

async function buildMarketplaceResponse(origin: MarketplaceOrigin | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Marketplace database is not configured' }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows: any[] = [];

  for (let start = 0; start < maxServiceRows; start += pageSize) {
    const { data, error } = await supabase
      .from('services')
      .select('id,provider_type,professional_id,business_id,name,description,location,duration_minutes,base_price,currency,category,status,active,updated_at,professional_profiles(headline,service_area,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(name,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
      .eq('active', true)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(start, Math.min(start + pageSize - 1, maxServiceRows - 1));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const publicRows = rows.filter((row: any) => {
    const provider = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    return provider?.verified === true && hasMarketplaceDisclosure(provider) && Boolean(providerId);
  });

  const businessShopStates = await loadBusinessShopStates(
    publicRows
      .filter((row: any) => row.provider_type === 'business' && row.business_id)
      .map((row: any) => String(row.business_id)),
  );

  const liveRows: any[] = [];
  for (let start = 0; start < maxAvailabilityRows; start += pageSize) {
    const { data, error } = await supabase
      .from('provider_live_availability')
      .select('provider_type,professional_id,business_id,work_mode,mode_expires_at')
      .order('provider_type', { ascending: true })
      .order('professional_id', { ascending: true })
      .order('business_id', { ascending: true })
      .range(start, Math.min(start + pageSize - 1, maxAvailabilityRows - 1));

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    liveRows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const liveModes = new Map<string, ProviderWorkMode>();
  for (const liveRow of liveRows) {
    const keyValue = providerKey(liveRow.provider_type, liveRow.professional_id, liveRow.business_id);
    if (keyValue) liveModes.set(keyValue, effectiveWorkMode(liveRow));
  }

  const ids = publicRows.map((row: any) => String(row.id));
  const reviewRows: any[] = [];

  for (let chunkStart = 0; chunkStart < ids.length; chunkStart += reviewServiceChunkSize) {
    const serviceIds = ids.slice(chunkStart, chunkStart + reviewServiceChunkSize);
    for (let start = 0; start < maxReviewRowsPerChunk; start += pageSize) {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,service_id,rating,status')
        .in('service_id', serviceIds)
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(start, Math.min(start + pageSize - 1, maxReviewRowsPerChunk - 1));

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      reviewRows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
  }

  const reviews = new Map<string, number[]>();
  for (const review of reviewRows) reviews.set(review.service_id, [...(reviews.get(review.service_id) ?? []), Number(review.rating)]);

  const geo = origin
    ? await loadGeoMatches(ids, origin)
    : { matches: new Map<string, GeoMatch>(), status: 'not_requested' as const };

  const services = publicRows.map((row: any) => {
    const provider = row.provider_type === 'business' ? row.businesses : row.professional_profiles;
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    const ratings = reviews.get(row.id) ?? [];
    const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const category = row.category || 'Other';
    const liveWorkMode = liveModes.get(providerKey(row.provider_type, row.professional_id, row.business_id)) ?? 'offline';
    const geoMatch = geo.matches.get(String(row.id));
    return {
      id: row.id,
      service_name: { en: row.name },
      description: { en: row.description || '' },
      provider_name: row.provider_type === 'business' ? (provider?.name || 'Business provider') : (provider?.headline || 'Professional provider'),
      provider_type: row.provider_type,
      provider_id: providerId,
      location: row.location || provider?.location || provider?.service_area || '',
      service_area: provider?.service_area || provider?.location || row.location || '',
      category_id: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category_slug: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      pricing: { base_price: { amount: Math.round(Number(row.base_price || 0) * 100), currency: row.currency || 'INR' } },
      duration_minutes: row.duration_minutes,
      rating,
      review_count: ratings.length,
      live_work_mode: liveWorkMode,
      availability: availabilityLabel(liveWorkMode),
      business_shop_state: row.provider_type === 'business'
        ? (businessShopStates.get(String(providerId)) ?? 'closed')
        : null,
      distance_band: geoMatch?.distance_band ?? null,
      distance_priority: geoMatch?.distance_priority ?? 0,
      nearby_match_mode: geoMatch?.match_mode ?? null,
      verified: true,
    };
  });

  return NextResponse.json(
    { services, geo_status: geo.status },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  return buildMarketplaceResponse(null);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { origin?: unknown };
    const origin = parseOrigin(body.origin);
    return buildMarketplaceResponse(origin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Customer location is invalid.' },
      { status: 400 },
    );
  }
}
