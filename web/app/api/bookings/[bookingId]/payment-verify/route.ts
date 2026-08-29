import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import {
  fetchCashfreeOrder,
  fetchCashfreePayments,
  getCashfreeConfig,
  type CashfreePayment,
} from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GatewayResult = 'succeeded' | 'failed' | 'cancelled' | 'expired';

function paymentTimestamp(payment: CashfreePayment) {
  const value = payment.payment_completion_time || payment.payment_time;
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}

function resolveGatewayResult(orderStatus: string, payments: CashfreePayment[]) {
  const success = payments.find((payment) => payment.payment_status?.toUpperCase() === 'SUCCESS');
  if (success || orderStatus.toUpperCase() === 'PAID') {
    return { result: 'succeeded' as GatewayResult, payment: success ?? null };
  }

  const latest = [...payments].sort((a, b) => paymentTimestamp(b) - paymentTimestamp(a))[0] ?? null;
  const paymentStatus = latest?.payment_status?.toUpperCase() ?? '';
  if (paymentStatus === 'FAILED') return { result: 'failed' as GatewayResult, payment: latest };
  if (['USER_DROPPED', 'CANCELLED', 'VOID'].includes(paymentStatus)) return { result: 'cancelled' as GatewayResult, payment: latest };

  const status = orderStatus.toUpperCase();
  if (status === 'EXPIRED') return { result: 'expired' as GatewayResult, payment: latest };
  if (status === 'TERMINATED' || status === 'TERMINATION_REQUESTED') return { result: 'cancelled' as GatewayResult, payment: latest };
  return { result: null, payment: latest };
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

    const [order, payments] = await Promise.all([
      fetchCashfreeOrder(orderId),
      fetchCashfreePayments(orderId),
    ]);
    if (Math.round(Number(order.order_amount) * 100) !== Number(intent.amount_minor) || order.order_currency !== intent.currency) {
      throw new Error('Cashfree order amount or currency does not match the booking payment intent.');
    }
    for (const payment of payments) {
      if (Math.round(Number(payment.payment_amount) * 100) !== Number(intent.amount_minor) || payment.payment_currency !== intent.currency) {
        throw new Error('Cashfree payment amount or currency does not match the booking payment intent.');
      }
    }

    const resolved = resolveGatewayResult(order.order_status, payments);
    if (resolved.result) {
      const service = createSupabaseServiceClient();
      const errorCode = resolved.payment?.error_details?.error_code || resolved.payment?.error_details?.error_reason || null;
      const { error: applyError } = await service.rpc('gateway_apply_payment_result', {
        target_intent_id: intent.id,
        result_status: resolved.result,
        target_gateway_payment_id: resolved.payment?.cf_payment_id == null ? null : String(resolved.payment.cf_payment_id),
        result_code: resolved.result === 'failed' ? errorCode : null,
        result_message: resolved.payment?.payment_message ?? null,
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
      payment_attempt_status: resolved.payment?.payment_status ?? null,
      payment_message: resolved.payment?.payment_message ?? null,
      payment_status: booking?.payment_status ?? null,
      final: resolved.result !== null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment could not be verified.' }, { status: 400 });
  }
}
