import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequirementCatalog = {
  categories?: Array<{ id: string; name: string; code: string }>;
  locations?: Array<{ id: string; name: string; code: string; timezone?: string | null }>;
};

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    // Customer requirement posting needs a small read-only projection of active
    // marketplace taxonomy. The underlying governance tables remain private; the
    // authenticated RPC exposes only leaf categories and city choices.
    const supabase = await createSupabaseServerClient();
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
      { status: 500 },
    );
  }
}
