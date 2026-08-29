import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { fetchCashfreeOrder, getCashfreeConfig } from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayResult(orderStatus: string): 'succeeded' | 'cancelled' | 'expired' | null {
  const status = orderStatus.toUpperCase();
  if (status === 'PAID') return 'succeeded';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'TERMINATED' || status === 'TERMINATION_REQUESTED') return 'cancelled';
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const config = getCashfreeConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Online payment gateway is not configured.', code: 'PAYMENT_GATEWAY_NOT_CONFIGURED' }, { status: 503 });
    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const input = await request.json() as { order_id?: string };
    const orderId = input.order_id?.trim() ?? '';
    if (!orderId) return NextResponse.json({ error: 'Cashfree order id is required.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: intent, error: intentError } = await supabase
      .from('booking_payment_intents')
      .select('id,booking_id,amount_minor,currency,status,gateway,gateway_session_id')
      .eq('booking_id', bookingId)
      .eq('customer_id', session.user_id)
      .eq('gateway', 'cashfree')
      .eq('gateway_session_id', orderId)
      .maybeSingle();
    if (intentError) throw new Error(intentError.message);
    if (!intent) return NextResponse.json({ error: 'Matching payment attempt was not found.' }, { status: 404 });

    const order = await fetchCashfreeOrder(orderId);
    if (Math.round(Number(order.order_amount) * 100) !== Number(intent.amount_minor) || order.order_currency !== intent.currency) {
      throw new Error('Cashfree order amount or currency does not match the booking payment intent.');
    }

    const result = gatewayResult(order.order_status);
    if (result) {
      const service = createSupabaseServiceClient();
      const { error: applyError } = await service.rpc('gateway_apply_payment_result', {
        target_intent_id: intent.id,
        result_status: result,
        target_gateway_payment_id: null,
        result_code: null,
        result_message: null,
      });
      if (applyError) throw new Error(applyError.message);
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('payment_status')
      .eq('id', bookingId)
      .eq('customer_id', session.user_id)
      .maybeSingle();
    if (bookingError) throw new Error(bookingError.message);

    return NextResponse.json({
      verified: true,
      provider: 'cashfree',
      order_status: order.order_status,
      payment_status: booking?.payment_status ?? null,
      final: order.order_status === 'PAID' || order.order_status === 'EXPIRED' || order.order_status === 'TERMINATED',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment could not be verified.' }, { status: 400 });
  }
}
