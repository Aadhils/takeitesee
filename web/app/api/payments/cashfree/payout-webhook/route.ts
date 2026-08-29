import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createSupabaseServiceClient } from '../../../../../lib/supabase/service';
import { getCashfreePayoutConfig, verifyCashfreePayoutWebhook } from '../../../../../server/payments/cashfree-payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PayoutWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    transfer_id?: string;
    cf_transfer_id?: string;
    status?: string;
    status_code?: string;
    status_description?: string;
    transfer_amount?: number;
    transfer_mode?: string;
    transfer_utr?: string;
    fundsource_id?: string;
    updated_on?: string;
    beneficiary_details?: { beneficiary_id?: string };
  };
};

export async function POST(request: Request) {
  const config = getCashfreePayoutConfig();
  if (!config.enabled) return NextResponse.json({ error: 'Payout gateway is not configured.' }, { status: 503 });
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-webhook-timestamp') ?? '';
  const signature = request.headers.get('x-webhook-signature') ?? '';
  if (!timestamp || !signature || !verifyCashfreePayoutWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid payout webhook signature.' }, { status: 401 });
  }

  let payload: PayoutWebhook;
  try { payload = JSON.parse(rawBody) as PayoutWebhook; }
  catch { return NextResponse.json({ error: 'Invalid payout webhook payload.' }, { status: 400 }); }

  const data = payload.data;
  const transferId = data?.transfer_id?.trim() ?? '';
  const status = data?.status?.trim().toUpperCase() ?? '';
  const statusCode = data?.status_code?.trim().toUpperCase() ?? '';
  const eventType = payload.type?.trim() || 'PAYOUT_TRANSFER_UPDATE';
  if (!transferId || !status) return NextResponse.json({ error: 'Payout webhook transfer data is incomplete.' }, { status: 400 });

  const eventKey = `${eventType}:${transferId}:${status}:${statusCode}:${data?.updated_on ?? payload.event_time ?? ''}`.slice(0, 240);
  const service = createSupabaseServiceClient();
  let webhookEventId: string | null = null;
  try {
    const sanitizedPayload = {
      type: eventType,
      event_time: payload.event_time ?? null,
      transfer_id: transferId,
      cf_transfer_id: data?.cf_transfer_id ?? null,
      status,
      status_code: statusCode || null,
      status_description: data?.status_description ?? null,
      transfer_amount: data?.transfer_amount ?? null,
      transfer_mode: data?.transfer_mode ?? null,
      transfer_utr: data?.transfer_utr ?? null,
      fundsource_id: data?.fundsource_id ?? null,
      beneficiary_id: data?.beneficiary_details?.beneficiary_id ?? null,
      updated_on: data?.updated_on ?? null,
    };
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const { data: webhookEvent, error: eventError } = await service.rpc('gateway_record_webhook_event', {
      target_gateway: 'cashfree_payout',
      target_gateway_event_id: eventKey,
      target_event_type: eventType,
      target_payload: sanitizedPayload,
      target_payload_sha256: payloadHash,
    }).maybeSingle();
    if (eventError || !webhookEvent) throw new Error(eventError?.message ?? 'Payout webhook event could not be recorded.');
    const eventRow = webhookEvent as { id: string; processing_status: string };
    webhookEventId = eventRow.id;
    if (eventRow.processing_status === 'processed' || eventRow.processing_status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const { data: batch, error: batchError } = await service.from('provider_payout_batches')
      .select('id,provider_net_minor,payout_destination_id,transfer_id')
      .eq('transfer_id', transferId).eq('gateway', 'cashfree_payout').maybeSingle();
    if (batchError) throw new Error(batchError.message);
    if (!batch) {
      await service.rpc('gateway_finish_webhook_event', { target_event_id: webhookEventId, target_processing_status: 'ignored', target_processing_error: 'No matching provider payout batch.' });
      return NextResponse.json({ received: true, ignored: true });
    }

    if (data?.transfer_amount != null && Math.round(Number(data.transfer_amount) * 100) !== Number(batch.provider_net_minor)) {
      throw new Error('Payout webhook amount does not match the provider payout batch.');
    }
    const webhookBeneficiary = data?.beneficiary_details?.beneficiary_id?.trim();
    if (webhookBeneficiary && batch.payout_destination_id) {
      const { data: destination, error: destinationError } = await service.from('provider_payout_destinations')
        .select('gateway_beneficiary_id').eq('id', batch.payout_destination_id).maybeSingle();
      if (destinationError) throw new Error(destinationError.message);
      if (!destination || destination.gateway_beneficiary_id !== webhookBeneficiary) throw new Error('Payout webhook beneficiary does not match the provider payout destination.');
    }

    const { error: applyError } = await service.rpc('gateway_apply_provider_payout_transfer_status', {
      target_batch_id: batch.id,
      target_gateway_status: status,
      target_gateway_status_code: statusCode,
      target_gateway_status_description: data?.status_description ?? null,
      target_gateway_transfer_id: data?.cf_transfer_id ?? null,
      target_transfer_utr: data?.transfer_utr ?? null,
    });
    if (applyError) throw new Error(applyError.message);
    const { error: finishError } = await service.rpc('gateway_finish_webhook_event', {
      target_event_id: webhookEventId, target_processing_status: 'processed', target_processing_error: null,
    });
    if (finishError) throw new Error(finishError.message);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (webhookEventId) {
      await service.rpc('gateway_finish_webhook_event', {
        target_event_id: webhookEventId,
        target_processing_status: 'failed',
        target_processing_error: error instanceof Error ? error.message : 'Payout webhook processing failed.',
      });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payout webhook processing failed.' }, { status: 500 });
  }
}