import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getCashfreeConfig, sha256Hex, verifyCashfreeWebhook } from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CashfreeWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number; order_currency?: string };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
      bank_reference?: string;
    };
  };
};

type WebhookEventRow = {
  id: string;
  processing_status: string;
};

function resultFor(payload: CashfreeWebhook): 'succeeded' | 'failed' | 'cancelled' | null {
  const status = payload.data?.payment?.payment_status?.toUpperCase();
  const type = payload.type?.toUpperCase() ?? '';
  if (status === 'SUCCESS' || type.includes('PAYMENT_SUCCESS')) return 'succeeded';
  if (status === 'FAILED' || type.includes('PAYMENT_FAILED')) return 'failed';
  if (status === 'USER_DROPPED' || type.includes('USER_DROPPED')) return 'cancelled';
  return null;
}

export async function POST(request: Request) {
  const config = getCashfreeConfig();
  if (!config.enabled) return NextResponse.json({ error: 'Payment gateway is not configured.' }, { status: 503 });

  const rawBody = await request.text();
  const timestamp = request.headers.get('x-webhook-timestamp') ?? '';
  const signature = request.headers.get('x-webhook-signature') ?? '';
  if (!timestamp || !signature || !verifyCashfreeWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: CashfreeWebhook;
  try { payload = JSON.parse(rawBody) as CashfreeWebhook; }
  catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }

  const orderId = payload.data?.order?.order_id?.trim() ?? '';
  const payment = payload.data?.payment;
  const paymentId = payment?.cf_payment_id == null ? '' : String(payment.cf_payment_id);
  const paymentStatus = payment?.payment_status?.toUpperCase() ?? 'UNKNOWN';
  const eventType = payload.type?.trim() || `CASHFREE_${paymentStatus}`;
  if (!orderId) return NextResponse.json({ error: 'Webhook order id is missing.' }, { status: 400 });

  const eventKey = `${eventType}:${paymentId || orderId}:${paymentStatus}`;
  const service = createSupabaseServiceClient();
  let webhookEventId: string | null = null;

  try {
    const minimalPayload = {
      type: payload.type ?? null,
      event_time: payload.event_time ?? null,
      order: payload.data?.order ?? null,
      payment: payment ? {
        cf_payment_id: payment.cf_payment_id ?? null,
        payment_status: payment.payment_status ?? null,
        payment_amount: payment.payment_amount ?? null,
        payment_currency: payment.payment_currency ?? null,
        payment_message: payment.payment_message ?? null,
        bank_reference: payment.bank_reference ?? null,
      } : null,
    };
    const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: minimalPayload,
      target_payload_sha256: sha256Hex(rawBody),
    }).maybeSingle();
    if (eventError || !webhookEvent) throw new Error(eventError?.message ?? 'Webhook event could not be recorded.');
    const eventRow = webhookEvent as WebhookEventRow;
    webhookEventId = eventRow.id;
    if (eventRow.processing_status === 'processed' || eventRow.processing_status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const { data: intent, error: intentError } = await service
      .from('booking_payment_intents')
      .select('id,amount_minor,currency,status')
      .eq('gateway', 'cashfree')
      .eq('gateway_session_id', orderId)
      .maybeSingle();
    if (intentError) throw new Error(intentError.message);
    if (!intent) {
      await service.rpc('gateway_finish_webhook_event', { target_event_id: webhookEventId, target_processing_status: 'ignored', target_processing_error: 'No matching Takeitesee payment intent.' });
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = resultFor(payload);
    if (!result) {
      await service.rpc('gateway_finish_webhook_event', { target_event_id: webhookEventId, target_processing_status: 'ignored', target_processing_error: `Unhandled payment status ${paymentStatus}.` });
      return NextResponse.json({ received: true, ignored: true });
    }

    if (payment?.payment_amount != null && Math.round(Number(payment.payment_amount) * 100) !== Number(intent.amount_minor)) {
      throw new Error('Webhook payment amount does not match the Takeitesee payment intent.');
    }
    if (payment?.payment_currency && payment.payment_currency !== intent.currency) {
      throw new Error('Webhook payment currency does not match the Takeitesee payment intent.');
    }

    const { error: applyError } = await service.rpc('gateway_apply_payment_result', {
      target_intent_id: intent.id,
      result_status: result,
      target_gateway_payment_id: paymentId || null,
      result_code: result === 'failed' ? paymentStatus : null,
      result_message: payment?.payment_message ?? null,
    });
    if (applyError) throw new Error(applyError.message);

    const { error: finishError } = await service.rpc('gateway_finish_webhook_event', {
      target_event_id: webhookEventId,
      target_processing_status: 'processed',
      target_processing_error: null,
    });
    if (finishError) throw new Error(finishError.message);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (webhookEventId) {
      await service.rpc('gateway_finish_webhook_event', {
        target_event_id: webhookEventId,
        target_processing_status: 'failed',
        target_processing_error: error instanceof Error ? error.message : 'Webhook processing failed.',
      });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, { status: 500 });
  }
}
