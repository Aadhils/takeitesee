import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethod = 'unselected' | 'online_gateway' | 'cash_on_service';

export async function GET(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('id,customer_id,status,payment_status,payment_method,cash_collected_at')
      .eq('id', bookingId)
      .eq('customer_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Booking was not found.' }, { status: 404 });
    return NextResponse.json({
      payment_method: data.payment_method as PaymentMethod,
      payment_status: data.payment_status,
      booking_status: data.status,
      cash_collected_at: data.cash_collected_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load payment method.' }, { status: 401 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const body = await request.json() as { method?: string };
    const method = body.method?.trim() as PaymentMethod | undefined;
    if (!method || !['online_gateway', 'cash_on_service'].includes(method)) {
      return NextResponse.json({ error: 'A valid payment method is required.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_set_booking_payment_method', {
      target_booking_id: bookingId,
      target_method: method,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Payment method could not be updated.');

    return NextResponse.json({
      payment_method: data.payment_method as PaymentMethod,
      payment_status: data.payment_status,
      booking_status: data.status,
      cash_collected_at: data.cash_collected_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment method could not be updated.';
    const status = /authentication|own booking|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
