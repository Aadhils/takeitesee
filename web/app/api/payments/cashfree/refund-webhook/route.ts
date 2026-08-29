import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getCashfreeConfig, sha256Hex, verifyCashfreeWebhook } from '../../../../../server/payments/cashfree';

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

function processedSpeed(payload: RefundPayload) {
  return payload.processed_speed == null ? null : String(payload.processed_speed);
}

function minimalRefund(payload: RefundPayload | null) {
  if (!payload) return null;
  return {
    cf_refund_id: payload.cf_refund_id ?? null,
    cf_payment_id: payload.cf_payment_id ?? null,
    refund_id: payload.refund_id ?? null,
    order_id: payload.order_id ?? null,
    refund_amount: payload.refund_amount ?? null,
    refund_currency: payload.refund_currency ?? null,
    refund_status: payload.refund_status ?? null,
    status_description: payload.status_description ?? null,
    refund_arn: payload.refund_arn ?? null,
    processed_at: payload.processed_at ?? null,
    requested_speed: payload.requested_speed ?? null,
    processed_speed: payload.processed_speed ?? null,
  };
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
  const autoRefund = payload.data?.auto_refund ?? null;
  const service = createSupabaseServiceClient();
  const eventType = String(payload.type ?? 'REFUND_STATUS_WEBHOOK').trim() || 'REFUND_STATUS_WEBHOOK';

  if (!refund) {
    const identity = autoRefund?.refund_id ?? autoRefund?.cf_refund_id ?? autoRefund?.order_id ?? 'unknown';
    const status = String(autoRefund?.refund_status ?? 'UNKNOWN').toUpperCase();
    const eventKey = `${eventType}:auto:${String(identity)}:${status}`;
    try {
      const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
        target_gateway: 'cashfree',
        target_gateway_event_id: eventKey,
        target_event_type: eventType,
        target_payload: {
          type: payload.type ?? null,
          event_time: payload.event_time ?? null,
          refund: null,
          auto_refund: minimalRefund(autoRefund),
        },
        target_payload_sha256: sha256Hex(rawBody),
      }).maybeSingle();
      if (eventError || !webhookEvent) throw new Error(eventError?.message ?? 'Auto-refund webhook event could not be recorded.');
      const row = webhookEvent as WebhookEventRow;
      if (row.processing_status !== 'processed' && row.processing_status !== 'ignored') {
        const { error: finishError } = await service.rpc('gateway_finish_webhook_event', {
          target_event_id: row.id,
          target_processing_status: 'ignored',
          target_processing_error: 'Cashfree auto-refund requires reconciliation-exception handling and was not mapped to a merchant refund.',
        });
        if (finishError) throw new Error(finishError.message);
      }
      return NextResponse.json({ received: true, ignored: true, auto_refund: Boolean(autoRefund) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Auto-refund webhook auditing failed.' }, { status: 500 });
    }
  }

  const refundId = String(refund.refund_id ?? '').trim();
  const orderId = String(refund.order_id ?? '').trim();
  const status = String(refund.refund_status ?? '').trim().toUpperCase();
  const cfRefundId = refund.cf_refund_id == null ? '' : String(refund.cf_refund_id);
  const cfPaymentId = refund.cf_payment_id == null ? '' : String(refund.cf_payment_id);
  if (!refundId || !orderId || !status) return NextResponse.json({ error: 'Refund webhook identity is incomplete.' }, { status: 400 });

  const eventKey = `${eventType}:${refundId}:${status}:${cfRefundId || 'none'}`;
  let webhookEventId: string | null = null;

  try {
    const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: {
        type: payload.type ?? null,
        event_time: payload.event_time ?? null,
        refund: minimalRefund(refund),
      },
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
      target_accepted_speed: null,
      target_processed_speed: processedSpeed(refund),
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
