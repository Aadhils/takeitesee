import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../../../lib/supabase/service';
import { getCashfreeConfig, sha256Hex, verifyCashfreeWebhook } from '../../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RefundPayload = {
  cf_refund_id?: string | number | null;
  cf_payment_id?: string | number | null;
  refund_id?: string | null;
  order_id?: string | null;
  refund_amount?: number | null;
  refund_currency?: string | null;
  refund_status?: string | null;
  status_description?: string | null;
  refund_arn?: string | null;
  processed_at?: string | null;
  requested_speed?: string | null;
  processed_speed?: string | null;
};

type CashfreeRefundWebhook = {
  type?: string | null;
  event_time?: string | null;
  data?: {
    refund?: RefundPayload | null;
    auto_refund?: RefundPayload | null;
  } | null;
};

type WebhookEventRow = { id: string; processing_status: string };
type RefundRow = {
  id: string;
  payment_intent_id: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  refund_id: string;
  amount_minor: number;
  currency: string;
  status: string;
};

function speedFrom(payload: RefundPayload, key: 'requested_speed' | 'processed_speed') {
  const value = payload[key];
  return value == null ? null : String(value);
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

  let payload: CashfreeRefundWebhook;
  try { payload = JSON.parse(rawBody) as CashfreeRefundWebhook; }
  catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }

  const refund = payload.data?.refund ?? null;
  if (!refund) {
    // Cashfree auto-refunds are intentionally not mapped into a merchant-initiated refund record.
    // They are still acknowledged here; a later reconciliation module can ingest them separately.
    return NextResponse.json({ received: true, ignored: true, reason: 'No merchant refund payload.' });
  }

  const refundId = String(refund.refund_id ?? '').trim();
  const orderId = String(refund.order_id ?? '').trim();
  const status = String(refund.refund_status ?? '').trim().toUpperCase();
  const cfRefundId = refund.cf_refund_id == null ? '' : String(refund.cf_refund_id);
  const cfPaymentId = refund.cf_payment_id == null ? '' : String(refund.cf_payment_id);
  const eventType = String(payload.type ?? 'REFUND_STATUS_WEBHOOK').trim() || 'REFUND_STATUS_WEBHOOK';
  if (!refundId || !orderId || !status) return NextResponse.json({ error: 'Refund webhook identity is incomplete.' }, { status: 400 });

  const service = createSupabaseServiceClient();
  const eventKey = `${eventType}:${refundId}:${status}:${cfRefundId || 'none'}`;
  let webhookEventId: string | null = null;

  try {
    const minimalPayload = {
      type: payload.type ?? null,
      event_time: payload.event_time ?? null,
      refund: {
        cf_refund_id: refund.cf_refund_id ?? null,
        cf_payment_id: refund.cf_payment_id ?? null,
        refund_id: refund.refund_id ?? null,
        order_id: refund.order_id ?? null,
        refund_amount: refund.refund_amount ?? null,
        refund_currency: refund.refund_currency ?? null,
        refund_status: refund.refund_status ?? null,
        status_description: refund.status_description ?? null,
        refund_arn: refund.refund_arn ?? null,
        processed_at: refund.processed_at ?? null,
        requested_speed: refund.requested_speed ?? null,
        processed_speed: refund.processed_speed ?? null,
      },
    };
    const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: minimalPayload,
      target_payload_sha256: sha256Hex(rawBody),
    }).maybeSingle();
    if (eventError || !webhookEvent) throw new Error(eventError?.message ?? 'Refund webhook event could not be recorded.');
    const eventRow = webhookEvent as WebhookEventRow;
    webhookEventId = eventRow.id;
    if (eventRow.processing_status === 'processed' || eventRow.processing_status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const { data: refundData, error: refundError } = await service.from('booking_refunds')
      .select('id,payment_intent_id,gateway_order_id,gateway_payment_id,refund_id,amount_minor,currency,status')
      .eq('gateway', 'cashfree')
      .eq('refund_id', refundId)
      .maybeSingle();
    if (refundError) throw new Error(refundError.message);
    const refundRow = refundData as RefundRow | null;
    if (!refundRow) {
      await service.rpc('gateway_finish_webhook_event', {
        target_event_id: webhookEventId,
        target_processing_status: 'ignored',
        target_processing_error: 'No matching Takeitesee merchant refund.',
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    if (refundRow.gateway_order_id !== orderId) throw new Error('Refund webhook order does not match the Takeitesee refund.');
    if (refund.refund_amount != null && Math.round(Number(refund.refund_amount) * 100) !== Number(refundRow.amount_minor)) {
      throw new Error('Refund webhook amount does not match the Takeitesee refund.');
    }
    if (refund.refund_currency && refund.refund_currency !== refundRow.currency) {
      throw new Error('Refund webhook currency does not match the Takeitesee refund.');
    }
    if (refundRow.gateway_payment_id && cfPaymentId && refundRow.gateway_payment_id !== cfPaymentId) {
      throw new Error('Refund webhook payment reference does not match the Takeitesee payment.');
    }

    const { error: applyError } = await service.rpc('gateway_apply_booking_refund_result', {
      target_refund_id: refundRow.id,
      target_gateway_status: status,
      target_gateway_refund_id: cfRefundId || null,
      target_status_description: refund.status_description ?? null,
      target_refund_arn: refund.refund_arn ?? null,
      target_accepted_speed: speedFrom(refund, 'requested_speed'),
      target_processed_speed: speedFrom(refund, 'processed_speed'),
      target_processed_at: refund.processed_at ?? null,
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
        target_processing_error: error instanceof Error ? error.message : 'Refund webhook processing failed.',
      });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Refund webhook processing failed.' }, { status: 500 });
  }
}
