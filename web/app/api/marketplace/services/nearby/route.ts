import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const defaultPageSize = 24;
const maxPageSize = 48;
const searchIntentTokens = new Set([
  'near', 'nearby', 'nearest', 'closest', 'around', 'me', 'my',
  'available', 'now', 'service', 'services', 'provider', 'providers',
  'அருகில்', 'அருகிலுள்ள', 'அருகாமை', 'எனக்கு', 'இப்போது', 'சேவை', 'சேவைகள்',
  'கிடைக்கும்', 'கிடைக்கிறார்', 'கிடைக்கிறது',
]);
const distanceBands = new Set(['under_1km', '1_3km', '3_7km', '7_15km', '15_30km', '30_60km', 'over_60km']);
const nearbyMatchModes = new Set(['at_provider', 'at_customer']);

type PriceFilter = 'any' | 'under-1000' | '1000-5000' | 'over-5000';
type RatingFilter = 'any' | '4-plus' | '4.5-plus';
type ProviderFilter = 'any' | 'professional' | 'business';
type SortMode = 'relevance' | 'nearest' | 'rating' | 'price' | 'price-desc';
type MarketplaceOrigin = { latitude: number; longitude: number };

type CandidateRow = {
  id: string;
  provider_type: 'professional' | 'business';
  professional_id: string | null;
  business_id: string | null;
  service_name: string;
  description: string | null;
  service_location: string | null;
  duration_minutes: number | null;
  base_price: number | string | null;
  currency: string | null;
  category: string | null;
  provider_name: string | null;
  service_area: string | null;
  category_code: string | null;
  category_group: string | null;
  category_aliases: string[] | null;
  rating: number | string | null;
  review_count: number | string | null;
  live_work_mode: 'available' | 'busy' | 'offline' | 'paused' | null;
  business_shop_state: 'open' | 'closed' | null;
  distance_band?: string | null;
  distance_priority?: number | string | null;
  nearby_match_mode?: string | null;
  total_count: number | string | null;
};

type CategoryRow = { category_slug: string; category_name: string };
type NearbyRequestBody = {
  origin?: unknown;
  q?: unknown;
  category?: unknown;
  location?: unknown;
  price?: unknown;
  rating?: unknown;
  provider?: unknown;
  available_now?: unknown;
  sort?: unknown;
  near_me?: unknown;
  cursor?: unknown;
  limit?: unknown;
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function semanticTokens(query: string) {
  return normalized(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !searchIntentTokens.has(token));
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

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' ? Math.trunc(value) : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function parseFilter<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | null {
  if (value == null || value === '') return fallback;
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : null;
}

function categorySlug(category: string) {
  return category.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
}

function canonicalCategorySlug(code: unknown, fallbackName: string) {
  const value = String(code ?? '').trim().toLocaleLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return value || categorySlug(fallbackName);
}

function availabilityLabel(mode: CandidateRow['live_work_mode']) {
  if (mode === 'available') return 'Available now';
  if (mode === 'busy') return 'Busy now';
  if (mode === 'paused') return 'Paused';
  return 'Offline';
}

function mapServices(rows: CandidateRow[]) {
  return rows.map((row) => {
    const categoryName = String(row.category || 'Other');
    const categoryId = canonicalCategorySlug(row.category_code, categoryName);
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    const workMode = ['available', 'busy', 'offline', 'paused'].includes(String(row.live_work_mode))
      ? row.live_work_mode
      : 'offline';
    const rawDistancePriority = Number(row.distance_priority ?? 0);
    const distancePriority = Number.isFinite(rawDistancePriority)
      ? Math.min(Math.max(Math.trunc(rawDistancePriority), 0), 24)
      : 0;
    const distanceBand = distanceBands.has(String(row.distance_band ?? '')) ? String(row.distance_band) : null;
    const nearbyMatchMode = nearbyMatchModes.has(String(row.nearby_match_mode ?? '')) ? String(row.nearby_match_mode) : null;

    return {
      id: row.id,
      service_name: { en: String(row.service_name || '') },
      description: { en: String(row.description || '') },
      provider_name: String(row.provider_name || (row.provider_type === 'business' ? 'Business provider' : 'Professional provider')),
      provider_type: row.provider_type,
      provider_id: providerId,
      location: String(row.service_location || row.service_area || ''),
      service_area: String(row.service_area || row.service_location || ''),
      category_id: categoryId,
      category_slug: categoryId,
      category_code: row.category_code || null,
      category_group: String(row.category_group || ''),
      category_aliases: Array.isArray(row.category_aliases) ? row.category_aliases : [],
      pricing: { base_price: { amount: Math.round(Number(row.base_price || 0) * 100), currency: String(row.currency || 'INR') } },
      duration_minutes: Number(row.duration_minutes || 0),
      rating: Number(row.rating || 0),
      review_count: Number(row.review_count || 0),
      live_work_mode: workMode,
      availability: availabilityLabel(workMode),
      business_shop_state: row.provider_type === 'business' ? (row.business_shop_state === 'open' ? 'open' : 'closed') : null,
      distance_band: distanceBand,
      distance_priority: distancePriority,
      nearby_match_mode: nearbyMatchMode,
      verified: true,
    };
  });
}

export async function POST(request: Request) {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  let body: NearbyRequestBody;
  try {
    body = await request.json() as NearbyRequestBody;
  } catch {
    return NextResponse.json({ error: 'Nearby search request is invalid.' }, { status: 400 });
  }

  let origin: MarketplaceOrigin;
  try {
    origin = parseOrigin(body.origin);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Customer location is invalid.' }, { status: 400 });
  }

  const query = stringValue(body.q).trim().slice(0, 180);
  const queryTokens = semanticTokens(query);
  const semanticQuery = queryTokens.join(' ');
  const category = stringValue(body.category, 'all').trim().slice(0, 120) || 'all';
  const location = stringValue(body.location)
    .trim()
    .slice(0, 120)
    .replace(/[%_\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const price = parseFilter<PriceFilter>(body.price, ['any', 'under-1000', '1000-5000', 'over-5000'], 'any');
  const rating = parseFilter<RatingFilter>(body.rating, ['any', '4-plus', '4.5-plus'], 'any');
  const provider = parseFilter<ProviderFilter>(body.provider, ['any', 'professional', 'business'], 'any');
  const sort = parseFilter<SortMode>(body.sort, ['relevance', 'nearest', 'rating', 'price', 'price-desc'], 'relevance');
  if (!price || !rating || !provider || !sort) {
    return NextResponse.json({ error: 'Nearby Service discovery filters are invalid.' }, { status: 400 });
  }

  const availableNow = body.available_now === true;
  const nearMe = body.near_me === true;
  const cursor = boundedInteger(body.cursor, 0, 0, 1_000_000_000);
  const limit = boundedInteger(body.limit, defaultPageSize, 1, maxPageSize);

  const nearbyArgs = {
    origin_lat: origin.latitude,
    origin_long: origin.longitude,
    target_query: semanticQuery || null,
    target_tokens: queryTokens,
    target_category: category,
    target_location: location || null,
    target_price: price,
    target_rating: rating,
    target_provider: provider,
    target_available_now: availableNow,
    target_sort: sort,
    target_near_me: nearMe,
    target_offset: cursor,
    target_limit: limit + 1,
  };

  const categoryPromise = supabase.rpc('get_marketplace_service_discovery_categories_v2');
  let geoStatus: 'ready' | 'unavailable' = 'ready';
  let searchResult = await supabase.rpc('search_marketplace_service_nearby_candidates_v2', nearbyArgs);

  if (searchResult.error) {
    geoStatus = 'unavailable';
    searchResult = await supabase.rpc('search_marketplace_service_discovery_candidates_v2', {
      target_query: semanticQuery || null,
      target_tokens: queryTokens,
      target_category: category,
      target_location: location || null,
      target_price: price,
      target_rating: rating,
      target_provider: provider,
      target_available_now: availableNow,
      target_sort: sort === 'nearest' ? 'relevance' : sort,
      target_offset: cursor,
      target_limit: limit + 1,
    });
  }

  const categoryResult = await categoryPromise;
  if (searchResult.error) return NextResponse.json({ error: searchResult.error.message }, { status: 500 });
  if (categoryResult.error) return NextResponse.json({ error: categoryResult.error.message }, { status: 500 });

  const rows = (searchResult.data ?? []) as CandidateRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const total = pageRows.length ? Number(pageRows[0].total_count ?? 0) : 0;
  const services = mapServices(pageRows);
  const categories = ((categoryResult.data ?? []) as CategoryRow[]).map((row) => ({
    slug: String(row.category_slug || 'other'),
    name: String(row.category_name || 'Other'),
  }));

  return NextResponse.json(
    {
      services,
      categories,
      total,
      geo_status: geoStatus,
      page: {
        limit,
        next_cursor: hasMore ? String(cursor + limit) : null,
        has_more: hasMore,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
