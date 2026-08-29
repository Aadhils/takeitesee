import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type TrustStatus = 'normal' | 'reverification_required' | 'suspended';

function initials(value: string) {
  const letters = value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return letters || 'P';
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, verified, location')
      .eq('owner_user_id', session.user_id)
      .limit(1)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);

    if (business) {
      const [{ count, error: countError }, { data: trust, error: trustError }] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'pending'),
        supabase.from('provider_trust_states').select('status,reason').eq('business_id', business.id).maybeSingle(),
      ]);
      if (countError) throw new Error(countError.message);
      if (trustError) throw new Error(trustError.message);

      return NextResponse.json({
        provider: {
          id: business.id,
          provider_type: 'business',
          display_name: business.name,
          initials: initials(business.name),
          verified: business.verified,
          location: business.location,
          pending_booking_count: count ?? 0,
          trust_status: (trust?.status ?? 'normal') as TrustStatus,
          trust_reason: trust?.reason ?? null,
        },
      });
    }

    const { data: professional, error: professionalError } = await supabase
      .from('professional_profiles')
      .select('id, headline, verified, service_area')
      .eq('user_id', session.user_id)
      .limit(1)
      .maybeSingle();
    if (professionalError) throw new Error(professionalError.message);

    if (!professional) throw new Error('Provider profile not found.');

    const [{ data: user, error: userError }, { count, error: countError }, { data: trust, error: trustError }] = await Promise.all([
      supabase.from('users').select('name').eq('id', session.user_id).maybeSingle(),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('professional_id', professional.id).eq('status', 'pending'),
      supabase.from('provider_trust_states').select('status,reason').eq('professional_id', professional.id).maybeSingle(),
    ]);
    if (userError) throw new Error(userError.message);
    if (countError) throw new Error(countError.message);
    if (trustError) throw new Error(trustError.message);

    const displayName = professional.headline?.trim() || user?.name?.trim() || 'Professional';
    return NextResponse.json({
      provider: {
        id: professional.id,
        provider_type: 'professional',
        display_name: displayName,
        initials: initials(displayName),
        verified: professional.verified,
        location: professional.service_area,
        pending_booking_count: count ?? 0,
        trust_status: (trust?.status ?? 'normal') as TrustStatus,
        trust_reason: trust?.reason ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider context.' }, { status: 401 });
  }
}
