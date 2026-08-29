import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../../../lib/supabase/service';
import {
  createCashfreeRefund,
  fetchCashfreeRefund,
  getCashfreeConfig,
  type CashfreeRefund,
} from '../../../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ bookingId: string }> };
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
};

function safeRefund(row: RefundRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    attempt_no: row.attempt_no,
    gateway: row.gateway,
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

async function requireFinanceManage(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc('admin_list_finance_overview');
  if (error) throw new Error(error.message);
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

async function loadLatestRefund(bookingId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase.from('booking_refunds')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as RefundRow | null;
}

function errorStatus(message: string) {
  return /permission|authentication|required/i.test(message) ? 403 : 400;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);
    const refund = await loadLatestRefund(bookingId, supabase);
    const config = getCashfreeConfig();
    return NextResponse.json({ authorized: true, refund: safeRefund(refund), gateway: { enabled: config.enabled, mode: config.mode, provider: 'cashfree' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load refund state.';
    return NextResponse.json({ authorized: false, error: message }, { status: errorStatus(message) });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { bookingId } = await context.params;
    const input = await request.json() as { reason?: string };
    const reason = input.reason?.trim() ?? '';
    if (reason.length < 3 || reason.length > 100) return NextResponse.json({ error: 'Refund reason must be 3 to 100 characters.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);
    const { data, error } = await supabase.rpc('admin_create_booking_refund_request', {
      target_booking_id: bookingId,
      refund_reason: reason,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Refund request could not be created.');
    let refundRow = data as RefundRow;

    if (refundRow.status === 'requires_review') {
      return NextResponse.json({
        refund: safeRefund(refundRow),
        requires_review: true,
        message: 'Provider payout has already reached a protected transfer state. No customer refund was sent; finance recovery review is required first.',
      });
    }
    if (refundRow.status === 'succeeded') return NextResponse.json({ refund: safeRefund(refundRow) });

    const config = getCashfreeConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: 'Cashfree payment gateway is not configured. The refund request is reserved but has not been sent.', refund: safeRefund(refundRow) }, { status: 503 });
    }

    try {
      const gatewayRefund = refundRow.status === 'created'
        ? await createCashfreeRefund({
            orderId: refundRow.gateway_order_id,
            refundId: refundRow.refund_id,
            amountMinor: Number(refundRow.amount_minor),
            note: refundRow.reason,
            speed: 'STANDARD',
          })
        : await fetchCashfreeRefund(refundRow.gateway_order_id, refundRow.refund_id);
      refundRow = await applyGatewayRefund(refundRow, gatewayRefund);
      return NextResponse.json({ refund: safeRefund(refundRow) });
    } catch (submitError) {
      try {
        const recovered = await fetchCashfreeRefund(refundRow.gateway_order_id, refundRow.refund_id);
        refundRow = await applyGatewayRefund(refundRow, recovered);
        return NextResponse.json({ refund: safeRefund(refundRow), recovered: true });
      } catch {
        return NextResponse.json({
          error: 'Refund submission status is uncertain. Do not create another refund; refresh this same refund status.',
          code: 'REFUND_STATUS_UNCERTAIN',
          refund: safeRefund(refundRow),
          detail: submitError instanceof Error ? submitError.message : 'Cashfree refund request did not return a confirmed state.',
        }, { status: 202 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund request could not be completed.';
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const { bookingId } = await context.params;
    const supabase = await createSupabaseServerClient();
    await requireFinanceManage(supabase);
    const refundRow = await loadLatestRefund(bookingId, supabase);
    if (!refundRow) return NextResponse.json({ error: 'No refund exists for this booking.' }, { status: 404 });
    if (refundRow.status === 'requires_review') return NextResponse.json({ error: 'This refund requires finance recovery review before any gateway action.' }, { status: 409 });
    if (refundRow.status === 'succeeded') return NextResponse.json({ refund: safeRefund(refundRow) });

    const config = getCashfreeConfig();
    if (!config.enabled) return NextResponse.json({ error: 'Cashfree payment gateway is not configured.' }, { status: 503 });
    const gatewayRefund = await fetchCashfreeRefund(refundRow.gateway_order_id, refundRow.refund_id);
    const saved = await applyGatewayRefund(refundRow, gatewayRefund);
    return NextResponse.json({ refund: safeRefund(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund status could not be refreshed.';
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
