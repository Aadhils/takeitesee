import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';
import { getBookingCloseoutReadModel } from '../../../../../../server/bookings/closeout';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await params;
    const body = await request.json() as { action?: 'confirm_completion' | 'report_provider_no_show'; note?: string };
    if (!body.action || !['confirm_completion', 'report_provider_no_show'].includes(body.action)) {
      return NextResponse.json({ error: 'A valid attendance action is required.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    if (body.action === 'confirm_completion') {
      const { error } = await supabase.rpc('customer_confirm_service_completion', { target_booking_id: bookingId });
      if (error) throw new Error(error.message);
    } else {
      const note = body.note?.trim() || null;
      if (note && note.length > 1000) return NextResponse.json({ error: 'No-show details must be 1000 characters or fewer.' }, { status: 400 });
      const { error } = await supabase.rpc('customer_report_provider_no_show', { target_booking_id: bookingId, report_note: note });
      if (error) throw new Error(error.message);
    }

    const closeout = await getBookingCloseoutReadModel(bookingId, session.user_id);
    if (!closeout) return NextResponse.json({ error: 'Booking closeout could not be loaded.' }, { status: 404 });
    return NextResponse.json(closeout);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Attendance action could not be completed.' }, { status: 400 });
  }
}
