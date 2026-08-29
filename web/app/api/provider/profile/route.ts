import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    if (session.roles.includes('professional')) {
      const { data: profile, error } = await supabase
        .from('professional_profiles')
        .select('id,headline,description,service_area,verified,created_at,updated_at')
        .eq('user_id', session.user_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!profile) throw new Error('Professional profile is required.');
      const { data: services, error: serviceError } = await supabase.from('services').select('id,status').eq('professional_id', profile.id);
      if (serviceError) throw new Error(serviceError.message);
      return NextResponse.json({ profile: { provider_type: 'professional', id: profile.id, display_name: profile.headline || 'Professional provider', description: profile.description || '', location: profile.service_area || '', verified: Boolean(profile.verified), services_total: services?.length ?? 0, services_active: (services ?? []).filter((service) => service.status === 'active').length, created_at: profile.created_at, updated_at: profile.updated_at } });
    }

    const { data: business, error } = await supabase.from('businesses').select('id,name,description,location,verified,created_at,updated_at').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error('Business profile is required.');
    const { data: services, error: serviceError } = await supabase.from('services').select('id,status').eq('business_id', business.id);
    if (serviceError) throw new Error(serviceError.message);
    return NextResponse.json({ profile: { provider_type: 'business', id: business.id, display_name: business.name, description: business.description || '', location: business.location || '', verified: Boolean(business.verified), services_total: services?.length ?? 0, services_active: (services ?? []).filter((service) => service.status === 'active').length, created_at: business.created_at, updated_at: business.updated_at } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider profile.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { display_name?: string; description?: string; location?: string };
    if (!input.display_name || !input.location) return NextResponse.json({ error: 'Display name and service area are required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('update_provider_profile', {
      requested_display_name: input.display_name,
      requested_description: input.description ?? '',
      requested_location: input.location,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ result: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update provider profile.' }, { status: 400 });
  }
}
