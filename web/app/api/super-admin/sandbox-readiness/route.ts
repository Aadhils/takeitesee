import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';
import {
  CashfreeApiError,
  fetchCashfreeOrder,
  getCashfreeConfig,
} from '../../../../server/payments/cashfree';
import {
  CashfreePayoutError,
  getCashfreePayoutConfig,
  getCashfreePayoutTransfer,
} from '../../../../server/payments/cashfree-payouts';
import { runCashfreeWebhookContractSelfTest } from '../../../../server/payments/webhook-contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAYMENT_PROBE_ORDER_ID = 'TISREADINESSPROBE20260830';
const PAYOUT_PROBE_TRANSFER_ID = 'TISREADINESSPROBE20260830';

type ProbeAction = {
  action?: 'probe_payment_credentials' | 'probe_payout_credentials';
};

async function requireSuperAdmin(request: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) } as const;
  if (!session.roles.includes('super_admin')) {
    return { response: NextResponse.json({ error: 'Super Admin permission required.' }, { status: 403 }) } as const;
  }
  return { session } as const;
}

function endpoint(origin: string, path: string) {
  return `${origin}${path}`;
}

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ('response' in auth) return auth.response;

  const origin = new URL(request.url).origin;
  const payment = getCashfreeConfig();
  const payout = getCashfreePayoutConfig();
  const signatureContract = runCashfreeWebhookContractSelfTest();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let webhookInboxAvailable = false;
  const webhookProcessing = { received: 0, processing: 0, processed: 0, ignored: 0, failed: 0 };

  try {
    const service = createSupabaseServiceClient();
    const { data, error } = await service
      .from('payment_gateway_webhook_events')
      .select('processing_status')
      .gte('received_at', since)
      .limit(1000);
    if (error) throw new Error(error.message);
    webhookInboxAvailable = true;
    for (const row of data ?? []) {
      const status = row.processing_status as keyof typeof webhookProcessing;
      if (status in webhookProcessing) webhookProcessing[status] += 1;
    }
  } catch {
    webhookInboxAvailable = false;
  }

  const httpsEndpoint = origin.startsWith('https://');
  const localGateReady = signatureContract.passed && webhookInboxAvailable && httpsEndpoint;
  const paymentSandboxReady = payment.enabled && payment.mode === 'sandbox';
  const payoutSandboxReady = payout.enabled && payout.mode === 'sandbox';

  return NextResponse.json({
    status: localGateReady && paymentSandboxReady && payoutSandboxReady ? 'ready_for_external_sandbox_e2e' : 'configuration_required',
    checked_at: new Date().toISOString(),
    local_contract: {
      https_endpoint: httpsEndpoint,
      signature: signatureContract,
      webhook_inbox_available: webhookInboxAvailable,
      webhook_processing_24h: webhookProcessing,
    },
    endpoints: {
      payment: endpoint(origin, '/api/payments/cashfree/webhook'),
      refund: endpoint(origin, '/api/payments/cashfree/refund-webhook'),
      dispute: endpoint(origin, '/api/payments/cashfree/dispute-webhook'),
      payout: endpoint(origin, '/api/payments/cashfree/payout-webhook'),
    },
    payment_gateway: {
      enabled: payment.enabled,
      mode: payment.mode,
      missing: payment.missing,
      credential_probe_available: paymentSandboxReady,
    },
    payout_gateway: {
      enabled: payout.enabled,
      mode: payout.mode,
      missing: payout.missing,
      credential_probe_available: payoutSandboxReady,
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if ('response' in auth) return auth.response;

  let input: ProbeAction;
  try {
    input = await request.json() as ProbeAction;
  } catch {
    return NextResponse.json({ error: 'A valid JSON request body is required.' }, { status: 400 });
  }

  if (input.action === 'probe_payment_credentials') {
    const config = getCashfreeConfig();
    if (config.mode !== 'sandbox') {
      return NextResponse.json({ error: 'Credential probes are hard-blocked outside Cashfree sandbox mode.' }, { status: 409 });
    }
    if (!config.enabled) {
      return NextResponse.json({ error: 'Cashfree Payments sandbox configuration is incomplete.', missing: config.missing }, { status: 409 });
    }

    try {
      await fetchCashfreeOrder(PAYMENT_PROBE_ORDER_ID);
      return NextResponse.json({ provider: 'cashfree', mode: 'sandbox', authenticated: true, outcome: 'probe_order_exists' });
    } catch (cause) {
      if (cause instanceof CashfreeApiError) {
        if (cause.httpStatus === 404) {
          return NextResponse.json({ provider: 'cashfree', mode: 'sandbox', authenticated: true, outcome: 'expected_not_found' });
        }
        if (cause.httpStatus === 401 || cause.httpStatus === 403) {
          return NextResponse.json({ provider: 'cashfree', mode: 'sandbox', authenticated: false, outcome: 'credentials_rejected', http_status: cause.httpStatus }, { status: 502 });
        }
        return NextResponse.json({ provider: 'cashfree', mode: 'sandbox', authenticated: false, outcome: 'probe_inconclusive', http_status: cause.httpStatus }, { status: 503 });
      }
      return NextResponse.json({ provider: 'cashfree', mode: 'sandbox', authenticated: false, outcome: 'probe_unavailable' }, { status: 503 });
    }
  }

  if (input.action === 'probe_payout_credentials') {
    const config = getCashfreePayoutConfig();
    if (config.mode !== 'sandbox') {
      return NextResponse.json({ error: 'Credential probes are hard-blocked outside Cashfree Payouts sandbox mode.' }, { status: 409 });
    }
    if (!config.enabled) {
      return NextResponse.json({ error: 'Cashfree Payouts sandbox configuration is incomplete.', missing: config.missing }, { status: 409 });
    }

    try {
      await getCashfreePayoutTransfer(PAYOUT_PROBE_TRANSFER_ID);
      return NextResponse.json({ provider: 'cashfree_payout', mode: 'sandbox', authenticated: true, outcome: 'probe_transfer_exists' });
    } catch (cause) {
      if (cause instanceof CashfreePayoutError) {
        if (cause.httpStatus === 404) {
          return NextResponse.json({ provider: 'cashfree_payout', mode: 'sandbox', authenticated: true, outcome: 'expected_not_found' });
        }
        if (cause.httpStatus === 401 || cause.httpStatus === 403) {
          return NextResponse.json({ provider: 'cashfree_payout', mode: 'sandbox', authenticated: false, outcome: 'credentials_rejected', http_status: cause.httpStatus }, { status: 502 });
        }
        return NextResponse.json({ provider: 'cashfree_payout', mode: 'sandbox', authenticated: false, outcome: 'probe_inconclusive', http_status: cause.httpStatus }, { status: 503 });
      }
      return NextResponse.json({ provider: 'cashfree_payout', mode: 'sandbox', authenticated: false, outcome: 'probe_unavailable' }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Sandbox probe action is invalid.' }, { status: 400 });
}
