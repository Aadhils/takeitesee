import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import { createCashfreeRefund, fetchCashfreeRefund, getCashfreeConfig, type CashfreeRefund } from '../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RefundRow = {
  id: string;
  booking_id: string;
  payment_intent_id: string;
  attempt_no: number;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  refund_id: string;
  gateway_refund_id: string | null;
  amount_minor: number;
  currency: string;
  status: 'created' | 'pending' | 'onhold' | 'succeeded' | 'failed' | 'cancelled' | 'requires_review';
  reason: string;
  status_description: string | null;
  refund_arn: string | null;
  requested_speed: string;
  accepted_speed: string | null;
  processed_speed: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  bookings?: unknown;
};

async function requireFinanceManage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc('admin_list_finance_overview');
  if (error) throw new Error(error.message);
}

function bookingRelation(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : null;
}

function safeRefund(row: RefundRow) {
  const booking = bookingRelation(row.bookings);
  return {
    id: row.id,
    booking_id: row.booking_id,
    booking_reference: String(booking?.booking_reference ?? row.booking_id.slice(0, 8)),
    service_name: String(booking?.service_name_snapshot ?? 'Service booking'),
    booking_status: String(booking?.status ?? ''),
    payment_status: String(booking?.payment_status ?? ''),
    attempt_no: row.attempt_no,
    refund_id: row.refund_id,
    amount_minor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    status_description: row.status_description,
    refund_arn: row.refund_arn,
    requested_speed: row.requested_speed,
    accepted_speed: row.accepted_speed,
    processed_speed: row.processed_speed,
    processed_at: row.processed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assertGatewayRefundMatches(row: RefundRow, refund: CashfreeRefund) {
  if (refund.refund_id !== row.refund_id) throw new Error('Cashfree returned a different refund id.');
  if (refund.order_id !== row.gateway_order_id) throw new Error('Cashfree refund order does not match the Takeitesee payment.');
  if (Math.round(Number(refund.refund_amount) * 100) !== Number(row.amount_minor)) throw new Error('Cashfree refund amount does not match the Takeitesee refund.');
  if (refund.refund_currency !== row.currency) throw new Error('Cashfree refund currency does not match the Takeitesee refund.');
  if (row.gateway_payment_id && refund.cf_payment_id != null && String(refund.cf_payment_id) !== row.gateway_payment_id) {
    throw new Error('Cashfree refund payment reference does not match the Takeitesee payment.');
  }
}

async function applyGatewayRefund(row: RefundRow, refund: CashfreeRefund) {
  assertGatewayRefundMatches(row, refund);
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc('gateway_apply_booking_refund_result', {
    target_refund_id: row.id,
    target_gateway_status: refund.refund_status,
    target_gateway_refund_id: refund.cf_refund_id == null ? null : String(refund.cf_refund_id),
    target_status_description: refund.status_description ?? refund.refund_speed?.message ?? null,
    target_refund_arn: refund.refund_arn ?? null,
    target_accepted_speed: refund.refund_speed?.accepted ?? null,
    target_processed_speed: refund.refund_speed?.processed ?? null,
    target_processed_at: refund.processed_at ?? null,
  }).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Refund status could not be reconciled.');
  return data as RefundRow;
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);
    const service = createSupabaseServiceClient();
    const { data, error } = await service.from('booking_refunds')
      .select('*,bookings(booking_reference,service_name_snapshot,status,payment_status)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const config = getCashfreeConfig();
    return NextResponse.json({
      refunds: ((data ?? []) as RefundRow[]).map(safeRefund),
      gateway: { enabled: config.enabled, provider: 'cashfree', mode: config.mode },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load refund queue.';
    return NextResponse.json({ error: message }, { status: /permission|authentication/i.test(message) ? 403 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);
    const input = await request.json() as { refund_id?: string };
    const id = input.refund_id?.trim() ?? '';
    if (!id) return NextResponse.json({ error: 'Refund is required.' }, { status: 400 });

    const config = getCashfreeConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Cashfree payment gateway is not configured.' }, { status: 503 });
    const service = createSupabaseServiceClient();
    const { data, error } = await service.from('booking_refunds').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as RefundRow | null;
    if (!row) return NextResponse.json({ error: 'Refund was not found.' }, { status: 404 });
    if (row.status === 'requires_review') return NextResponse.json({ error: 'This refund requires provider-payout recovery review before gateway processing.' }, { status: 409 });
    if (row.status === 'succeeded') return NextResponse.json({ refund: safeRefund(row) });
    if (row.status === 'failed' || row.status === 'cancelled') return NextResponse.json({ error: 'This refund attempt is terminal. Open the booking to create a new refund attempt.' }, { status: 409 });

    try {
      const gatewayRefund = row.status === 'created'
        ? await createCashfreeRefund({ orderId: row.gateway_order_id, refundId: row.refund_id, amountMinor: Number(row.amount_minor), note: row.reason, speed: 'STANDARD' })
        : await fetchCashfreeRefund(row.gateway_order_id, row.refund_id);
      const saved = await applyGatewayRefund(row, gatewayRefund);
      return NextResponse.json({ refund: safeRefund(saved) });
    } catch (submitError) {
      try {
        const recovered = await fetchCashfreeRefund(row.gateway_order_id, row.refund_id);
        const saved = await applyGatewayRefund(row, recovered);
        return NextResponse.json({ refund: safeRefund(saved), recovered: true });
      } catch {
        return NextResponse.json({
          error: 'Refund state remains uncertain. Do not create another refund; retry reconciliation for this same refund ID.',
          code: 'REFUND_STATUS_UNCERTAIN',
          refund: safeRefund(row),
          detail: submitError instanceof Error ? submitError.message : 'Cashfree did not return a confirmed refund state.',
        }, { status: 202 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund could not be reconciled.';
    return NextResponse.json({ error: message }, { status: /permission|authentication/i.test(message) ? 403 : 400 });
  }
}
