import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { createCashfreeOrder, getCashfreeConfig } from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IntentRow = {
  id: string;
  booking_id: string;
  amount_minor: number;
  currency: string;
  status: string;
};

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw new Error('Enter a valid 10-digit Indian mobile number for online payment.');
  return local;
}

function publicBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? 'https://www.takeitesee.com' : 'http://localhost:3000';
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const config = getCashfreeConfig();
    if (!config.enabled) {
      return NextResponse.json({
        error: 'Online payment gateway is not configured yet.',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        provider: config.provider,
        mode: config.mode,
      }, { status: 503 });
    }

    const session = await productionAuthProvider.requireCustomer(request);
    const { bookingId } = await context.params;
    const input = await request.json() as { idempotency_key?: string; customer_phone?: string };
    const idempotencyKey = input.idempotency_key?.trim() || randomUUID();
    const supabase = await createSupabaseServerClient();

    const [{ data: booking, error: bookingError }, { data: customer, error: customerError }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id,booking_reference,customer_id,status,payment_status,payment_method,quoted_price,currency')
        .eq('id', bookingId)
        .eq('customer_id', session.user_id)
        .maybeSingle(),
      supabase.from('users').select('id,name,email,phone').eq('id', session.user_id).maybeSingle(),
    ]);
    if (bookingError) throw new Error(bookingError.message);
    if (customerError) throw new Error(customerError.message);
    if (!booking) return NextResponse.json({ error: 'Booking was not found.' }, { status: 404 });
    if (!customer) throw new Error('Customer profile was not found.');
    if (booking.payment_method === 'cash_on_service') {
      return NextResponse.json({ error: 'Cash on Service is selected. Switch to online payment before starting Cashfree checkout.', code: 'CASH_ON_SERVICE_SELECTED' }, { status: 409 });
    }

    const phone = normalizeIndianPhone(input.customer_phone?.trim() || customer.phone || '');
    if (phone !== customer.phone) {
      const { error: phoneError } = await supabase.from('users').update({ phone }).eq('id', session.user_id);
      if (phoneError) throw new Error(phoneError.message);
    }

    const { data: intent, error: intentError } = await supabase.rpc('create_booking_payment_intent', {
      target_booking_id: bookingId,
      requested_idempotency_key: idempotencyKey,
    }).maybeSingle();
    if (intentError || !intent) throw new Error(intentError?.message ?? 'Payment intent could not be created.');
    const paymentIntent = intent as IntentRow;

    const order = await createCashfreeOrder({
      intentId: paymentIntent.id,
      bookingId,
      bookingReference: booking.booking_reference,
      amountMinor: Number(paymentIntent.amount_minor),
      currency: paymentIntent.currency,
      customerId: session.user_id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: phone,
      returnBaseUrl: publicBaseUrl(),
    });
    if (!order.payment_session_id || !order.order_id) throw new Error('Cashfree checkout session was not returned.');
    if (Math.round(Number(order.order_amount) * 100) !== Number(paymentIntent.amount_minor) || order.order_currency !== paymentIntent.currency) {
      throw new Error('Cashfree order amount or currency did not match the booking payment intent.');
    }

    const service = createSupabaseServiceClient();
    const { error: attachError } = await service.rpc('gateway_attach_payment_session', {
      target_intent_id: paymentIntent.id,
      target_gateway: 'cashfree',
      target_gateway_session_id: order.order_id,
      target_expires_at: order.order_expiry_time ?? null,
    });
    if (attachError) throw new Error(attachError.message);

    return NextResponse.json({
      checkout: {
        provider: 'cashfree',
        mode: config.mode,
        payment_intent_id: paymentIntent.id,
        order_id: order.order_id,
        payment_session_id: order.payment_session_id,
        amount_minor: paymentIntent.amount_minor,
        currency: paymentIntent.currency,
        expires_at: order.order_expiry_time ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout could not be started.' }, { status: 400 });
  }
}
