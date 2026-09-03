import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string }> };
type Status = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const [{ data: requirement, error }, { data: events, error: eventError }, { data: proposals, error: proposalError }] = await Promise.all([
      supabase
        .from('customer_requirements')
        .select('id,requirement_reference,customer_id,category_id,location_id,title,description,service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,preferred_start_time,expected_duration_minutes,schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,status,published_at,closed_at,awarded_at,accepted_proposal_id,created_at,updated_at,platform_categories(name,code),platform_locations(name,code,timezone)')
        .eq('id', requirementId)
        .eq('customer_id', session.user_id)
        .maybeSingle(),
      supabase
        .from('customer_requirement_events')
        .select('id,event_type,from_status,to_status,created_at')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: true }),
      supabase.rpc('get_customer_requirement_proposals', { target_requirement_id: requirementId }),
    ]);
    if (error) throw new Error(error.message);
    if (!requirement) return NextResponse.json({ error: 'Requirement was not found.' }, { status: 404 });
    if (eventError) throw new Error(eventError.message);
    if (proposalError) throw new Error(proposalError.message);
    return NextResponse.json({ requirement, events: events ?? [], proposals: proposals ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement.' }, { status: 401 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const body = await request.json() as { status?: Status };
    if (!body.status || !['open', 'paused', 'fulfilled', 'cancelled'].includes(body.status)) {
      return NextResponse.json({ error: 'A valid requirement status is required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_update_requirement_status', {
      target_requirement_id: requirementId,
      target_status: body.status,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Requirement could not be updated.');
    return NextResponse.json({ requirement: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Requirement could not be updated.';
    const status = /authentication|own requirement|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
