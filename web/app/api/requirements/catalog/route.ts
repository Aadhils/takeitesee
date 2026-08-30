import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();
    const [{ data: categories, error: categoryError }, { data: locations, error: locationError }] = await Promise.all([
      supabase
        .from('platform_categories')
        .select('id,parent_id,code,name,sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('platform_locations')
        .select('id,parent_id,type,code,name,country_code,timezone')
        .eq('active', true)
        .eq('type', 'city')
        .order('name', { ascending: true }),
    ]);
    if (categoryError) throw new Error(categoryError.message);
    if (locationError) throw new Error(locationError.message);

    const parentIds = new Set((categories ?? []).map((row) => row.parent_id).filter(Boolean));
    const leafCategories = (categories ?? []).filter((row) => !parentIds.has(row.id));

    return NextResponse.json({ categories: leafCategories, locations: locations ?? [] }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement options.' }, { status: 401 });
  }
}
