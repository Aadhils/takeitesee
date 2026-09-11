import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { hasMarketplaceDisclosure } from '../../../../server/marketplace/public-directory';
import { loadProductImagePresence } from '../../../../server/marketplace/public-product-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const defaultPageSize = 24;
const maxPageSize = 48;
const candidateBatchSize = 96;
const maxCandidateScanBatches = 8;
const businessChunkSize = 200;

type BusinessShopState = 'open' | 'closed';
type StockFilter = 'any' | 'orderable' | 'in_stock' | 'made_to_order';
type ShopFilter = 'any' | 'open';
type SortMode = 'relevance' | 'price' | 'price-desc' | 'name';

type PublicBusiness = {
  id: string;
  name: string | null;
  location: string | null;
  verified: boolean;
  legal_name: string | null;
  principal_address: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  grievance_officer_name: string | null;
  grievance_officer_designation: string | null;
  grievance_email: string | null;
  grievance_phone: string | null;
};

type PublicProductRow = {
  id: string;
  business_id: string;
  name: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  unit_label: string | null;
  stock_mode: string | null;
};

type CandidateRow = {
  id: string;
  business_id: string;
  business_shop_state: BusinessShopState | null;
};

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

async function loadPublicBusinesses(supabase: SupabaseClient, businessIds: string[]) {
  const businesses = new Map<string, PublicBusiness>();
  const uniqueIds = Array.from(new Set(businessIds.filter(Boolean)));

  for (let start = 0; start < uniqueIds.length; start += businessChunkSize) {
    const chunk = uniqueIds.slice(start, start + businessChunkSize);
    const { data, error } = await supabase
      .from('businesses')
      .select('id,name,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
      .in('id', chunk)
      .eq('verified', true);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const business = row as PublicBusiness;
      if (business.id && business.verified === true && hasMarketplaceDisclosure(business)) {
        businesses.set(String(business.id), business);
      }
    }
  }

  return businesses;
}

export async function GET(request: Request) {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 180);
  const stock = parseFilter<StockFilter>(url.searchParams.get('stock'), ['any', 'orderable', 'in_stock', 'made_to_order'], 'any');
  const shop = parseFilter<ShopFilter>(url.searchParams.get('shop'), ['any', 'open'], 'any');
  const sort = parseFilter<SortMode>(url.searchParams.get('sort'), ['relevance', 'price', 'price-desc', 'name'], 'relevance');
  if (!stock || !shop || !sort) {
    return NextResponse.json({ error: 'Product discovery filters are invalid.' }, { status: 400 });
  }

  const cursor = boundedInteger(url.searchParams.get('cursor'), 0, 0, 1_000_000_000);
  const limit = boundedInteger(url.searchParams.get('limit'), defaultPageSize, 1, maxPageSize);
  const serviceRole = createSupabaseServiceClient();
  const products: Array<{
    id: string;
    business_id: string;
    business_name: string;
    business_location: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    unit_label: string;
    stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
    business_shop_state: BusinessShopState;
    has_primary_image: boolean;
    verified_business: true;
  }> = [];

  let scanOffset = cursor;
  let nextCursor: number | null = null;
  let hasMore = false;
  let exhausted = false;

  for (let batch = 0; batch < maxCandidateScanBatches && products.length < limit; batch += 1) {
    const batchStart = scanOffset;
    const { data: candidateData, error: candidateError } = await serviceRole.rpc(
      'search_business_product_discovery_candidates',
      {
        target_query: query || null,
        target_stock: stock,
        target_shop: shop,
        target_sort: sort,
        target_offset: batchStart,
        target_limit: candidateBatchSize,
      },
    );
    if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });

    const candidates = (candidateData ?? []) as CandidateRow[];
    if (!candidates.length) {
      exhausted = true;
      break;
    }
    scanOffset = batchStart + candidates.length;

    const candidateIds = candidates.map((row) => String(row.id || '')).filter(Boolean);
    const { data: publicData, error: publicError } = await supabase
      .from('business_products')
      .select('id,business_id,name,description,price,currency,unit_label,stock_mode')
      .in('id', candidateIds);
    if (publicError) return NextResponse.json({ error: publicError.message }, { status: 500 });

    const publicRows = new Map(
      ((publicData ?? []) as PublicProductRow[]).map((row) => [String(row.id), row]),
    );
    const businesses = await loadPublicBusinesses(
      supabase,
      Array.from(publicRows.values()).map((row) => String(row.business_id || '')).filter(Boolean),
    );

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const productId = String(candidate.id || '');
      const row = publicRows.get(productId);
      if (!row) continue;
      const businessId = String(row.business_id || '');
      const business = businesses.get(businessId);
      if (!business) continue;

      if (products.length >= limit) {
        hasMore = true;
        break;
      }

      products.push({
        id: productId,
        business_id: businessId,
        business_name: business.name || 'Verified business',
        business_location: business.location || '',
        name: String(row.name || ''),
        description: String(row.description || ''),
        price: Number(row.price || 0),
        currency: String(row.currency || 'INR'),
        unit_label: String(row.unit_label || 'item'),
        stock_mode: row.stock_mode === 'in_stock' || row.stock_mode === 'made_to_order' ? row.stock_mode : 'out_of_stock',
        business_shop_state: candidate.business_shop_state === 'open' ? 'open' : 'closed',
        has_primary_image: false,
        verified_business: true,
      });
      nextCursor = batchStart + index + 1;

      if (products.length === limit) {
        hasMore = index < candidates.length - 1 || candidates.length === candidateBatchSize;
        break;
      }
    }

    if (products.length >= limit) break;
    if (candidates.length < candidateBatchSize) {
      exhausted = true;
      break;
    }
  }

  if (!exhausted && products.length < limit) {
    hasMore = true;
    nextCursor = scanOffset;
  }

  const imagePresence = await loadProductImagePresence(products.map((product) => product.id));
  const responseProducts = products.map((product) => ({
    ...product,
    has_primary_image: imagePresence.has(product.id),
  }));

  return NextResponse.json(
    {
      products: responseProducts,
      page: {
        limit,
        next_cursor: hasMore && nextCursor !== null ? String(nextCursor) : null,
        has_more: hasMore,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
