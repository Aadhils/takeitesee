import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type ProviderType = 'professional' | 'business';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const supabase = await createSupabaseServerClient();

    const [professionalResult, businessResult, applicationsResult] = await Promise.all([
      supabase.from('professional_profiles').select('id,headline,service_area,verified').eq('user_id', session.user_id).limit(1).maybeSingle(),
      supabase.from('businesses').select('id,name,location,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
      supabase.from('provider_applications').select('id,provider_type,display_name,description,location,status,review_note,reviewed_at,result_provider_id,created_at,updated_at').eq('applicant_user_id', session.user_id).order('created_at', { ascending: false }),
    ]);

    if (professionalResult.error) throw new Error(professionalResult.error.message);
    if (businessResult.error) throw new Error(businessResult.error.message);
    if (applicationsResult.error) throw new Error(applicationsResult.error.message);

    const providers = [] as Array<{
      id: string;
      provider_type: ProviderType;
      display_name: string;
      location: string;
      verified: boolean;
    }>;

    if (professionalResult.data) {
      providers.push({
        id: professionalResult.data.id,
        provider_type: 'professional',
        display_name: professionalResult.data.headline || 'Professional provider',
        location: professionalResult.data.service_area || '',
        verified: Boolean(professionalResult.data.verified),
      });
    }

    if (businessResult.data) {
      providers.push({
        id: businessResult.data.id,
        provider_type: 'business',
        display_name: businessResult.data.name,
        location: businessResult.data.location || '',
        verified: Boolean(businessResult.data.verified),
      });
    }

    const availableProviderTypes: ProviderType[] = [];
    if (!professionalResult.data) availableProviderTypes.push('professional');
    if (!businessResult.data) availableProviderTypes.push('business');

    return NextResponse.json({
      // Keep the singular field for compatibility with older clients while the UI moves to providers[].
      provider: providers[0] ?? null,
      providers,
      available_provider_types: availableProviderTypes,
      applications: applicationsResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider onboarding.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const input = await request.json() as { provider_type?: string; display_name?: string; description?: string; location?: string };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_provider_application', {
      requested_provider_type: input.provider_type ?? '',
      requested_display_name: input.display_name ?? '',
      requested_description: input.description ?? '',
      requested_location: input.location ?? '',
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Provider application could not be submitted.');
    return NextResponse.json({ application: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider application could not be submitted.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const input = await request.json() as { application_id?: string; action?: 'withdraw' };
    if (!input.application_id || input.action !== 'withdraw') return NextResponse.json({ error: 'A pending application and withdraw action are required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('withdraw_provider_application', { target_application_id: input.application_id }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Provider application could not be withdrawn.');
    return NextResponse.json({ application: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider application could not be withdrawn.' }, { status: 400 });
  }
}
