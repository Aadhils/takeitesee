import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string }> };

type CreateJobBody = {
  booking_date?: string;
  start_time?: string;
  notes?: string;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_requirement_job_history', {
      target_requirement_id: requirementId,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Service job history could not be loaded.';
    return NextResponse.json({ error: message }, { status: /authentication|required|accessible/i.test(message) ? 401 : 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const body = await request.json() as CreateJobBody;
    const bookingDate = String(body.booking_date ?? '').trim();
    const startTime = String(body.start_time ?? '').trim();
    const notes = String(body.notes ?? '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return NextResponse.json({ error: 'Choose a valid booking date.' }, { status: 400 });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      return NextResponse.json({ error: 'Choose a valid booking time.' }, { status: 400 });
    }
    if (notes.length > 1000) {
      return NextResponse.json({ error: 'Job notes must be 1000 characters or fewer.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_create_requirement_job', {
      target_requirement_id: requirementId,
      requested_booking_date: bookingDate,
      requested_start_time: `${startTime}:00`,
      requested_notes: notes || null,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Service job could not be created.');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Service job could not be created.';
    const status = /authentication|own requirement/i.test(message) ? 403 : /already has an active|outside|blocked|booking during|future booking|accepted proposal/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
