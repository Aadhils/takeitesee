import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string }> };

type RecoveryBody = {
  booking_date?: string;
  start_time?: string;
  notes?: string;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const [requirementResult, jobsResult, planResult, recoveryResult] = await Promise.all([
      supabase
        .from('customer_requirements')
        .select('id,status,schedule_pattern')
        .eq('id', requirementId)
        .eq('customer_id', session.user_id)
        .maybeSingle(),
      supabase.rpc('get_requirement_job_history', {
        target_requirement_id: requirementId,
      }),
      supabase.rpc('get_customer_requirement_occurrence_plan', {
        target_requirement_id: requirementId,
      }),
      supabase.rpc('get_customer_requirement_recovery_history', {
        target_requirement_id: requirementId,
      }),
    ]);

    if (requirementResult.error) throw new Error(requirementResult.error.message);
    if (!requirementResult.data) return NextResponse.json({ error: 'Requirement was not found.' }, { status: 404 });
    if (jobsResult.error) throw new Error(jobsResult.error.message);
    if (planResult.error) throw new Error(planResult.error.message);
    if (recoveryResult.error) throw new Error(recoveryResult.error.message);

    return NextResponse.json({
      requirement: requirementResult.data,
      jobs: jobsResult.data ?? [],
      occurrence_plan: planResult.data ?? null,
      recoveries: recoveryResult.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Occurrence recovery details could not be loaded.';
    return NextResponse.json({ error: message }, { status: /authentication|required|access/i.test(message) ? 401 : 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const body = await request.json() as RecoveryBody;
    const bookingDate = String(body.booking_date ?? '').trim();
    const startTime = String(body.start_time ?? '').trim();
    const notes = String(body.notes ?? '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return NextResponse.json({ error: 'Choose a valid recovery booking date.' }, { status: 400 });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      return NextResponse.json({ error: 'Choose a valid recovery booking time.' }, { status: 400 });
    }
    if (notes.length > 1000) {
      return NextResponse.json({ error: 'Recovery notes must be 1000 characters or fewer.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_retry_requirement_occurrence', {
      target_requirement_id: requirementId,
      requested_booking_date: bookingDate,
      requested_start_time: `${startTime}:00`,
      requested_notes: notes || null,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Recurring occurrence could not be recovered.');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recurring occurrence could not be recovered.';
    const status = /authentication|own requirement|access/i.test(message)
      ? 403
      : /only a cancelled|another occurrence|already been recovered|outside the recurring plan|must be cancelled|payment activity|planned date|active|blocked|booking during|future booking|accepted proposal|too small to allocate/i.test(message)
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
