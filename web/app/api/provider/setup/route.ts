import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();
    const [readinessResult, optionsResult, requestsResult] = await Promise.all([
      supabase.rpc('get_provider_setup_readiness'),
      supabase.rpc('get_provider_launch_options'),
      supabase.from('service_launch_requests')
        .select('id,service_id,requested_application_id,requested_category_id,requested_location_id,status,review_note,reviewed_at,created_at,updated_at')
        .eq('applicant_user_id', session.user_id)
        .order('created_at', { ascending: false }),
    ]);
    if (readinessResult.error) throw new Error(readinessResult.error.message);
    if (optionsResult.error) throw new Error(optionsResult.error.message);
    if (requestsResult.error) throw new Error(requestsResult.error.message);
    return NextResponse.json({ readiness: readinessResult.data, options: optionsResult.data, requests: requestsResult.data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider setup.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { service_id?: string; application_id?: string; category_id?: string; location_id?: string };
    if (!input.service_id || !input.application_id || !input.category_id || !input.location_id) {
      return NextResponse.json({ error: 'Service, application, category, and location are required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_service_launch_request', {
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
    await productionAuthProvider.requireProvider(request);
    const input = await request.json() as { request_id?: string };
    if (!input.request_id) return NextResponse.json({ error: 'Launch request is required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('withdraw_service_launch_request', { target_request_id: input.request_id }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Service launch request could not be withdrawn.');
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Service launch request could not be withdrawn.' }, { status: 400 });
  }
}
