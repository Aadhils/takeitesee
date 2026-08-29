import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getCashfreeConfig, sha256Hex, verifyCashfreeWebhook } from '../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DisputeWebhookPayload = {
  type?: string | null;
  event_time?: string | null;
  data?: {
    dispute?: {
      dispute_id?: string | number | null;
      dispute_type?: string | null;
      reason_code?: string | number | null;
      reason_description?: string | null;
      dispute_amount?: number | null;
      dispute_amount_currency?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      resolved_at?: string | null;
      respond_by?: string | null;
      dispute_status?: string | null;
      cf_dispute_remarks?: string | null;
      dispute_update?: string | null;
      dispute_action_on?: string | null;
    } | null;
    order_details?: {
      order_id?: string | null;
      order_amount?: number | null;
      order_currency?: string | null;
      cf_payment_id?: string | number | null;
      payment_amount?: number | null;
      payment_currency?: string | null;
    } | null;
    customer_details?: unknown;
  } | null;
};

type WebhookEventRow = { id: string; processing_status: string };

function optionalTimestamp(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
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

  let payload: DisputeWebhookPayload;
  try { payload = JSON.parse(rawBody) as DisputeWebhookPayload; }
  catch { return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }

  const dispute = payload.data?.dispute ?? null;
  const order = payload.data?.order_details ?? null;
  const eventType = String(payload.type ?? 'DISPUTE_UPDATED').trim().toUpperCase();
  const disputeId = String(dispute?.dispute_id ?? '').trim();
  const disputeType = String(dispute?.dispute_type ?? '').trim().toUpperCase();
  const gatewayStatus = String(dispute?.dispute_status ?? '').trim().toUpperCase();
  const orderId = String(order?.order_id ?? '').trim();
  const paymentId = order?.cf_payment_id == null ? '' : String(order.cf_payment_id).trim();
  const currency = String(dispute?.dispute_amount_currency ?? order?.payment_currency ?? order?.order_currency ?? '').trim().toUpperCase();
  const amountMinor = dispute?.dispute_amount == null ? null : Math.round(Number(dispute.dispute_amount) * 100);
  const eventKey = `${eventType}:${disputeId || 'unknown'}:${gatewayStatus || 'UNKNOWN'}`;
  const payloadHash = sha256Hex(rawBody);
  const service = createSupabaseServiceClient();
  let webhookEventId: string | null = null;

  try {
    // Persist only finance-relevant dispute/order fields. Cashfree customer_details contains PII and is intentionally omitted.
    const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: {
        type: eventType,
        event_time: payload.event_time ?? null,
        dispute: dispute ? {
          dispute_id: dispute.dispute_id ?? null,
          dispute_type: dispute.dispute_type ?? null,
          reason_code: dispute.reason_code ?? null,
          reason_description: dispute.reason_description ?? null,
          dispute_amount: dispute.dispute_amount ?? null,
          dispute_amount_currency: dispute.dispute_amount_currency ?? null,
          created_at: dispute.created_at ?? null,
          updated_at: dispute.updated_at ?? null,
          resolved_at: dispute.resolved_at ?? null,
          respond_by: dispute.respond_by ?? null,
          dispute_status: dispute.dispute_status ?? null,
          cf_dispute_remarks: dispute.cf_dispute_remarks ?? null,
          dispute_update: dispute.dispute_update ?? null,
          dispute_action_on: dispute.dispute_action_on ?? null,
        } : null,
        order_details: order ? {
          order_id: order.order_id ?? null,
          order_amount: order.order_amount ?? null,
          order_currency: order.order_currency ?? null,
          cf_payment_id: order.cf_payment_id ?? null,
          payment_amount: order.payment_amount ?? null,
          payment_currency: order.payment_currency ?? null,
        } : null,
      },
      target_payload_sha256: payloadHash,
    }).maybeSingle();
    if (eventError || !webhookEvent) throw new Error(eventError?.message ?? 'Dispute webhook event could not be recorded.');
    const eventRow = webhookEvent as WebhookEventRow;
    webhookEventId = eventRow.id;
    if (eventRow.processing_status === 'processed' || eventRow.processing_status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (!disputeId || !disputeType || !gatewayStatus || !orderId || !paymentId || amountMinor == null || !Number.isFinite(amountMinor) || amountMinor <= 0 || !currency) {
      const { error: exceptionError } = await service.rpc('gateway_upsert_payment_exception', {
        target_exception_key: `dispute-incomplete:${disputeId || eventKey}`,
        target_event_type: eventType,
        target_category: 'gateway_exception',
        target_booking_id: null,
        target_payment_intent_id: null,
        target_gateway_order_id: orderId,
        target_gateway_payment_id: paymentId,
        target_gateway_reference: disputeId,
        target_amount_minor: amountMinor && amountMinor > 0 ? amountMinor : null,
        target_currency: currency === 'INR' || currency === 'USD' ? currency : null,
        target_severity: 'critical',
        target_status: 'open',
        target_summary: 'Incomplete Cashfree dispute webhook',
        target_detail: 'A signed Cashfree dispute webhook was received without enough transaction identity to reconcile automatically.',
        target_payload_sha256: payloadHash,
      });
      if (exceptionError) throw new Error(exceptionError.message);
      const { error: finishError } = await service.rpc('gateway_finish_webhook_event', {
        target_event_id: webhookEventId,
        target_processing_status: 'processed',
        target_processing_error: null,
      });
      if (finishError) throw new Error(finishError.message);
      return NextResponse.json({ received: true, exception: true });
    }

    const { error: applyError } = await service.rpc('gateway_upsert_cashfree_dispute', {
      target_gateway_dispute_id: disputeId,
      target_event_type: eventType,
      target_dispute_type: disputeType,
      target_reason_code: String(dispute?.reason_code ?? ''),
      target_reason_description: String(dispute?.reason_description ?? ''),
      target_amount_minor: amountMinor,
      target_currency: currency,
      target_gateway_status: gatewayStatus,
      target_dispute_action_on: String(dispute?.dispute_action_on ?? '').trim().toUpperCase(),
      target_cf_remarks: dispute?.cf_dispute_remarks ?? null,
      target_respond_by: optionalTimestamp(dispute?.respond_by),
      target_gateway_created_at: optionalTimestamp(dispute?.created_at),
      target_gateway_updated_at: optionalTimestamp(dispute?.updated_at) ?? optionalTimestamp(payload.event_time),
      target_gateway_resolved_at: optionalTimestamp(dispute?.resolved_at),
      target_order_id: orderId,
      target_cf_payment_id: paymentId,
      target_payload_sha256: payloadHash,
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
        target_processing_error: error instanceof Error ? error.message : 'Dispute webhook processing failed.',
      });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dispute webhook processing failed.' }, { status: 500 });
  }
}
