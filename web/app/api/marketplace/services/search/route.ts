import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveMarketplaceServiceSearchSemantics } from '../../../../../server/marketplace-service-discovery/searchSemantics';
import {
  mapMarketplaceServiceDiscoveryServices,
  type MarketplaceServiceDiscoveryCandidateRow,
} from '../../../../../server/marketplace-service-discovery/responseMapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const defaultPageSize = 24;
const maxPageSize = 48;

type PriceFilter = 'any' | 'under-1000' | '1000-5000' | 'over-5000';
type RatingFilter = 'any' | '4-plus' | '4.5-plus';
type ProviderFilter = 'any' | 'professional' | 'business';
type SortMode = 'relevance' | 'rating' | 'price' | 'price-desc';

type CategoryRow = { category_slug: string; category_name: string };

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseFilter<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T | null {
  if (!value) return fallback;
  return allowed.includes(value as T) ? value as T : null;
}

export async function GET(request: Request) {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 180);
  const { tokens: queryTokens, semanticQuery } = resolveMarketplaceServiceSearchSemantics(query);
  const location = (url.searchParams.get('location') ?? '')
    .trim()
    .slice(0, 120)
    .replace(/[%_\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const category = (url.searchParams.get('category') ?? 'all').trim().slice(0, 120) || 'all';
  const price = parseFilter<PriceFilter>(url.searchParams.get('price'), ['any', 'under-1000', '1000-5000', 'over-5000'], 'any');
  const rating = parseFilter<RatingFilter>(url.searchParams.get('rating'), ['any', '4-plus', '4.5-plus'], 'any');
  const provider = parseFilter<ProviderFilter>(url.searchParams.get('provider'), ['any', 'professional', 'business'], 'any');
  const sort = parseFilter<SortMode>(url.searchParams.get('sort'), ['relevance', 'rating', 'price', 'price-desc'], 'relevance');
  const availableNow = url.searchParams.get('availability') === 'now';
  if (!price || !rating || !provider || !sort) {
    return NextResponse.json({ error: 'Service discovery filters are invalid.' }, { status: 400 });
  }

  const cursor = boundedInteger(url.searchParams.get('cursor'), 0, 0, 1_000_000_000);
  const limit = boundedInteger(url.searchParams.get('limit'), defaultPageSize, 1, maxPageSize);

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
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const total = pageRows.length ? Number(pageRows[0].total_count ?? 0) : 0;
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
      page: {
        limit,
        next_cursor: hasMore ? String(cursor + limit) : null,
        has_more: hasMore,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
