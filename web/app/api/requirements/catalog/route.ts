import { NextResponse } from 'next/server';
import { requireCustomerSupabase } from '../../../../server/auth/customer-supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequirementCatalog = {
  categories?: Array<{ id: string; name: string; code: string }>;
  locations?: Array<{ id: string; name: string; code: string; timezone?: string | null }>;
};

export async function GET() {
  try {
    // Customer requirement posting needs a small read-only projection of active
    // marketplace taxonomy. The underlying governance tables remain private; the
    // authenticated RPC exposes only leaf categories and city choices.
    const { supabase } = await requireCustomerSupabase();
    const { data, error } = await supabase.rpc('get_customer_requirement_catalog');
    if (error) throw new Error(error.message);

    const catalog = (data ?? {}) as RequirementCatalog;
    return NextResponse.json({
      categories: catalog.categories ?? [],
      locations: catalog.locations ?? [],
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load requirement options.' },
      { status: /Authentication required/i.test(error instanceof Error ? error.message : '') ? 401 : 500 },
    );
  }
}
