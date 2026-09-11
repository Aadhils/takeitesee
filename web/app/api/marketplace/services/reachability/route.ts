import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasMarketplaceDisclosure } from '../../../../../server/marketplace/public-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maxProbeIds = 50;

type PublicProvider = {
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
  if (raw === null) return { ids: null as string[] | null, error: 'Target service ids are required.' };
  const ids = Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)));
  if (ids.length > maxProbeIds) return { ids: null as string[] | null, error: `At most ${maxProbeIds} service ids can be checked at once.` };
  return { ids, error: '' };
}

export async function GET(request: Request) {
  const target = requestedIds(request);
  if (!target.ids) return NextResponse.json({ error: target.error }, { status: 400 });
  if (!target.ids.length) return NextResponse.json({ ids: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ error: 'Marketplace database is not configured.' }, { status: 500 });

  const { data, error } = await supabase
    .from('services')
    .select('id,provider_type,professional_id,business_id,active,status,professional_profiles(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone),businesses(verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone)')
    .in('id', target.ids)
    .eq('active', true)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).flatMap((row: any) => {
    const provider = (row.provider_type === 'business' ? row.businesses : row.professional_profiles) as PublicProvider | null;
    const providerId = row.provider_type === 'business' ? row.business_id : row.professional_id;
    if (!providerId || provider?.verified !== true || !hasMarketplaceDisclosure(provider)) return [];
    return [String(row.id)];
  });

  return NextResponse.json({ ids }, { headers: { 'Cache-Control': 'no-store' } });
}
