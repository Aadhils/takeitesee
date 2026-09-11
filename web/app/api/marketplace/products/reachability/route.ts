import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure } from '../../../../../server/marketplace/public-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maxProbeIds = 50;

type PublicBusiness = {
  id: string;
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

function requestedIds(request: Request) {
  const raw = new URL(request.url).searchParams.get('ids');
  if (raw === null) return { ids: null as string[] | null, error: 'Target product ids are required.' };
  const ids = Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)));
  if (ids.length > maxProbeIds) return { ids: null as string[] | null, error: `At most ${maxProbeIds} product ids can be checked at once.` };
  return { ids, error: '' };
}

export async function GET(request: Request) {
  const target = requestedIds(request);
  if (!target.ids) return NextResponse.json({ error: target.error }, { status: 400 });
  if (!target.ids.length) return NextResponse.json({ ids: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const { data: productRows, error: productError } = await supabase
    .from('business_products')
    .select('id,business_id')
    .in('id', target.ids);

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });

  const businessIds = Array.from(new Set((productRows ?? []).map((row: any) => String(row.business_id || '')).filter(Boolean)));
  if (!businessIds.length) return NextResponse.json({ ids: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const { data: businessRows, error: businessError } = await supabase
    .from('businesses')
    .select('id,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
    .in('id', businessIds)
    .eq('verified', true);

  if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });

  const publicBusinessIds = new Set((businessRows ?? []).flatMap((row: any) => {
    const business = row as PublicBusiness;
    if (!business.id || business.verified !== true || !hasMarketplaceDisclosure(business)) return [];
    return [String(business.id)];
  }));

  const ids = (productRows ?? [])
    .filter((row: any) => publicBusinessIds.has(String(row.business_id || '')))
    .map((row: any) => String(row.id || ''))
    .filter(Boolean);

  return NextResponse.json({ ids }, { headers: { 'Cache-Control': 'no-store' } });
}
