import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ bookingId: string }> };
type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

const PAYMENT_STATES = new Set<PaymentStatus>(['unpaid', 'pending', 'paid', 'failed', 'refunded']);

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { bookingId } = await context.params;
    const body = await request.json() as { status?: string; note?: string; external_reference?: string };
    if (!body.status || !PAYMENT_STATES.has(body.status as PaymentStatus)) {
      return NextResponse.json({ error: 'A valid payment status is required.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('admin_update_booking_payment', {
      p_booking_id: bookingId,
      p_next_status: body.status,
      p_note: body.note?.trim() || null,
      p_external_reference: body.external_reference?.trim() || null,
    });
    if (error) throw new Error(error.message);

    const booking = Array.isArray(data) ? data[0] : data;
    if (!booking) throw new Error('Payment update did not return a booking.');
    return NextResponse.json({ booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update payment.';
    const status = /permission|required|authentication/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
