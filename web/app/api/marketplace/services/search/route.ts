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

type PriceFilter = 'any' | 'under-1000' | '1000-5000' | 'over-5000';
type RatingFilter = 'any' | '4-plus' | '4.5-plus';
type ProviderFilter = 'any' | 'professional' | 'business';
type SortMode = 'relevance' | 'rating' | 'price' | 'price-desc';

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
  total_count: number | string | null;
};

type CategoryRow = { category_slug: string; category_name: string };

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

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseFilter<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T | null {
  if (!value) return fallback;
  return allowed.includes(value as T) ? value as T : null;
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

export async function GET(request: Request) {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 180);
  const queryTokens = semanticTokens(query);
  const semanticQuery = queryTokens.join(' ');
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

  const rows = (searchResult.data ?? []) as CandidateRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const total = pageRows.length ? Number(pageRows[0].total_count ?? 0) : 0;

  const services = pageRows.map((row) => {
    const categoryName = String(row.category || 'Other');
    const categoryId = canonicalCategorySlug(row.category_code, categoryName);
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    const workMode = ['available', 'busy', 'offline', 'paused'].includes(String(row.live_work_mode))
      ? row.live_work_mode
      : 'offline';
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
      distance_band: null,
      distance_priority: 0,
      nearby_match_mode: null,
      verified: true,
    };
  });

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