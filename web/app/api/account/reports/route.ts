import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_my_marketplace_moderation_reports');
    if (error) throw new Error(error.message);

    return NextResponse.json(
      { reports: Array.isArray(data) ? data : [] },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load safety reports.' },
      { status: 401, headers: noStoreHeaders },
    );
  }
}
