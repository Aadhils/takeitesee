'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input } from '../ui/primitives';

type Policy = {
  currency: string;
  active: boolean;
  commission_bps: number;
  settlement_hold_days: number;
  minimum_payout_minor: number;
  version: number;
  updated_at: string;
};

type PayoutDestination = {
  id: string;
  destination_type: 'bank' | 'upi';
  masked_destination: string;
  beneficiary_name: string;
  status: string;
  gateway_status?: string | null;
  verified_at?: string | null;
};

type ProviderFinance = {
  owner_user_id: string;
  provider_type: string;
  professional_id?: string | null;
  business_id?: string | null;
  display_name: string;
  currency: string;
  gross_minor: number;
  platform_fee_minor: number;
  provider_net_minor: number;
  available_minor: number;
  held_minor: number;
  assigned_minor: number;
  settlement_count: number;
  payout_destination?: PayoutDestination | null;
};

type Payout = {
  id: string;
  owner_user_id: string;
  currency: string;
  status: 'ready' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'reversed';
  settlement_count: number;
  gross_minor: number;
  platform_fee_minor: number;
  provider_net_minor: number;
  external_reference?: string | null;
  failure_message?: string | null;
  created_at: string;
  paid_at?: string | null;
  transfer_id?: string | null;
  gateway_transfer_id?: string | null;
  transfer_status?: string | null;
  transfer_status_code?: string | null;
  transfer_status_description?: string | null;
  transfer_utr?: string | null;
};

type FinanceOverview = { policies: Policy[]; providers: ProviderFinance[]; payouts: Payout[] };
type PolicyDraft = { commissionPercent: string; holdDays: string; minimumPayout: string };
type Gateway = { enabled: boolean; provider: string; mode: 'sandbox' | 'production' };

function money(minor: number | null | undefined, currency: string) {
  const amount = Number(minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function payoutTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'ready' || status === 'processing') return 'warning';
  if (status === 'failed' || status === 'reversed') return 'danger';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export default function FinanceManager() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelBatchId, setCancelBatchId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/super-admin/finance', { cache: 'no-store' });
      const body = await response.json() as { finance?: FinanceOverview; payout_gateway?: Gateway; error?: string };
      if (!response.ok || !body.finance) throw new Error(body.error ?? 'Unable to load finance controls.');
      setOverview(body.finance);
      setGateway(body.payout_gateway ?? null);
      setDrafts((current) => {
        const next = { ...current };
        for (const policy of body.finance!.policies) {
          if (!next[policy.currency]) {
            next[policy.currency] = {
              commissionPercent: (Number(policy.commission_bps) / 100).toFixed(2),
              holdDays: String(policy.settlement_hold_days),
              minimumPayout: (Number(policy.minimum_payout_minor) / 100).toFixed(2),
            };
          }
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load finance controls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const policiesByCurrency = useMemo(
    () => new Map((overview?.policies ?? []).map((policy) => [policy.currency, policy])),
    [overview],
  );
  const providersByOwner = useMemo(
    () => new Map((overview?.providers ?? []).map((provider) => [provider.owner_user_id, provider])),
    [overview],
  );

  const savePolicy = async (policy: Policy, active: boolean) => {
    const draft = drafts[policy.currency];
    if (!draft || busy) return;
    const commissionPercent = Number(draft.commissionPercent);
    const holdDays = Number(draft.holdDays);
    const minimumPayout = Number(draft.minimumPayout);
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      setError('Commission must be between 0% and 100%.'); return;
    }
    if (!Number.isInteger(holdDays) || holdDays < 0 || holdDays > 90) {
      setError('Settlement hold must be a whole number from 0 to 90 days.'); return;
    }
    if (!Number.isFinite(minimumPayout) || minimumPayout < 0) {
      setError('Minimum payout cannot be negative.'); return;
    }

    setBusy(`policy:${policy.currency}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_policy', currency: policy.currency,
          commission_bps: Math.round(commissionPercent * 100), settlement_hold_days: holdDays,
          minimum_payout_minor: Math.round(minimumPayout * 100), active,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Finance policy could not be updated.');
      setNotice(active ? `${policy.currency} finance policy saved and active.` : `${policy.currency} finance policy saved and inactive.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Finance policy could not be updated.');
    } finally { setBusy(''); }
  };

  const preparePayout = async (provider: ProviderFinance) => {
    if (busy) return;
    const key = `${provider.owner_user_id}:${provider.currency}`;
    setBusy(`prepare:${key}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare_payout', owner_user_id: provider.owner_user_id, currency: provider.currency }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Payout could not be prepared.');
      setNotice(`Payout prepared for ${provider.display_name}. No transfer has been sent yet.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payout could not be prepared.');
    } finally { setBusy(''); }
  };

  const cancelPayout = async (batch: Payout) => {
    if (busy || cancelReason.trim().length < 3) return;
    setBusy(`cancel:${batch.id}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_payout', batch_id: batch.id, reason: cancelReason.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Payout could not be cancelled.');
      setNotice('Payout batch cancelled and eligible settlements released.');
      setCancelBatchId(null); setCancelReason(''); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payout could not be cancelled.');
    } finally { setBusy(''); }
  };

  const sendPayout = async (batch: Payout) => {
    if (busy) return;
    setBusy(`send:${batch.id}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_payout', batch_id: batch.id }),
      });
      const body = await response.json() as { error?: string };
      if (response.status === 202) {
        setNotice(body.error ?? 'Payout submission is awaiting status verification.'); await load(); return;
      }
      if (!response.ok) throw new Error(body.error ?? 'Payout could not be sent.');
      setNotice('Payout submitted to Cashfree. Final paid status will come from verified gateway status/webhook.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payout could not be sent.');
    } finally { setBusy(''); }
  };

  const verifyPayout = async (batch: Payout) => {
    if (busy) return;
    setBusy(`verify:${batch.id}`); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_payout', batch_id: batch.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Payout status could not be refreshed.');
      setNotice('Payout status refreshed from Cashfree.'); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payout status could not be refreshed.');
    } finally { setBusy(''); }
  };

  if (loading && !overview) return <Card><p>Loading finance control plane…</p></Card>;

  const providers = overview?.providers ?? [];
  const payouts = overview?.payouts ?? [];

  return <div className="section-stack">
    {error ? <Alert tone="danger" title="Finance action needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="success" title="Finance control updated">{notice}</Alert> : null}
    {gateway && !gateway.enabled ? <Alert tone="warning" title="Real provider transfers are disabled">Cashfree Payouts credentials / production 2FA are not configured. Finance ledger and payout preparation remain available, but Send payout is disabled.</Alert> : null}

    <section className="section-stack">
      <div><span className="eyebrow">Policy</span><h2>Commission & settlement rules</h2><p>Policy changes apply only to future settlement snapshots. Existing booking settlement amounts remain immutable.</p></div>
      {(overview?.policies ?? []).map((policy) => {
        const draft = drafts[policy.currency] ?? { commissionPercent: '0.00', holdDays: '0', minimumPayout: '0.00' };
        const policyBusy = busy === `policy:${policy.currency}`;
        return <Card key={policy.currency}>
          <div className="section-heading">
            <div><span className="eyebrow">{policy.currency} · version {policy.version}</span><h2>{policy.currency} finance policy</h2></div>
            <Badge tone={policy.active ? 'success' : 'warning'}>{policy.active ? 'Active' : 'Inactive'}</Badge>
          </div>
          {!policy.active ? <Alert tone="warning" title="No commission snapshots yet">Paid completed bookings remain in the payment ledger, but new provider settlement snapshots are paused until this policy is explicitly activated.</Alert> : null}
          <div className="grid gap-4 md:grid-cols-3" style={{ marginTop: '1rem' }}>
            <Input label="Platform commission (%)" type="number" min="0" max="100" step="0.01" value={draft.commissionPercent} onChange={(event) => setDrafts((current) => ({ ...current, [policy.currency]: { ...draft, commissionPercent: event.target.value } }))} />
            <Input label="Settlement hold (days)" type="number" min="0" max="90" step="1" value={draft.holdDays} onChange={(event) => setDrafts((current) => ({ ...current, [policy.currency]: { ...draft, holdDays: event.target.value } }))} />
            <Input label={`Minimum payout (${policy.currency})`} type="number" min="0" step="0.01" value={draft.minimumPayout} onChange={(event) => setDrafts((current) => ({ ...current, [policy.currency]: { ...draft, minimumPayout: event.target.value } }))} />
          </div>
          <div className="flex flex-wrap gap-3" style={{ marginTop: '1rem' }}>
            <Button type="button" variant="secondary" loading={policyBusy} onClick={() => void savePolicy(policy, policy.active)}>Save settings</Button>
            {!policy.active
              ? <Button type="button" loading={policyBusy} onClick={() => void savePolicy(policy, true)}>Activate policy</Button>
              : <Button type="button" variant="danger" loading={policyBusy} onClick={() => void savePolicy(policy, false)}>Deactivate policy</Button>}
          </div>
        </Card>;
      })}
    </section>

    <section className="section-stack">
      <div><span className="eyebrow">Provider balances</span><h2>Settlement & payout queue</h2><p>Preparing a batch reserves eligible balances. A verified payout destination is required only when the batch is actually sent.</p></div>
      {providers.length > 0 ? providers.map((provider) => {
        const policy = policiesByCurrency.get(provider.currency);
        const canPrepare = Boolean(policy?.active) && Number(provider.available_minor) > 0;
        const key = `${provider.owner_user_id}:${provider.currency}`;
        const destination = provider.payout_destination;
        return <Card key={key}>
          <div className="section-heading">
            <div><span className="eyebrow">{provider.provider_type} · {provider.currency}</span><h2>{provider.display_name}</h2></div>
            <Badge tone={destination?.status === 'verified' ? 'success' : 'warning'}>{destination?.status === 'verified' ? 'Destination verified' : 'Destination missing'}</Badge>
          </div>
          <dl className="provider-profile-details">
            <div><dt>Gross settled</dt><dd>{money(provider.gross_minor, provider.currency)}</dd></div>
            <div><dt>Platform fee</dt><dd>{money(provider.platform_fee_minor, provider.currency)}</dd></div>
            <div><dt>Provider net</dt><dd>{money(provider.provider_net_minor, provider.currency)}</dd></div>
            <div><dt>Available</dt><dd>{money(provider.available_minor, provider.currency)}</dd></div>
            <div><dt>On hold</dt><dd>{money(provider.held_minor, provider.currency)}</dd></div>
            <div><dt>Payout destination</dt><dd>{destination ? `${destination.masked_destination} · ${destination.status}` : 'Not registered'}</dd></div>
          </dl>
          <Button type="button" disabled={!canPrepare || Boolean(busy)} loading={busy === `prepare:${key}`} onClick={() => void preparePayout(provider)}>Prepare payout batch</Button>
        </Card>;
      }) : <Card><EmptyState title="No provider settlements yet">Activate a finance policy first. Completed paid bookings will then create immutable commission and net-earning snapshots.</EmptyState></Card>}
    </section>

    <section className="section-stack">
      <div><span className="eyebrow">Payout batches</span><h2>Gateway transfer history</h2></div>
      {payouts.length > 0 ? payouts.map((batch) => {
        const provider = providersByOwner.get(batch.owner_user_id);
        const destination = provider?.payout_destination;
        const canSend = batch.status === 'ready' && Boolean(gateway?.enabled) && destination?.status === 'verified';
        return <Card key={batch.id}>
          <div className="section-heading">
            <div><span className="eyebrow">{batch.currency} · {batch.settlement_count} settlements</span><h2>{money(batch.provider_net_minor, batch.currency)}</h2></div>
            <Badge tone={payoutTone(batch.status)}>{batch.status}</Badge>
          </div>
          <p>Gross {money(batch.gross_minor, batch.currency)} · Platform fee {money(batch.platform_fee_minor, batch.currency)} · Provider net {money(batch.provider_net_minor, batch.currency)}</p>
          <p><strong>Destination:</strong> {destination?.masked_destination ?? 'No verified destination'}</p>
          {batch.transfer_status ? <p><strong>Gateway:</strong> {batch.transfer_status}{batch.transfer_status_code ? ` / ${batch.transfer_status_code}` : ''}</p> : null}
          {batch.transfer_utr
            ? <p><strong>UTR:</strong> {batch.transfer_utr}</p>
            : batch.external_reference ? <p><strong>Transfer reference:</strong> {batch.external_reference}</p> : null}
          {batch.failure_message ? <p><strong>Note:</strong> {batch.failure_message}</p> : null}

          {batch.status === 'ready' ? <div className="section-stack" style={{ marginTop: '1rem' }}>
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={!canSend || Boolean(busy)} loading={busy === `send:${batch.id}`} onClick={() => void sendPayout(batch)}>Send payout</Button>
              {cancelBatchId !== batch.id ? <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setCancelBatchId(batch.id)}>Cancel prepared payout</Button> : null}
            </div>
            {cancelBatchId === batch.id ? <div className="grid gap-3">
              <Input label="Cancellation reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="danger" loading={busy === `cancel:${batch.id}`} disabled={cancelReason.trim().length < 3} onClick={() => void cancelPayout(batch)}>Confirm cancellation</Button>
                <Button type="button" variant="secondary" onClick={() => { setCancelBatchId(null); setCancelReason(''); }}>Keep payout</Button>
              </div>
            </div> : null}
          </div> : null}

          {(batch.status === 'processing' || batch.status === 'paid') && batch.transfer_id ? <Button type="button" variant="secondary" loading={busy === `verify:${batch.id}`} disabled={Boolean(busy) && busy !== `verify:${batch.id}`} onClick={() => void verifyPayout(batch)}>Refresh transfer status</Button> : null}
        </Card>;
      }) : <Card><EmptyState title="No payout batches">Prepared provider payouts will appear here before a transfer is submitted.</EmptyState></Card>}
    </section>
  </div>;
}