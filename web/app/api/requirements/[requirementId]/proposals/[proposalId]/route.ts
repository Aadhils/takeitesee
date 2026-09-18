import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string; proposalId: string }> };
type ProposalDecisionBody = {
  decision?: 'accept' | 'decline';
  booking_date?: string;
  start_time?: string;
  notes?: string;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId, proposalId } = await context.params;
    const body = await request.json() as ProposalDecisionBody;
    if (!requirementId || !proposalId || !body.decision || !['accept', 'decline'].includes(body.decision)) {
      return NextResponse.json({ error: 'A valid proposal decision is required.' }, { status: 400 });
    }

    const bookingDate = String(body.booking_date ?? '').trim();
    const startTime = String(body.start_time ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const chooseAndSchedule = body.decision === 'accept' && Boolean(bookingDate || startTime);

    if (chooseAndSchedule) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
        return NextResponse.json({ error: 'Choose a valid service date.' }, { status: 400 });
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
        return NextResponse.json({ error: 'Choose a valid start time.' }, { status: 400 });
      }
      if (notes.length > 1000) {
        return NextResponse.json({ error: 'Service notes must be 1000 characters or fewer.' }, { status: 400 });
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc('customer_choose_and_schedule_requirement_provider', {
        target_requirement_id: requirementId,
        target_proposal_id: proposalId,
        requested_booking_date: bookingDate,
        requested_start_time: `${startTime}:00`,
        requested_notes: notes || null,
      });
      if (error || !data) throw new Error(error?.message ?? 'Provider and service time could not be confirmed.');
      return NextResponse.json(data, { status: 201 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_decide_requirement_proposal', {
      target_proposal_id: proposalId,
      target_decision: body.decision,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Proposal decision could not be saved.');
    return NextResponse.json({ proposal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal decision could not be saved.';
    const status = /authentication|own requirement|required/i.test(message)
      ? 403
      : /active service job|previous occurrence|all recurring|one-time requirement already|planned date|outside|blocked|booking during|future booking|accepted proposal|too small to allocate|availability window|booking hours/i.test(message)
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
