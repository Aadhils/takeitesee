import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function profileInput(input: { display_name?: string; description?: string; location?: string }) {
  const displayName = input.display_name?.trim() ?? '';
  const description = input.description?.trim() || null;
  const location = input.location?.trim() ?? '';
  if (displayName.length < 2 || displayName.length > 120) throw new Error('Display name must be 2 to 120 characters.');
  if (description && description.length > 1200) throw new Error('Description must be 1200 characters or fewer.');
  if (location.length < 2 || location.length > 160) throw new Error('Service area must be 2 to 160 characters.');
  return { displayName, description, location };
}

function marketplaceDisclosureComplete(provider: {
  legal_name?: string | null;
  principal_address?: string | null;
  public_contact_email?: string | null;
  public_contact_phone?: string | null;
  grievance_officer_name?: string | null;
  grievance_officer_designation?: string | null;
  grievance_email?: string | null;
  grievance_phone?: string | null;
}) {
  return Boolean(
    provider.legal_name?.trim()
    && provider.principal_address?.trim()
    && provider.public_contact_email?.trim()
    && provider.public_contact_phone?.trim()
    && provider.grievance_officer_name?.trim()
    && provider.grievance_officer_designation?.trim()
    && provider.grievance_email?.trim()
    && provider.grievance_phone?.trim(),
  );
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    if (session.roles.includes('professional')) {
      const { data: profile, error } = await supabase
        .from('professional_profiles')
        .select('id,headline,description,service_area,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,created_at,updated_at')
        .eq('user_id', session.user_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!profile) throw new Error('Professional profile is required.');
      const { data: services, error: serviceError } = await supabase.from('services').select('id,status').eq('professional_id', profile.id);
      if (serviceError) throw new Error(serviceError.message);
      return NextResponse.json({ profile: { provider_type: 'professional', id: profile.id, display_name: profile.headline || 'Professional provider', description: profile.description || '', location: profile.service_area || '', verified: Boolean(profile.verified), marketplace_disclosure_complete: marketplaceDisclosureComplete(profile), services_total: services?.length ?? 0, services_active: (services ?? []).filter((service) => service.status === 'active').length, created_at: profile.created_at, updated_at: profile.updated_at } });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .select('id,name,description,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,created_at,updated_at')
      .eq('owner_user_id', session.user_id)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error('Business profile is required.');
    const { data: services, error: serviceError } = await supabase.from('services').select('id,status').eq('business_id', business.id);
    if (serviceError) throw new Error(serviceError.message);
    return NextResponse.json({ profile: { provider_type: 'business', id: business.id, display_name: business.name, description: business.description || '', location: business.location || '', verified: Boolean(business.verified), marketplace_disclosure_complete: marketplaceDisclosureComplete(business), services_total: services?.length ?? 0, services_active: (services ?? []).filter((service) => service.status === 'active').length, created_at: business.created_at, updated_at: business.updated_at } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider profile.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const input = profileInput(await request.json() as { display_name?: string; description?: string; location?: string });
    const supabase = await createSupabaseServerClient();

    if (session.roles.includes('professional')) {
      const { data: profile, error } = await supabase
        .from('professional_profiles')
        .update({ headline: input.displayName, description: input.description, service_area: input.location, updated_at: new Date().toISOString() })
        .eq('user_id', session.user_id)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!profile) throw new Error('Professional profile was not found.');
      const { data: complete, error: completeError } = await supabase.rpc('provider_profile_is_complete', {
        p_provider_type: 'professional',
        p_professional_id: profile.id,
        p_business_id: null,
      });
      if (completeError) throw new Error(completeError.message);
      if (!complete) {
        const { error: pauseError } = await supabase.from('services').update({ status: 'paused', active: false, updated_at: new Date().toISOString() }).eq('professional_id', profile.id).eq('status', 'active');
        if (pauseError) throw new Error(pauseError.message);
      }
      return NextResponse.json({ result: { provider_type: 'professional', provider_id: profile.id, profile_complete: Boolean(complete) } });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .update({ name: input.displayName, description: input.description, location: input.location, updated_at: new Date().toISOString() })
      .eq('owner_user_id', session.user_id)
      .select('id')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error('Business profile was not found.');
    const { data: complete, error: completeError } = await supabase.rpc('provider_profile_is_complete', {
      p_provider_type: 'business',
      p_professional_id: null,
      p_business_id: business.id,
    });
    if (completeError) throw new Error(completeError.message);
    if (!complete) {
      const { error: pauseError } = await supabase.from('services').update({ status: 'paused', active: false, updated_at: new Date().toISOString() }).eq('business_id', business.id).eq('status', 'active');
      if (pauseError) throw new Error(pauseError.message);
    }
    return NextResponse.json({ result: { provider_type: 'business', provider_id: business.id, profile_complete: Boolean(complete) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update provider profile.' }, { status: 400 });
  }
}
