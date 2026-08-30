'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';

type ProbeResult = {
  provider?: string;
  mode?: string;
  authenticated?: boolean;
  outcome?: string;
  http_status?: number;
  error?: string;
  missing?: string[];
};

type Payload = {
  status: 'configuration_required' | 'ready_for_external_sandbox_e2e';
  checked_at: string;
  local_contract: {
    https_endpoint: boolean;
    signature: {
      passed: boolean;
      valid_signature_accepted: boolean;
      raw_body_tamper_rejected: boolean;
      timestamp_tamper_rejected: boolean;
      wrong_signature_rejected: boolean;
    };
    webhook_inbox_available: boolean;
    webhook_processing_24h: Record<'received' | 'processing' | 'processed' | 'ignored' | 'failed', number>;
  };
  endpoints: Record<'payment' | 'refund' | 'dispute' | 'payout', string>;
  payment_gateway: { enabled: boolean; mode: string; missing: string[]; credential_probe_available: boolean };
  payout_gateway: { enabled: boolean; mode: string; missing: string[]; credential_probe_available: boolean };
  error?: string;
};

function mark(value: boolean) { return value ? '✓' : '—'; }

export default function SandboxReadinessPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [probe, setProbe] = useState<Record<string, ProbeResult>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/super-admin/sandbox-readiness', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load sandbox readiness.');
      setPayload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load sandbox readiness.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runProbe = async (action: 'probe_payment_credentials' | 'probe_payout_credentials') => {
    if (busy) return;
    setBusy(action);
    setError('');
    try {
      const response = await fetch('/api/super-admin/sandbox-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await response.json() as ProbeResult;
      const key = action === 'probe_payment_credentials' ? 'payment' : 'payout';
      setProbe((current) => ({ ...current, [key]: body }));
      if (!response.ok && !body.error) throw new Error('Sandbox credential probe failed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sandbox credential probe failed.');
    } finally {
      setBusy('');
    }
  };

  return <section className="section-stack">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Sandbox integration lab</span>
        <h2>Webhook & gateway E2E readiness</h2>
        <p>Validate the local webhook contract and sandbox credentials without creating a payment, refund, beneficiary, or payout transfer.</p>
      </div>
      <Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>Refresh sandbox status</Button>
    </div>

    {error ? <Alert tone="danger" title="Sandbox readiness needs attention">{error}</Alert> : null}
    {loading ? <Card><p>Checking sandbox integration…</p></Card> : null}

    {!loading && payload ? <>
      {payload.status === 'ready_for_external_sandbox_e2e'
        ? <Alert tone="success" title="Ready for controlled external sandbox E2E">Local webhook security and both sandbox gateway configurations are ready. This does not enable production payments.</Alert>
        : <Alert tone="warning" title="Sandbox configuration still required">The local contract can be validated now; external sandbox E2E remains locked until the missing server configuration is completed.</Alert>}

      <div className="provider-summary-grid">
        <Card>
          <div className="section-heading"><span className="eyebrow">Webhook contract</span><Badge tone={payload.local_contract.signature.passed ? 'success' : 'danger'}>{payload.local_contract.signature.passed ? 'Pass' : 'Fail'}</Badge></div>
          <p>{mark(payload.local_contract.https_endpoint)} HTTPS endpoint</p>
          <p>{mark(payload.local_contract.signature.valid_signature_accepted)} Valid signature accepted</p>
          <p>{mark(payload.local_contract.signature.raw_body_tamper_rejected)} Raw-body mutation rejected</p>
          <p>{mark(payload.local_contract.signature.timestamp_tamper_rejected)} Timestamp mutation rejected</p>
          <p>{mark(payload.local_contract.signature.wrong_signature_rejected)} Wrong signature rejected</p>
        </Card>

        <Card>
          <div className="section-heading"><span className="eyebrow">Webhook inbox · 24h</span><Badge tone={payload.local_contract.webhook_inbox_available ? 'success' : 'danger'}>{payload.local_contract.webhook_inbox_available ? 'Available' : 'Unavailable'}</Badge></div>
          <p>Processed: {payload.local_contract.webhook_processing_24h.processed}</p>
          <p>Ignored: {payload.local_contract.webhook_processing_24h.ignored}</p>
          <p>Failed: {payload.local_contract.webhook_processing_24h.failed}</p>
          <p>Pending: {payload.local_contract.webhook_processing_24h.received + payload.local_contract.webhook_processing_24h.processing}</p>
        </Card>

        <Card>
          <div className="section-heading"><span className="eyebrow">Payments sandbox</span><Badge tone={payload.payment_gateway.credential_probe_available ? 'success' : 'warning'}>{payload.payment_gateway.enabled ? payload.payment_gateway.mode : 'Disabled'}</Badge></div>
          <p>{payload.payment_gateway.missing.length ? `Missing: ${payload.payment_gateway.missing.join(', ')}` : 'Required configuration present.'}</p>
          <Button type="button" variant="secondary" disabled={!payload.payment_gateway.credential_probe_available || Boolean(busy)} loading={busy === 'probe_payment_credentials'} onClick={() => void runProbe('probe_payment_credentials')}>Probe payment credentials</Button>
          {probe.payment ? <p className="admin-fixture-note">Result: {probe.payment.authenticated ? 'credentials accepted' : probe.payment.error ?? probe.payment.outcome ?? 'not verified'}{probe.payment.http_status ? ` · HTTP ${probe.payment.http_status}` : ''}</p> : null}
        </Card>

        <Card>
          <div className="section-heading"><span className="eyebrow">Payouts sandbox</span><Badge tone={payload.payout_gateway.credential_probe_available ? 'success' : 'warning'}>{payload.payout_gateway.enabled ? payload.payout_gateway.mode : 'Disabled'}</Badge></div>
          <p>{payload.payout_gateway.missing.length ? `Missing: ${payload.payout_gateway.missing.join(', ')}` : 'Required configuration present.'}</p>
          <Button type="button" variant="secondary" disabled={!payload.payout_gateway.credential_probe_available || Boolean(busy)} loading={busy === 'probe_payout_credentials'} onClick={() => void runProbe('probe_payout_credentials')}>Probe payout credentials</Button>
          {probe.payout ? <p className="admin-fixture-note">Result: {probe.payout.authenticated ? 'credentials accepted' : probe.payout.error ?? probe.payout.outcome ?? 'not verified'}{probe.payout.http_status ? ` · HTTP ${probe.payout.http_status}` : ''}</p> : null}
        </Card>
      </div>

      <Card>
        <span className="eyebrow">Cashfree dashboard callbacks</span>
        <h3>Webhook endpoints</h3>
        <p>Register/test these HTTPS URLs in the matching Cashfree sandbox webhook sections. Signature validation remains mandatory on every callback.</p>
        <dl className="provider-profile-details">
          <div><dt>Payment</dt><dd><code>{payload.endpoints.payment}</code></dd></div>
          <div><dt>Refund</dt><dd><code>{payload.endpoints.refund}</code></dd></div>
          <div><dt>Dispute</dt><dd><code>{payload.endpoints.dispute}</code></dd></div>
          <div><dt>Payout</dt><dd><code>{payload.endpoints.payout}</code></dd></div>
        </dl>
      </Card>
    </> : null}
  </section>;
}
