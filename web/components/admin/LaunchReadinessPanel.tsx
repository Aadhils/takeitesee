'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';

type Payload = {
  status: 'blocked' | 'sandbox_ready';
  release: string;
  checked_at: string;
  database: {
    canonical_match: boolean;
    service_role_database: boolean;
    rpc_anon_mutations_closed: boolean;
    trigger_rpc_surface_closed: boolean;
    public_marketplace_helpers_available: boolean;
    inr_finance_policy_active: boolean;
  };
  payment_gateway: { provider: string; enabled: boolean; mode: string; missing: string[] };
  payout_gateway: { provider: string; enabled: boolean; mode: string; missing: string[]; ip_whitelist_mode: boolean };
  blockers: string[];
  error?: string;
};

const blockerLabels: Record<string, string> = {
  canonical_database_mismatch: 'Vercel is not pointed at the canonical live Supabase project.',
  service_role_database_unavailable: 'Server-side Supabase service-role access is not ready.',
  anonymous_rpc_mutation_surface_open: 'Anonymous mutation RPC execution is not fully closed.',
  trigger_rpc_surface_open: 'Trigger-only RPCs are still directly callable.',
  public_marketplace_helper_unavailable: 'A required public marketplace helper is unavailable.',
  inr_finance_policy_already_active: 'INR finance policy is already active before the activation gate is complete.',
  cashfree_payment_configuration_incomplete: 'Cashfree payment configuration is incomplete.',
  cashfree_payment_not_in_sandbox: 'Cashfree payments are not in sandbox mode for pre-launch testing.',
  cashfree_payout_configuration_incomplete: 'Cashfree payout configuration is incomplete.',
  cashfree_payout_not_in_sandbox: 'Cashfree payouts are not in sandbox mode for pre-launch testing.',
};

function check(value: boolean) {
  return value ? '✓' : '—';
}

export default function LaunchReadinessPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/super-admin/readiness', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load launch readiness.');
      setPayload(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load launch readiness.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="section-stack">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Launch activation gate</span>
        <h2>Production readiness</h2>
        <p>Security, privileged database access, gateway configuration, and finance activation stay separated until every pre-launch gate is reviewed.</p>
      </div>
      <Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>Refresh readiness</Button>
    </div>

    {error ? <Alert tone="danger" title="Readiness check unavailable">{error}</Alert> : null}
    {loading ? <Card><p>Checking launch readiness…</p></Card> : null}

    {!loading && payload ? <>
      {payload.status === 'sandbox_ready'
        ? <Alert tone="success" title="Sandbox integration gate is ready">The database security gate and sandbox payment/payout configuration are ready for controlled end-to-end testing. Production activation is still a separate decision.</Alert>
        : <Alert tone="warning" title="Launch activation remains locked">{payload.blockers.length} readiness blocker{payload.blockers.length === 1 ? '' : 's'} remain. Real payment and finance activation should stay disabled.</Alert>}

      <div className="provider-summary-grid">
        <Card>
          <div className="section-heading"><span className="eyebrow">Database</span><Badge tone={payload.database.canonical_match && payload.database.service_role_database ? 'success' : 'danger'}>{payload.database.canonical_match && payload.database.service_role_database ? 'Ready' : 'Blocked'}</Badge></div>
          <p>{check(payload.database.canonical_match)} Canonical Supabase project</p>
          <p>{check(payload.database.service_role_database)} Service-role database access</p>
          <p>{check(payload.database.rpc_anon_mutations_closed)} Anonymous mutation RPCs closed</p>
          <p>{check(payload.database.trigger_rpc_surface_closed)} Trigger RPC surface closed</p>
          <p>{check(payload.database.public_marketplace_helpers_available)} Public marketplace helpers available</p>
        </Card>
        <Card>
          <div className="section-heading"><span className="eyebrow">Payments</span><Badge tone={payload.payment_gateway.enabled && payload.payment_gateway.mode === 'sandbox' ? 'success' : 'warning'}>{payload.payment_gateway.enabled ? payload.payment_gateway.mode : 'Disabled'}</Badge></div>
          <p>Provider: {payload.payment_gateway.provider}</p>
          <p>{payload.payment_gateway.missing.length ? `Missing: ${payload.payment_gateway.missing.join(', ')}` : 'Required server configuration present.'}</p>
        </Card>
        <Card>
          <div className="section-heading"><span className="eyebrow">Provider payouts</span><Badge tone={payload.payout_gateway.enabled && payload.payout_gateway.mode === 'sandbox' ? 'success' : 'warning'}>{payload.payout_gateway.enabled ? payload.payout_gateway.mode : 'Disabled'}</Badge></div>
          <p>Provider: {payload.payout_gateway.provider}</p>
          <p>{payload.payout_gateway.missing.length ? `Missing: ${payload.payout_gateway.missing.join(', ')}` : 'Required server configuration present.'}</p>
          <p>Production IP whitelist mode: {payload.payout_gateway.ip_whitelist_mode ? 'enabled' : 'not enabled'}</p>
        </Card>
        <Card>
          <div className="section-heading"><span className="eyebrow">Activation lock</span><Badge tone={!payload.database.inr_finance_policy_active ? 'success' : 'danger'}>{payload.database.inr_finance_policy_active ? 'Active' : 'Safe'}</Badge></div>
          <p>INR finance policy: {payload.database.inr_finance_policy_active ? 'ACTIVE' : 'inactive'}</p>
          <p>Release: {payload.release}</p>
          <p>Checked: {new Date(payload.checked_at).toLocaleString('en-IN')}</p>
        </Card>
      </div>

      {payload.blockers.length ? <Card>
        <span className="eyebrow">Open gates</span>
        <h3>Resolve before sandbox E2E</h3>
        <ul>
          {payload.blockers.map((blocker) => <li key={blocker}>{blockerLabels[blocker] ?? blocker.replaceAll('_', ' ')}</li>)}
        </ul>
      </Card> : null}
    </> : null}
  </section>;
}
