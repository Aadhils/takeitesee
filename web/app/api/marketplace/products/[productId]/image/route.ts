import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure } from '../../../../../../server/marketplace/public-directory';
import { createPublicEligibleProductImageUrl } from '../../../../../../server/marketplace/public-product-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  const supabase = publicSupabase();
  if (!supabase) return new NextResponse(null, { status: 404 });

  // business_products anon RLS is the publication authority. If the current Product
  // revision is no longer approved, this row disappears before any privileged media read.
  const { data: product, error: productError } = await supabase
    .from('business_products')
    .select('id,business_id')
    .eq('id', productId)
    .maybeSingle();
  if (productError || !product?.id || !product.business_id) return new NextResponse(null, { status: 404 });

  // Keep Product image visibility aligned with the same verified/disclosed Business
  // requirement used by the public Product marketplace and Product detail page.
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
    .eq('id', product.business_id)
    .eq('verified', true)
    .maybeSingle();
  if (businessError || !business || business.verified !== true || !hasMarketplaceDisclosure(business)) {
    return new NextResponse(null, { status: 404 });
  }

  const signedUrl = await createPublicEligibleProductImageUrl(String(product.id), String(product.business_id));
  if (!signedUrl) return new NextResponse(null, { status: 404 });

  const response = NextResponse.redirect(signedUrl, 307);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, noarchive');
  return response;
}
