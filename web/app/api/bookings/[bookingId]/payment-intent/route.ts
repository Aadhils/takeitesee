import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentIntentRow = {
  id: string;
  booking_id: string;
  attempt_no: number;
  gateway: string | null;
  gateway_session_id: string | null;
  amount_minor: number;
  currency: string;
  status: string;
  failure_code: string | null;
  failure_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function safeIntent(row: PaymentIntentRow) {
  return {
    id: row.id,
    booking_id: row.booking_id,
    attempt_no: row.attempt_no,
    gateway: row.gateway,
    gateway_session_id: row.gateway_session_id,
    amount_minor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    failure_code: row.failure_code,
    failure_message: row.failure_message,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,customer_id,payment_status,status,quoted_price,currency')
      .eq('id', bookingId)
      .eq('customer_id', session.user_id)
      .maybeSingle();
    if (bookingError) throw new Error(bookingError.message);
    if (!booking) return NextResponse.json({ error: 'Booking was not found.' }, { status: 404 });

    const { data, error } = await supabase
      .from('booking_payment_intents')
      .select('id,booking_id,attempt_no,gateway,gateway_session_id,amount_minor,currency,status,failure_code,failure_message,expires_at,created_at,updated_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json({
      booking_payment_status: booking.payment_status,
      booking_status: booking.status,
      amount: Number(booking.quoted_price),
      currency: booking.currency,
      intents: ((data ?? []) as PaymentIntentRow[]).map(safeIntent),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load payment attempts.' }, { status: 401 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const input = await request.json() as { idempotency_key?: string };
    const key = input.idempotency_key?.trim() ?? '';
    if (key.length < 8 || key.length > 120) {
      return NextResponse.json({ error: 'Payment idempotency key must be 8 to 120 characters.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_booking_payment_intent', {
      target_booking_id: bookingId,
      requested_idempotency_key: key,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Payment intent could not be created.');

    return NextResponse.json({ intent: safeIntent(data as PaymentIntentRow) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment intent could not be created.' }, { status: 400 });
  }
}
