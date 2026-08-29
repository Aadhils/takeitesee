'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import ProviderPayoutDestinationPanel from './ProviderPayoutDestinationPanel';

type FinancePolicy = {
  currency: string;
  active: boolean;
  commission_bps: number;
  settlement_hold_days: number;
  minimum_payout_minor: number;
  version: number;
  updated_at: string;
};

type FinanceSummary = {
  gross_minor: number;
  platform_fee_minor: number;
  provider_net_minor: number;
  held_minor: number;
  risk_held_minor: number;
  available_minor: number;
  assigned_minor: number;
  paid_minor: number;
  reversed_minor: number;
  recovery_open_minor: number;
  finance_hold_count: number;
  settlement_count: number;
  available_count: number;
};

type Settlement = {
  id: string;
  booking_id: string;
  currency: string;
  gross_minor: number;
  commission_bps: number;
  platform_fee_minor: number;
  provider_net_minor: number;
  policy_version: number;
  status: 'held' | 'available' | 'assigned' | 'paid' | 'reversed' | 'risk_hold';
  eligible_at: string;
  reversal_reason?: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  currency: string;
  status: 'ready' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'reversed';
  settlement_count: number;
  gross_minor: number;
  platform_fee_minor: number;
  provider_net_minor: number;
  external_reference?: string | null;
  failure_message?: string | null;
  transfer_status?: string | null;
  transfer_status_code?: string | null;
  transfer_utr?: string | null;
  created_at: string;
  paid_at?: string | null;
};

type FinanceHold = {
  id: string;
  booking_id: string;
  source_type: 'dispute' | 'auto_refund' | 'exception';
  amount_minor: number;
  currency: string;
  status: 'open' | 'recovery_required';
  summary: string;
  opened_at: string;
  updated_at: string;
};

type Recovery = {
  id: string;
  booking_id: string;
  amount_minor: number;
  currency: string;
  status: 'open' | 'recovered' | 'waived';
  reason: string;
  created_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
};

type BookingSummary = {
  currency: string;
  completed_paid_gross: number;
  completed_paid_count: number;
  awaiting_payment_gross: number;
  awaiting_payment_count: number;
  completed_gross: number;
  completed_count: number;
};

type EarningsActivity = {
  id: string;
  booking_reference: string;
  service_name: string;
  amount: number;
  currency: string;
  booking_status: string;
  payment_status: string;
  booking_date: string | null;
  created_at: string;
};

type EarningsPayload = {
  finance?: {
    policies?: FinancePolicy[];
    summary?: Partial<FinanceSummary>;
    settlements?: Settlement[];
    payouts?: Payout[];
    finance_holds?: FinanceHold[];
    recoveries?: Recovery[];
  };
  booking_summary?: BookingSummary;
  activity?: EarningsActivity[];
  error?: string;
};

const emptyFinance: FinanceSummary = {
  gross_minor: 0, platform_fee_minor: 0, provider_net_minor: 0, held_minor: 0, risk_held_minor: 0,
  available_minor: 0, assigned_minor: 0, paid_minor: 0, reversed_minor: 0, recovery_open_minor: 0,
  finance_hold_count: 0, settlement_count: 0, available_count: 0,
};

function formatCurrency(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
function formatMinor(amount: number | undefined, currency: string) { return formatCurrency(Number(amount ?? 0) / 100, currency); }
function paymentTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'pending' || status === 'unpaid') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'refunded') return 'info';
  return 'neutral';
}
function financeTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'paid' || status === 'available' || status === 'recovered') return 'success';
  if (status === 'held' || status === 'risk_hold' || status === 'ready' || status === 'processing' || status === 'assigned' || status === 'open') return 'warning';
  if (status === 'failed' || status === 'reversed') return 'danger';
  if (status === 'cancelled' || status === 'waived') return 'neutral';
  return 'info';
}

export default function ProviderEarningsManager() {
  const [payload, setPayload] = useState<EarningsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true); setError('');
        const response = await fetch('/api/provider/earnings', { cache: 'no-store' });
        const body = await response.json() as EarningsPayload;
        if (!response.ok || !body.booking_summary || !body.finance) throw new Error(body.error ?? 'Unable to load earnings.');
        setPayload(body);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load earnings.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const bookingSummary = payload?.booking_summary;
  const currency = bookingSummary?.currency ?? payload?.finance?.policies?.[0]?.currency ?? 'INR';
  const summary = { ...emptyFinance, ...(payload?.finance?.summary ?? {}) };
  const policy = payload?.finance?.policies?.find((item) => item.currency === currency);
  const settlements = payload?.finance?.settlements ?? [];
  const payouts = payload?.finance?.payouts ?? [];
  const holds = payload?.finance?.finance_holds ?? [];
  const recoveries = payload?.finance?.recoveries ?? [];
  const openRecoveries = recoveries.filter((item) => item.status === 'open');
  const activity = payload?.activity ?? [];
  const bookingReferenceById = useMemo(() => new Map(activity.map((item) => [item.id, item.booking_reference])), [activity]);

  return <LiveProviderShell active="/provider/earnings">
    <ProviderHeading eyebrow="Finance" title="Earnings & payouts" description="Track paid service value, platform commission, provider net earnings, settlement holds, payment-risk holds, recovery balances, and real payout transfer status." />

    {loading ? <Card><p>Loading finance ledger…</p></Card> : null}
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}

    {payload && bookingSummary ? <>
      {!policy?.active ? <Alert tone="warning" title="Platform finance policy not active">Paid bookings are still safely recorded in the booking payment ledger, but provider commission and payout snapshots will start only after the platform activates a finance policy.</Alert> : null}
      {holds.length ? <Alert tone="warning" title="Some payout balance is under finance review">A payment dispute, chargeback, or gateway reversal is being reviewed. Affected booking balance is excluded from available payout until the risk clears.</Alert> : null}
      {openRecoveries.length ? <Alert tone="danger" title="Outstanding provider recovery balance">A payment reversal affected funds that had already been paid out. New payout preparation is blocked until platform finance resolves the recovery balance.</Alert> : null}

      <ProviderPayoutDestinationPanel />

      <div className="provider-summary-grid">
        <ProviderDashboardSummary label="Available for payout" value={formatMinor(summary.available_minor, currency)} detail={`${summary.available_count} eligible settlement${summary.available_count === 1 ? '' : 's'}`} tone="success" />
        <ProviderDashboardSummary label="Payment-risk hold" value={formatMinor(summary.risk_held_minor, currency)} detail={`${summary.finance_hold_count} finance hold${summary.finance_hold_count === 1 ? '' : 's'}`} tone="warning" />
        <ProviderDashboardSummary label="Recovery balance" value={formatMinor(summary.recovery_open_minor, currency)} detail={openRecoveries.length ? 'Must clear before a new payout' : 'No outstanding recovery'} tone={openRecoveries.length ? 'warning' : 'info'} />
        <ProviderDashboardSummary label="On settlement hold" value={formatMinor(summary.held_minor, currency)} detail={policy?.active ? `${policy.settlement_hold_days} day hold policy` : 'Policy not active'} tone="warning" />
        <ProviderDashboardSummary label="Provider net" value={formatMinor(summary.provider_net_minor, currency)} detail={`${summary.settlement_count} settled paid job${summary.settlement_count === 1 ? '' : 's'}`} tone="info" />
        <ProviderDashboardSummary label="Paid out" value={formatMinor(summary.paid_minor, currency)} detail="Completed provider transfers" />
      </div>

      <Card className="provider-profile-card">
        <div className="section-heading"><div><span className="eyebrow">Commission snapshot</span><h2>Gross → platform fee → provider net</h2></div><Badge tone={policy?.active ? 'success' : 'warning'}>{policy?.active ? 'Policy active' : 'Awaiting activation'}</Badge></div>
        <dl className="provider-profile-details">
          <div><dt>Settled gross value</dt><dd>{formatMinor(summary.gross_minor, currency)}</dd></div>
          <div><dt>Platform commission</dt><dd>{formatMinor(summary.platform_fee_minor, currency)}</dd></div>
          <div><dt>Provider net</dt><dd>{formatMinor(summary.provider_net_minor, currency)}</dd></div>
          <div><dt>Current commission policy</dt><dd>{policy?.active ? `${(policy.commission_bps / 100).toFixed(2)}% · version ${policy.version}` : 'Not active'}</dd></div>
          <div><dt>Minimum payout</dt><dd>{policy ? formatMinor(policy.minimum_payout_minor, policy.currency) : 'Not configured'}</dd></div>
          <div><dt>Assigned to open payout</dt><dd>{formatMinor(summary.assigned_minor, currency)}</dd></div>
          <div><dt>Reversed before payout</dt><dd>{formatMinor(summary.reversed_minor, currency)}</dd></div>
          <div><dt>Completed + paid booking gross</dt><dd>{formatCurrency(bookingSummary.completed_paid_gross, currency)} · {bookingSummary.completed_paid_count} jobs</dd></div>
        </dl>
      </Card>

      {holds.length || recoveries.length ? <Card className="provider-transactions">
        <div className="section-heading"><div><span className="eyebrow">Finance protection</span><h2>Risk holds & recovery</h2></div><Badge tone={openRecoveries.length ? 'danger' : 'warning'}>{openRecoveries.length ? 'Recovery required' : 'Finance review'}</Badge></div>
        {holds.length ? <div className="provider-transaction-list">{holds.map((item) => <div key={item.id}><div><strong>{bookingReferenceById.get(item.booking_id) ?? `Booking ${item.booking_id.slice(0, 8)}…`}</strong><span>{item.summary}</span></div><strong>{formatMinor(item.amount_minor, item.currency)}</strong><Badge tone={financeTone(item.status)}>{item.status.replaceAll('_', ' ')}</Badge></div>)}</div> : null}
        {recoveries.length ? <div className="provider-transaction-list" style={{ marginTop: '1rem' }}>{recoveries.map((item) => <div key={item.id}><div><strong>{bookingReferenceById.get(item.booking_id) ?? `Booking ${item.booking_id.slice(0, 8)}…`}</strong><span>{item.reason}{item.resolution_note ? ` · ${item.resolution_note}` : ''}</span></div><strong>{formatMinor(item.amount_minor, item.currency)}</strong><Badge tone={financeTone(item.status)}>{item.status}</Badge></div>)}</div> : null}
      </Card> : null}

      <Card className="provider-transactions">
        <div className="section-heading"><div><span className="eyebrow">Settlement ledger</span><h2>Booking commission snapshots</h2></div><Badge tone="info">Immutable per booking</Badge></div>
        {settlements.length ? <div className="provider-transaction-list">{settlements.map((item) => <div key={item.id}>
          <div><strong>{bookingReferenceById.get(item.booking_id) ?? `Booking ${item.booking_id.slice(0, 8)}…`}</strong><span>Gross {formatMinor(item.gross_minor, item.currency)} · Fee {(item.commission_bps / 100).toFixed(2)}% · Net {formatMinor(item.provider_net_minor, item.currency)}</span></div>
          <strong>{formatMinor(item.provider_net_minor, item.currency)}</strong>
          <Badge tone={financeTone(item.status)}>{item.status.replaceAll('_', ' ')}</Badge>
        </div>)}</div> : <EmptyState title="No finance settlements yet">Completed paid bookings will create commission snapshots after the platform finance policy is activated.</EmptyState>}
      </Card>

      <Card className="provider-transactions">
        <div className="section-heading"><div><span className="eyebrow">Payout history</span><h2>Provider payout transfers</h2></div><Badge tone="info">Gateway reconciled</Badge></div>
        {payouts.length ? <div className="provider-transaction-list">{payouts.map((item) => <div key={item.id}>
          <div><strong>{formatMinor(item.provider_net_minor, item.currency)}</strong><span>{item.settlement_count} settlements · {new Date(item.created_at).toLocaleString('en-IN')}{item.transfer_status ? ` · ${item.transfer_status}${item.transfer_status_code ? `/${item.transfer_status_code}` : ''}` : ''}</span></div>
          <strong>{item.transfer_utr || item.external_reference || 'Transfer not sent yet'}</strong>
          <Badge tone={financeTone(item.status)}>{item.status}</Badge>
        </div>)}</div> : <EmptyState title="No payouts prepared yet">Available settlement balance will appear in a payout batch after platform finance review.</EmptyState>}
      </Card>

      <Card className="provider-transactions">
        <div className="section-heading"><div><span className="eyebrow">Booking payment activity</span><h2>Operational payment states</h2></div><Badge tone="success">Live booking data</Badge></div>
        {activity.length ? <div className="provider-transaction-list">{activity.map((item) => {
          const date = item.booking_date ? new Date(`${item.booking_date}T00:00:00`) : new Date(item.created_at);
          return <div key={item.id}><div><strong>{item.service_name}</strong><span>{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {item.booking_reference} · {item.booking_status}</span></div><strong>{formatCurrency(item.amount, item.currency)}</strong><Badge tone={paymentTone(item.payment_status)}>Payment {item.payment_status}</Badge></div>;
        })}</div> : <EmptyState title="No booking activity yet">New provider bookings will appear here.</EmptyState>}
        <p className="provider-fixture-note">A payout is marked paid only after the payout gateway confirms a completed transfer. Payment disputes and auto-refunds can temporarily hold affected balance; post-payout losses create an auditable recovery entry instead of silently changing earnings.</p>
      </Card>
    </> : null}
  </LiveProviderShell>;
}
