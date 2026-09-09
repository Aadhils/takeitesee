import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { hasMarketplaceDisclosure } from '../../../../server/marketplace/public-directory';
import { loadProductImagePresence } from '../../../../server/marketplace/public-product-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pageSize = 1000;
const maxProductRows = 10000;
const businessChunkSize = 200;
const shopChunkSize = 1000;

type BusinessShopState = 'open' | 'closed';

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

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadBusinessShopStates(businessIds: string[]) {
  const states = new Map<string, BusinessShopState>();
  if (!businessIds.length) return states;

  try {
    const serviceRole = createSupabaseServiceClient();
    for (let start = 0; start < businessIds.length; start += shopChunkSize) {
      const chunk = businessIds.slice(start, start + shopChunkSize);
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
    // Shop state is informational only. Missing/failed enrichment stays fail-safe Closed.
    return new Map<string, BusinessShopState>();
  }

  return states;
}

export async function GET() {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const productRows: any[] = [];
  for (let start = 0; start < maxProductRows; start += pageSize) {
    const { data, error } = await supabase
      .from('business_products')
      .select('id,business_id,name,description,price,currency,unit_label,stock_mode')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(start, Math.min(start + pageSize - 1, maxProductRows - 1));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    productRows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  // The anon/RLS product read above is the public-eligibility authority. Only Business
  // ids attached to those already-public products are used for the following enrichment.
  const businessIds = Array.from(new Set(productRows.map((row) => String(row.business_id || '')).filter(Boolean)));
  const businesses = new Map<string, PublicBusiness>();

  for (let start = 0; start < businessIds.length; start += businessChunkSize) {
    const chunk = businessIds.slice(start, start + businessChunkSize);
    const { data, error } = await supabase
      .from('businesses')
      .select('id,name,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
      .in('id', chunk)
      .eq('verified', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data ?? []) {
      const business = row as PublicBusiness;
      if (business.id && business.verified === true && hasMarketplaceDisclosure(business)) {
        businesses.set(String(business.id), business);
      }
    }
  }

  const publicBusinessIds = businessIds.filter((id) => businesses.has(id));
  const publicProductIds = productRows
    .filter((row) => businesses.has(String(row.business_id || '')))
    .map((row) => String(row.id || ''))
    .filter(Boolean);
  const [shopStates, imagePresence] = await Promise.all([
    loadBusinessShopStates(publicBusinessIds),
    loadProductImagePresence(publicProductIds),
  ]);

  const products = productRows.flatMap((row) => {
    const productId = String(row.id || '');
    const businessId = String(row.business_id || '');
    const business = businesses.get(businessId);
    if (!business) return [];
    return [{
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
      business_shop_state: shopStates.get(businessId) ?? 'closed',
      has_primary_image: imagePresence.has(productId),
      verified_business: true,
    }];
  });

  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
}
