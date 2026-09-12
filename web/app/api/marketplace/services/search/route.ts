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
  marketplaceServiceNormalSortModes,
  marketplaceServicePriceFilters,
  marketplaceServiceProviderFilters,
  marketplaceServiceRatingFilters,
  normalizeMarketplaceServiceCategory,
  normalizeMarketplaceServiceLocation,
  normalizeMarketplaceServiceQuery,
  parseMarketplaceServiceFilter,
  resolveMarketplaceServicePage,
} from '../../../../../server/marketplace-service-discovery/requestParsing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CategoryRow = { category_slug: string; category_name: string };

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const url = new URL(request.url);
  const query = normalizeMarketplaceServiceQuery(url.searchParams.get('q'));
  const { tokens: queryTokens, semanticQuery } = resolveMarketplaceServiceSearchSemantics(query);
  const location = normalizeMarketplaceServiceLocation(url.searchParams.get('location'));
  const category = normalizeMarketplaceServiceCategory(url.searchParams.get('category'));
  const price = parseMarketplaceServiceFilter(url.searchParams.get('price'), marketplaceServicePriceFilters, 'any');
  const rating = parseMarketplaceServiceFilter(url.searchParams.get('rating'), marketplaceServiceRatingFilters, 'any');
  const provider = parseMarketplaceServiceFilter(url.searchParams.get('provider'), marketplaceServiceProviderFilters, 'any');
  const sort = parseMarketplaceServiceFilter(url.searchParams.get('sort'), marketplaceServiceNormalSortModes, 'relevance');
  const availableNow = url.searchParams.get('availability') === 'now';
  if (!price || !rating || !provider || !sort) {
    return NextResponse.json({ error: 'Service discovery filters are invalid.' }, { status: 400 });
  }

  const cursor = boundedMarketplaceServiceInteger(url.searchParams.get('cursor'), 0, 0, 1_000_000_000);
  const limit = boundedMarketplaceServiceInteger(
    url.searchParams.get('limit'),
    marketplaceServiceDefaultPageSize,
    1,
    marketplaceServiceMaxPageSize,
  );

  const [searchResult, categoryResult] = await Promise.all([
    supabase.rpc('search_marketplace_service_discovery_candidates_v2', {
      target_query: semanticQuery || null,
      target_tokens: queryTokens,
      target_category: category,
      target_location: location || null,
      target_price: price,
      target_rating: rating,
      target_provider: provider,
      target_available_now: availableNow,
      target_sort: sort,
      target_offset: cursor,
      target_limit: limit + 1,
    }),
    supabase.rpc('get_marketplace_service_discovery_categories_v2'),
  ]);

  if (searchResult.error) return NextResponse.json({ error: searchResult.error.message }, { status: 500 });
  if (categoryResult.error) return NextResponse.json({ error: categoryResult.error.message }, { status: 500 });

  const rows = (searchResult.data ?? []) as MarketplaceServiceDiscoveryCandidateRow[];
  const { pageRows, total, page } = resolveMarketplaceServicePage(rows, cursor, limit);
  const services = mapMarketplaceServiceDiscoveryServices(pageRows, { nearby: false });

  const categories = ((categoryResult.data ?? []) as CategoryRow[]).map((row) => ({
    slug: String(row.category_slug || 'other'),
    name: String(row.category_name || 'Other'),
  }));

  return NextResponse.json(
    {
      services,
      categories,
      total,
      geo_status: 'not_requested',
      page,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
