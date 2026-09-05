import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderType = 'professional' | 'business';
type TrustState = { status?: 'normal' | 'reverification_required' | 'suspended'; reason?: string | null } | null;
type ReadinessService = Record<string, unknown> & { id?: string; launch_ready?: boolean };
type Readiness = { provider_id?: string; marketplace_live?: boolean; services?: ReadinessService[] } & Record<string, unknown>;

function activeProviderType(roles: readonly string[]): ProviderType {
  return roles.includes('professional') ? 'professional' : 'business';
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const providerType = activeProviderType(session.roles);
    const supabase = await createSupabaseServerClient();
    const [readinessResult, optionsResult] = await Promise.all([
      supabase.rpc('get_provider_setup_readiness_for_type', { requested_provider_type: providerType }),
      supabase.rpc('get_provider_launch_options'),
    ]);
    if (readinessResult.error) throw new Error(readinessResult.error.message);
    if (optionsResult.error) throw new Error(optionsResult.error.message);

    const raw = (readinessResult.data ?? {}) as Readiness;
    const providerId = typeof raw.provider_id === 'string' ? raw.provider_id : '';
    if (!providerId) throw new Error('Active provider profile was not resolved.');

    const trustResult = providerType === 'professional'
      ? await supabase.from('provider_trust_states').select('status,reason').eq('professional_id', providerId).maybeSingle()
      : await supabase.from('provider_trust_states').select('status,reason').eq('business_id', providerId).maybeSingle();
    if (trustResult.error) throw new Error(trustResult.error.message);
    const trust = (trustResult.data ?? null) as TrustState;
    const trustNormal = !trust || trust.status === 'normal';

    const serviceIds = (raw.services ?? []).map((service) => typeof service.id === 'string' ? service.id : '').filter(Boolean);
    let requests: Record<string, unknown>[] = [];
    if (serviceIds.length) {
      const requestsResult = await supabase.from('service_launch_requests')
        .select('id,service_id,requested_application_id,requested_category_id,requested_location_id,status,review_note,reviewed_at,created_at,updated_at')
        .eq('applicant_user_id', session.user_id)
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false });
      if (requestsResult.error) throw new Error(requestsResult.error.message);
      requests = (requestsResult.data ?? []) as Record<string, unknown>[];
    }

    const readiness = {
      ...raw,
      trust_status: trust?.status ?? 'normal',
      trust_reason: trust?.reason ?? null,
      marketplace_live: Boolean(raw.marketplace_live) && trustNormal,
      services: (raw.services ?? []).map((service) => ({ ...service, launch_ready: Boolean(service.launch_ready) && trustNormal })),
    };

    return NextResponse.json({ readiness, trust, options: optionsResult.data, requests });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider setup.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const providerType = activeProviderType(session.roles);
    const input = await request.json() as { service_id?: string; application_id?: string; category_id?: string; location_id?: string };
    if (!input.service_id || !input.application_id || !input.category_id || !input.location_id) {
      return NextResponse.json({ error: 'Service, application, category, and location are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_service_launch_request_for_type', {
      requested_provider_type: providerType,
      target_service_id: input.service_id,
      target_application_id: input.application_id,
      target_category_id: input.category_id,
      target_location_id: input.location_id,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Service launch request could not be submitted.');
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Service launch request could not be submitted.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const providerType = activeProviderType(session.roles);
    const input = await request.json() as { request_id?: string };
    if (!input.request_id) return NextResponse.json({ error: 'Launch request is required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();

    const { data: launchRequest, error: requestError } = await supabase.from('service_launch_requests')
      .select('id,service_id')
      .eq('id', input.request_id)
      .eq('applicant_user_id', session.user_id)
      .maybeSingle();
    if (requestError) throw new Error(requestError.message);
    if (!launchRequest) return NextResponse.json({ error: 'Launch request was not found.' }, { status: 404 });

    const { data: service, error: serviceError } = await supabase.from('services')
      .select('id,professional_id,business_id')
      .eq('id', launchRequest.service_id)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    if (!service) return NextResponse.json({ error: 'Service was not found.' }, { status: 404 });

    if (providerType === 'professional') {
      const { data: profile, error: profileError } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile || service.professional_id !== profile.id) return NextResponse.json({ error: 'This launch request belongs to another workspace.' }, { status: 403 });
    } else {
      const { data: business, error: businessError } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      if (businessError) throw new Error(businessError.message);
      if (!business || service.business_id !== business.id) return NextResponse.json({ error: 'This launch request belongs to another workspace.' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('withdraw_service_launch_request', { target_request_id: input.request_id }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Launch request could not be withdrawn.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Launch request could not be withdrawn.' }, { status: 400 });
  }
}
