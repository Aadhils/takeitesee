'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState } from '../ui/primitives';

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

type Payload = {
  gateway?: { provider: string; enabled: boolean; mode: 'sandbox' | 'production'; checkout_probe_available: boolean };
  probe?: { amount_minor: number; currency: string; isolated_from_booking_finance: boolean };
  runs?: ProbeRun[];
  error?: string;
};

type CreateResult = {
  run?: { id: string; order_id: string; state: string; amount_minor: number; currency: string };
  checkout?: { provider: 'cashfree'; mode: 'sandbox'; payment_session_id: string };
  error?: string;
  code?: string;
};

type VerifyResult = { run?: Partial<ProbeRun>; error?: string; code?: string };

type CashfreeInstance = {
  checkout(input: { paymentSessionId: string; redirectTarget?: '_self' | '_blank' | '_top' | '_modal' }): Promise<{ error?: { message?: string } } | void> | void;
};

type CashfreeWindow = Window & {
  Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
};

function tone(state: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (['payment_succeeded', 'verified_success'].includes(state)) return 'success';
  if (['mismatch', 'failed', 'payment_failed', 'verified_failure'].includes(state)) return 'danger';
  if (['user_dropped', 'verified_user_dropped'].includes(state)) return 'warning';
  if (['ready_for_checkout', 'webhook_received', 'verified_pending'].includes(state)) return 'info';
  return 'neutral';
}

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}

export default function SandboxE2ERunner() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/super-admin/sandbox-e2e', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load sandbox E2E runs.');
      setPayload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load sandbox E2E runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sandbox_probe_return') !== '1') return;
    setNotice('Cashfree sandbox checkout returned to Takeitesee. Verify the probe to confirm the gateway state and compare it with the signed webhook evidence.');
    void load();
    const clean = new URL(window.location.href);
    clean.searchParams.delete('sandbox_probe_return');
    clean.searchParams.delete('probe_order_id');
    window.history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
  }, [load]);

  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const createProbe = async () => {
    if (busy || !payload?.gateway?.checkout_probe_available) return;
    setBusy('create'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/sandbox-e2e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_checkout_probe' }),
      });
      const body = await response.json() as CreateResult;
      if (!response.ok || !body.checkout?.payment_session_id || !body.run) {
        throw new Error(body.error ?? 'Sandbox checkout probe could not be created.');
      }
      const factory = (window as CashfreeWindow).Cashfree;
      if (!factory) throw new Error('Cashfree sandbox checkout is still loading.');
      const cashfree = factory({ mode: 'sandbox' });
      const result = cashfree.checkout({ paymentSessionId: body.checkout.payment_session_id, redirectTarget: '_blank' });
      if (result && typeof result.then === 'function') {
        void result.then((checkoutResult) => {
          const message = checkoutResult && 'error' in checkoutResult ? checkoutResult.error?.message : undefined;
          if (message) setError(message);
        }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Cashfree sandbox checkout could not be opened.'));
      }
      setNotice(`Sandbox checkout opened for ${body.run.order_id}. Complete the Cashfree sandbox flow, then use Verify Cashfree below.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sandbox checkout probe could not be created.');
    } finally {
      setBusy('');
    }
  };

  const verifyProbe = async (runId: string) => {
    if (busy) return;
    setBusy(`verify:${runId}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/sandbox-e2e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_probe', run_id: runId }),
      });
      const body = await response.json() as VerifyResult;
      if (!response.ok) throw new Error(body.error ?? 'Sandbox probe could not be verified.');
      setNotice(`Cashfree verification completed: ${String(body.run?.state ?? 'updated').replaceAll('_', ' ')}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sandbox probe could not be verified.');
    } finally {
      setBusy('');
    }
  };

  const gatewayReady = Boolean(payload?.gateway?.checkout_probe_available);
  const runs = payload?.runs ?? [];

  return <section className="section-stack">
    {gatewayReady ? <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onLoad={() => setSdkReady(true)} onError={() => setError('Cashfree sandbox checkout SDK could not be loaded.')} /> : null}

    <div className="section-heading">
      <div>
        <span className="eyebrow">Controlled sandbox E2E</span>
        <h2>₹1 isolated checkout probe</h2>
        <p>Create a Cashfree sandbox order, exercise hosted checkout and signed webhook delivery, then independently verify the order/payment state from Cashfree. The probe never touches booking, settlement, refund, commission, or payout ledgers.</p>
      </div>
      <Button type="button" variant="secondary" disabled={loading || Boolean(busy)} onClick={() => void load()}>Refresh probes</Button>
    </div>

    {error ? <Alert tone="danger" title="Sandbox E2E needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="success" title="Sandbox E2E updated">{notice}</Alert> : null}
    {loading ? <Card><p>Loading controlled sandbox probes…</p></Card> : null}

    {!loading && payload ? <>
      {!gatewayReady
        ? <Alert tone="warning" title="Cashfree sandbox credentials required">The runner is installed and isolated, but checkout creation remains disabled until the managed Cashfree Payments sandbox configuration is complete.</Alert>
        : <Alert tone="success" title="Sandbox runner unlocked">Only Cashfree sandbox is allowed here. The probe amount is {money(payload.probe?.amount_minor ?? 100, payload.probe?.currency ?? 'INR')} and cannot activate production finance.</Alert>}

      <Card>
        <div className="section-heading">
          <div><span className="eyebrow">Step 1</span><h3>Create sandbox checkout</h3></div>
          <Badge tone={gatewayReady ? 'success' : 'warning'}>{gatewayReady ? 'Sandbox only' : 'Locked'}</Badge>
        </div>
        <p>The server creates a dedicated `tis_probe_…` order with a sandbox-only notify URL. No real customer record or booking is used.</p>
        <Button type="button" disabled={!gatewayReady || !sdkReady || Boolean(busy)} loading={busy === 'create'} onClick={() => void createProbe()}>
          {gatewayReady && !sdkReady ? 'Loading Cashfree sandbox…' : 'Create ₹1 sandbox checkout probe'}
        </Button>
      </Card>

      <div>
        <span className="eyebrow">Step 2</span>
        <h3>Webhook + API verification evidence</h3>
        <p>A successful E2E run should show both signed webhook evidence and a matching Cashfree API verification result.</p>
      </div>

      {runs.length ? runs.map((run) => <Card key={run.id}>
        <div className="section-heading">
          <div><span className="eyebrow">{run.order_id}</span><h3>{money(run.amount_minor, run.currency)}</h3></div>
          <Badge tone={tone(run.state)}>{run.state.replaceAll('_', ' ')}</Badge>
        </div>
        <dl className="provider-profile-details">
          <div><dt>Cashfree order</dt><dd>{run.gateway_order_status || 'Not verified yet'}</dd></div>
          <div><dt>Payment</dt><dd>{run.gateway_payment_status || 'No payment attempt recorded'}</dd></div>
          <div><dt>Signed webhook</dt><dd>{run.webhook_received_at ? new Date(run.webhook_received_at).toLocaleString('en-IN') : 'Not received yet'}</dd></div>
          <div><dt>API verified</dt><dd>{run.verified_at ? new Date(run.verified_at).toLocaleString('en-IN') : 'Not verified yet'}</dd></div>
        </dl>
        {run.last_error_code ? <p className="admin-fixture-note">Evidence warning: {run.last_error_code.replaceAll('_', ' ')}</p> : null}
        <Button type="button" variant="secondary" disabled={!gatewayReady || Boolean(busy)} loading={busy === `verify:${run.id}`} onClick={() => void verifyProbe(run.id)}>Verify Cashfree</Button>
      </Card>) : <EmptyState title="No sandbox checkout probes yet">Once sandbox credentials are configured, create a controlled ₹1 checkout probe here. Production finance remains locked.</EmptyState>}
    </> : null}
  </section>;
}
