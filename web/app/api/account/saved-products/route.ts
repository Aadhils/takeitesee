import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { productionAuthProvider } from '../../../../server/auth/session';
import { hasMarketplaceDisclosure } from '../../../../server/marketplace/public-directory';
import { loadProductImagePresence } from '../../../../server/marketplace/public-product-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chunkSize = 200;

type SavedProductRow = { product_id: string; saved_at: string };
type ProductRow = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | string;
  currency: string;
  unit_label: string;
  stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
};
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

type ProductPresentation = {
  id: string;
  business_id: string;
  business_name: string;
  business_location: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  unit_label: string;
  stock_mode: ProductRow['stock_mode'];
  has_primary_image: boolean;
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function customerContext(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) throw new Error('Authentication required.');

  const supabase = await createSupabaseServerClient();
  const { data: customer, error } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) throw new Error('Customer profile required.');
  return { supabase, customer };
}

async function loadPublicProducts(productIds: string[]) {
  const productsById = new Map<string, ProductPresentation>();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return productsById;

  const supabase = publicSupabase();
  if (!supabase) throw new Error('Marketplace database is not configured.');

  const products: ProductRow[] = [];
  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    // anon business_products RLS is the current-approved Product authority.
    const { data, error } = await supabase
      .from('business_products')
      .select('id,business_id,name,description,price,currency,unit_label,stock_mode')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    products.push(...((data ?? []) as ProductRow[]));
  }

  const businessIds = [...new Set(products.map((product) => String(product.business_id || '')).filter(Boolean))];
  const businesses = new Map<string, PublicBusiness>();
  for (let start = 0; start < businessIds.length; start += chunkSize) {
    const chunk = businessIds.slice(start, start + chunkSize);
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

  const eligibleProducts = products.filter((product) => businesses.has(String(product.business_id)));
  const imagePresence = await loadProductImagePresence(eligibleProducts.map((product) => String(product.id)));

  for (const product of eligibleProducts) {
    const id = String(product.id);
    const businessId = String(product.business_id);
    const business = businesses.get(businessId)!;
    productsById.set(id, {
      id,
      business_id: businessId,
      business_name: business.name || 'Verified business',
      business_location: business.location || '',
      name: String(product.name || ''),
      description: String(product.description || ''),
      price: Number(product.price || 0),
      currency: String(product.currency || 'INR'),
      unit_label: String(product.unit_label || 'item'),
      stock_mode: product.stock_mode,
      has_primary_image: imagePresence.has(id),
    });
  }

  return productsById;
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === 'Authentication required.' ? 401 : message === 'Customer profile required.' ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const context = await customerContext(request);
    const requestedProductId = new URL(request.url).searchParams.get('product_id')?.trim() || '';

    if (requestedProductId) {
      const { data, error } = await context.supabase
        .from('customer_saved_products')
        .select('product_id')
        .eq('customer_id', context.customer.id)
        .eq('product_id', requestedProductId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return NextResponse.json({ saved: Boolean(data) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: savedRows, error: savedError } = await context.supabase
      .from('customer_saved_products')
      .select('product_id,saved_at')
      .eq('customer_id', context.customer.id)
      .order('saved_at', { ascending: false });
    if (savedError) throw new Error(savedError.message);

    const rows = (savedRows ?? []) as SavedProductRow[];
    const publicProducts = await loadPublicProducts(rows.map((row) => row.product_id));
    const saved_products = rows.map((row) => {
      const product = publicProducts.get(row.product_id) ?? null;
      return {
        product_id: row.product_id,
        saved_at: row.saved_at,
        available: Boolean(product),
        product,
      };
    });

    return NextResponse.json({ saved_products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, 'Unable to load saved products.');
  }
}

export async function POST(request: Request) {
  try {
    const context = await customerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    if (!productId) return NextResponse.json({ error: 'Product is required.' }, { status: 400 });

    const publicProducts = await loadPublicProducts([productId]);
    if (!publicProducts.has(productId)) {
      return NextResponse.json({ error: 'This Product is not currently available to save.' }, { status: 409 });
    }

    // Authenticated callers intentionally have no direct INSERT privilege on the saved
    // relation. Only this server path writes after current public Product verification.
    const serviceRole = createSupabaseServiceClient();
    const { data: saved, error: saveError } = await serviceRole
      .from('customer_saved_products')
      .insert({ customer_id: context.customer.id, product_id: productId })
      .select('product_id,saved_at')
      .single();

    if (saveError?.code === '23505') {
      const { data: existing, error: existingError } = await context.supabase
        .from('customer_saved_products')
        .select('product_id,saved_at')
        .eq('customer_id', context.customer.id)
        .eq('product_id', productId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      return NextResponse.json({ saved_product: existing, already_saved: true });
    }
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ saved_product: saved, already_saved: false }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Unable to save Product.');
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await customerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const productId = typeof body.product_id === 'string' ? body.product_id.trim() : '';
    if (!productId) return NextResponse.json({ error: 'Product is required.' }, { status: 400 });

    const { error } = await context.supabase
      .from('customer_saved_products')
      .delete()
      .eq('customer_id', context.customer.id)
      .eq('product_id', productId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ removed: true, product_id: productId });
  } catch (error) {
    return errorResponse(error, 'Unable to remove saved Product.');
  }
}
