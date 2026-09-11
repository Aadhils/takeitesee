import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveMarketplaceServiceSearchSemantics } from '../../../../../server/marketplace-service-discovery/searchSemantics';
import {
  mapMarketplaceServiceDiscoveryServices,
  type MarketplaceServiceDiscoveryCandidateRow,
} from '../../../../../server/marketplace-service-discovery/responseMapping';
import {
  boundedMarketplaceServiceInteger,
  marketplaceServiceDefaultPageSize,
  marketplaceServiceMaxPageSize,
  marketplaceServiceNearbySortModes,
  marketplaceServicePriceFilters,
  marketplaceServiceProviderFilters,
  marketplaceServiceRatingFilters,
  parseMarketplaceServiceFilter,
} from '../../../../../server/marketplace-service-discovery/requestParsing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MarketplaceOrigin = { latitude: number; longitude: number };

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

function parseOrigin(value: unknown): MarketplaceOrigin {
  if (!value || typeof value !== 'object') throw new Error('Location is required.');
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude is invalid.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude is invalid.');
  return { latitude, longitude };
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
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
  const { tokens: queryTokens, semanticQuery } = resolveMarketplaceServiceSearchSemantics(query);
  const category = stringValue(body.category, 'all').trim().slice(0, 120) || 'all';
  const location = stringValue(body.location)
    .trim()
    .slice(0, 120)
    .replace(/[%_\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const price = parseMarketplaceServiceFilter(body.price, marketplaceServicePriceFilters, 'any');
  const rating = parseMarketplaceServiceFilter(body.rating, marketplaceServiceRatingFilters, 'any');
  const provider = parseMarketplaceServiceFilter(body.provider, marketplaceServiceProviderFilters, 'any');
  const sort = parseMarketplaceServiceFilter(body.sort, marketplaceServiceNearbySortModes, 'relevance');
  if (!price || !rating || !provider || !sort) {
    return NextResponse.json({ error: 'Nearby Service discovery filters are invalid.' }, { status: 400 });
  }

  const availableNow = body.available_now === true;
  const nearMe = body.near_me === true;
  const cursor = boundedMarketplaceServiceInteger(body.cursor, 0, 0, 1_000_000_000);
  const limit = boundedMarketplaceServiceInteger(
    body.limit,
    marketplaceServiceDefaultPageSize,
    1,
    marketplaceServiceMaxPageSize,
  );

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

  const rows = (searchResult.data ?? []) as MarketplaceServiceDiscoveryCandidateRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const total = pageRows.length ? Number(pageRows[0].total_count ?? 0) : 0;
  const services = mapMarketplaceServiceDiscoveryServices(pageRows, { nearby: true });
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
