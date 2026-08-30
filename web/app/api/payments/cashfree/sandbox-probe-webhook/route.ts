import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getCashfreeConfig, sha256Hex, verifyCashfreeWebhook } from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProbeWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number; order_currency?: string };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
    };
  };
};

type ProbeRun = {
  id: string;
  amount_minor: number;
  currency: string;
};

type WebhookEvent = {
  id: string;
  processing_status: string;
};

function stateFor(status: string) {
  if (status === 'SUCCESS') return 'payment_succeeded';
  if (status === 'FAILED') return 'payment_failed';
  if (status === 'USER_DROPPED') return 'user_dropped';
  return 'webhook_received';
}

export async function POST(request: Request) {
  const config = getCashfreeConfig();
  if (config.mode !== 'sandbox') return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!config.enabled) return NextResponse.json({ error: 'Sandbox gateway is not configured.' }, { status: 503 });

  const rawBody = await request.text();
  const timestamp = request.headers.get('x-webhook-timestamp') ?? '';
  const signature = request.headers.get('x-webhook-signature') ?? '';
  if (!timestamp || !signature || !verifyCashfreeWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: ProbeWebhook;
  try { payload = JSON.parse(rawBody) as ProbeWebhook; }
  catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }

  const order = payload.data?.order;
  const payment = payload.data?.payment;
  const orderId = order?.order_id?.trim() ?? '';
  const paymentId = payment?.cf_payment_id == null ? '' : String(payment.cf_payment_id);
  const paymentStatus = payment?.payment_status?.trim().toUpperCase() || 'UNKNOWN';
  const eventType = payload.type?.trim() || `CASHFREE_SANDBOX_${paymentStatus}`;
  if (!orderId.startsWith('tis_probe_')) return NextResponse.json({ received: true, ignored: true });

  const service = createSupabaseServiceClient();
  const { data: runData, error: runError } = await service
    .from('cashfree_sandbox_e2e_runs')
    .select('id,amount_minor,currency')
    .eq('order_id', orderId)
    .maybeSingle();
  if (runError) return NextResponse.json({ error: 'Sandbox probe could not be loaded.' }, { status: 500 });
  if (!runData) return NextResponse.json({ received: true, ignored: true });
  const run = runData as ProbeRun;

  const eventKey = `${eventType}:${paymentId || orderId}:${paymentStatus}`;
  const minimalPayload = {
    type: payload.type ?? null,
    event_time: payload.event_time ?? null,
    order: order ? {
      order_id: order.order_id ?? null,
      order_amount: order.order_amount ?? null,
      order_currency: order.order_currency ?? null,
    } : null,
    payment: payment ? {
      cf_payment_id: payment.cf_payment_id ?? null,
      payment_status: payment.payment_status ?? null,
      payment_amount: payment.payment_amount ?? null,
      payment_currency: payment.payment_currency ?? null,
    } : null,
  };

  let webhookEventId: string | null = null;
  try {
    const { data: eventData, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree_sandbox_probe',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: minimalPayload,
      target_payload_sha256: sha256Hex(rawBody),
    }).maybeSingle();
    if (eventError || !eventData) throw new Error(eventError?.message ?? 'Sandbox webhook event could not be recorded.');
    const event = eventData as WebhookEvent;
    webhookEventId = event.id;
    if (event.processing_status === 'processed' || event.processing_status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const amountMatches = payment?.payment_amount == null
      || Math.round(Number(payment.payment_amount) * 100) === Number(run.amount_minor);
    const currencyMatches = !payment?.payment_currency || payment.payment_currency === run.currency;
    const orderAmountMatches = order?.order_amount == null
      || Math.round(Number(order.order_amount) * 100) === Number(run.amount_minor);
    const orderCurrencyMatches = !order?.order_currency || order.order_currency === run.currency;
    const mismatch = !amountMatches || !currencyMatches || !orderAmountMatches || !orderCurrencyMatches;

    const { error: updateError } = await service
      .from('cashfree_sandbox_e2e_runs')
      .update({
        state: mismatch ? 'mismatch' : stateFor(paymentStatus),
        gateway_payment_id: paymentId || null,
        gateway_payment_status: paymentStatus,
        webhook_event_id: webhookEventId,
        webhook_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error_code: mismatch ? 'gateway_amount_or_currency_mismatch' : null,
      })
      .eq('id', run.id);
    if (updateError) throw new Error(updateError.message);

    const { error: finishError } = await service.rpc('gateway_finish_webhook_event', {
      target_event_id: webhookEventId,
      target_processing_status: mismatch ? 'failed' : 'processed',
      target_processing_error: mismatch ? 'Sandbox probe amount or currency did not match the expected run.' : null,
    });
    if (finishError) throw new Error(finishError.message);

    return NextResponse.json({ received: true, sandbox_probe: true, matched: !mismatch });
  } catch (error) {
    if (webhookEventId) {
      await service.rpc('gateway_finish_webhook_event', {
        target_event_id: webhookEventId,
        target_processing_status: 'failed',
        target_processing_error: error instanceof Error ? error.message : 'Sandbox webhook processing failed.',
      });
    }
    return NextResponse.json({ error: 'Sandbox webhook processing failed.' }, { status: 500 });
  }
}
