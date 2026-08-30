import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  CashfreeApiError,
  createCashfreeSandboxProbeOrder,
  fetchCashfreeOrder,
  fetchCashfreePayments,
  getCashfreeConfig,
  type CashfreePayment,
} from '../../../../server/payments/cashfree';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROBE_AMOUNT_MINOR = 100;

type ProbeAction = {
  action?: 'create_checkout_probe' | 'verify_probe';
  run_id?: string;
};

type ProbeRun = {
  id: string;
  order_id: string;
  amount_minor: number;
  currency: string;
  state: string;
  gateway_order_status: string | null;
  gateway_payment_id: string | null;
  gateway_payment_status: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  webhook_received_at: string | null;
  verified_at: string | null;
};

async function requireSuperAdmin(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  if (!session.roles.includes('super_admin')) {
    return { response: NextResponse.json({ error: 'Super Admin permission required.' }, { status: 403 }) } as const;
  }
  return { session } as const;
}

function newestPayment(payments: CashfreePayment[]) {
  const success = payments.find((payment) => payment.payment_status?.toUpperCase() === 'SUCCESS');
  if (success) return success;
  return [...payments].sort((a, b) => {
    const aTime = Date.parse(a.payment_completion_time || a.payment_time || '') || 0;
    const bTime = Date.parse(b.payment_completion_time || b.payment_time || '') || 0;
    return bTime - aTime;
  })[0] ?? null;
}

function verifiedState(orderStatus: string, paymentStatus: string | null) {
  const order = orderStatus.toUpperCase();
  const payment = paymentStatus?.toUpperCase() ?? '';
  if (order === 'PAID' || payment === 'SUCCESS') return 'verified_success';
  if (payment === 'FAILED') return 'verified_failure';
  if (payment === 'USER_DROPPED') return 'verified_user_dropped';
  return 'verified_pending';
}

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ('response' in auth) return auth.response;

  const config = getCashfreeConfig();
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from('cashfree_sandbox_e2e_runs')
    .select('id,order_id,amount_minor,currency,state,gateway_order_status,gateway_payment_id,gateway_payment_status,last_error_code,created_at,updated_at,webhook_received_at,verified_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: 'Sandbox E2E runs could not be loaded.' }, { status: 500 });

  return NextResponse.json({
    gateway: {
      provider: 'cashfree',
      enabled: config.enabled,
      mode: config.mode,
      checkout_probe_available: config.enabled && config.mode === 'sandbox',
    },
    probe: {
      amount_minor: PROBE_AMOUNT_MINOR,
      currency: 'INR',
      isolated_from_booking_finance: true,
    },
    runs: (data ?? []) as ProbeRun[],
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ('response' in auth) return auth.response;

  let input: ProbeAction;
  try { input = await request.json() as ProbeAction; }
  catch { return NextResponse.json({ error: 'A valid JSON request body is required.' }, { status: 400 }); }

  const config = getCashfreeConfig();
  if (config.mode !== 'sandbox') {
    return NextResponse.json({ error: 'Controlled E2E probes are hard-blocked outside Cashfree sandbox mode.' }, { status: 409 });
  }
  if (!config.enabled) {
    return NextResponse.json({ error: 'Cashfree sandbox configuration is incomplete.', missing: config.missing }, { status: 409 });
  }

  const service = createSupabaseServiceClient();

  if (input.action === 'create_checkout_probe') {
    const runId = randomUUID();
    const orderId = `tis_probe_${runId.replaceAll('-', '')}`;
    const now = new Date().toISOString();
    const { error: insertError } = await service.from('cashfree_sandbox_e2e_runs').insert({
      id: runId,
      order_id: orderId,
      amount_minor: PROBE_AMOUNT_MINOR,
      currency: 'INR',
      state: 'creating',
      created_by: auth.session.user_id,
      created_at: now,
      updated_at: now,
    });
    if (insertError) return NextResponse.json({ error: 'Sandbox probe run could not be created.' }, { status: 500 });

    try {
      const order = await createCashfreeSandboxProbeOrder({
        probeRunId: runId,
        orderId,
        amountMinor: PROBE_AMOUNT_MINOR,
        returnBaseUrl: new URL(request.url).origin,
      });
      if (Math.round(Number(order.order_amount) * 100) !== PROBE_AMOUNT_MINOR || order.order_currency !== 'INR' || order.order_id !== orderId) {
        await service.from('cashfree_sandbox_e2e_runs').update({
          state: 'mismatch',
          last_error_code: 'created_order_identity_mismatch',
          gateway_order_status: order.order_status,
          updated_at: new Date().toISOString(),
        }).eq('id', runId);
        return NextResponse.json({ error: 'Cashfree sandbox order did not match the controlled probe.' }, { status: 502 });
      }

      await service.from('cashfree_sandbox_e2e_runs').update({
        state: 'ready_for_checkout',
        gateway_order_status: order.order_status,
        last_error_code: null,
        updated_at: new Date().toISOString(),
      }).eq('id', runId);

      return NextResponse.json({
        run: { id: runId, order_id: orderId, state: 'ready_for_checkout', amount_minor: PROBE_AMOUNT_MINOR, currency: 'INR' },
        checkout: { provider: 'cashfree', mode: 'sandbox', payment_session_id: order.payment_session_id },
      });
    } catch (cause) {
      const code = cause instanceof CashfreeApiError ? `cashfree_http_${cause.httpStatus}` : 'cashfree_create_failed';
      await service.from('cashfree_sandbox_e2e_runs').update({
        state: 'failed',
        last_error_code: code,
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
      return NextResponse.json({ error: 'Cashfree sandbox checkout probe could not be created.', code }, { status: 502 });
    }
  }

  if (input.action === 'verify_probe') {
    const runId = input.run_id?.trim() ?? '';
    if (!runId) return NextResponse.json({ error: 'Sandbox probe run is required.' }, { status: 400 });

    const { data: runData, error: runError } = await service
      .from('cashfree_sandbox_e2e_runs')
      .select('id,order_id,amount_minor,currency,state,gateway_order_status,gateway_payment_id,gateway_payment_status,last_error_code,created_at,updated_at,webhook_received_at,verified_at')
      .eq('id', runId)
      .maybeSingle();
    if (runError) return NextResponse.json({ error: 'Sandbox probe run could not be loaded.' }, { status: 500 });
    if (!runData) return NextResponse.json({ error: 'Sandbox probe run was not found.' }, { status: 404 });
    const run = runData as ProbeRun;

    try {
      const [order, payments] = await Promise.all([
        fetchCashfreeOrder(run.order_id),
        fetchCashfreePayments(run.order_id),
      ]);
      const payment = newestPayment(payments);
      const amountMatches = Math.round(Number(order.order_amount) * 100) === Number(run.amount_minor)
        && (payment == null || Math.round(Number(payment.payment_amount) * 100) === Number(run.amount_minor));
      const currencyMatches = order.order_currency === run.currency
        && (payment == null || payment.payment_currency === run.currency);
      const identityMatches = order.order_id === run.order_id;
      const mismatch = !amountMatches || !currencyMatches || !identityMatches;
      const paymentId = payment?.cf_payment_id == null ? null : String(payment.cf_payment_id);
      const paymentStatus = payment?.payment_status?.toUpperCase() ?? null;
      const state = mismatch ? 'mismatch' : verifiedState(order.order_status, paymentStatus);
      const verifiedAt = new Date().toISOString();

      const { error: updateError } = await service.from('cashfree_sandbox_e2e_runs').update({
        state,
        gateway_order_status: order.order_status,
        gateway_payment_id: paymentId,
        gateway_payment_status: paymentStatus,
        last_error_code: mismatch ? 'verified_order_or_payment_mismatch' : null,
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      }).eq('id', run.id);
      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        run: {
          id: run.id,
          order_id: run.order_id,
          state,
          gateway_order_status: order.order_status,
          gateway_payment_id: paymentId,
          gateway_payment_status: paymentStatus,
          webhook_received: Boolean(run.webhook_received_at),
          verified_at: verifiedAt,
        },
      });
    } catch (cause) {
      const code = cause instanceof CashfreeApiError ? `cashfree_http_${cause.httpStatus}` : 'cashfree_verify_failed';
      await service.from('cashfree_sandbox_e2e_runs').update({
        last_error_code: code,
        updated_at: new Date().toISOString(),
      }).eq('id', run.id);
      return NextResponse.json({ error: 'Cashfree sandbox probe could not be verified.', code }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Sandbox E2E action is invalid.' }, { status: 400 });
}
