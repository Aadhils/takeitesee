import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PendingRequest = {
  id: string;
  product_id: string;
  business_id: string;
  applicant_user_id: string;
  product_revision: number;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireAdmin(request);
    if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

    const serviceRole = createSupabaseServiceClient();
    const { data: requestRows, error: requestError } = await serviceRole
      .from('business_product_launch_requests')
      .select('id,product_id,business_id,applicant_user_id,product_revision,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (requestError) throw new Error(requestError.message);

    const requests = (requestRows ?? []) as PendingRequest[];
    const productIds = [...new Set(requests.map((row) => row.product_id))];
    const businessIds = [...new Set(requests.map((row) => row.business_id))];

    const [{ data: products, error: productError }, { data: businesses, error: businessError }] = await Promise.all([
      productIds.length
        ? serviceRole.from('business_products').select('id,name,description,sku,price,currency,unit_label,stock_mode,status,review_revision').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
      businessIds.length
        ? serviceRole.from('businesses').select('id,name,verified').in('id', businessIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productError) throw new Error(productError.message);
    if (businessError) throw new Error(businessError.message);

    const productById = new Map((products ?? []).map((row) => [String(row.id), row]));
    const businessById = new Map((businesses ?? []).map((row) => [String(row.id), row]));

    return NextResponse.json({
      requests: requests.map((row) => ({
        ...row,
        product: productById.get(row.product_id) ?? null,
        business: businessById.get(row.business_id) ?? null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load product launch reviews.' },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await productionAuthProvider.requireAdmin(request);
    if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

    const input = await request.json() as {
      request_id?: string;
      decision?: 'approve' | 'changes_requested' | 'reject';
      note?: string;
    };
    if (!input.request_id || !input.decision || !['approve', 'changes_requested', 'reject'].includes(input.decision)) {
      return NextResponse.json({ error: 'Launch request and a valid decision are required.' }, { status: 400 });
    }

    const serviceRole = createSupabaseServiceClient();
    const { data, error } = await serviceRole.rpc('review_business_product_launch_request', {
      target_request_id: input.request_id,
      target_reviewer_user_id: session.user_id,
      target_decision: input.decision,
      target_review_note: input.note?.trim() || null,
    }).single();
    if (error || !data) throw new Error(error?.message ?? 'Product launch request could not be reviewed.');
    return NextResponse.json({ request: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Product launch request could not be reviewed.' },
      { status: 400 },
    );
  }
}
