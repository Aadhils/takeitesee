'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type EarningsSummary = {
  currency: string;
  available_balance: number;
  available_count: number;
  pending_earnings: number;
  pending_count: number;
  this_month: number;
  this_month_count: number;
  total_earnings: number;
  total_completed_count: number;
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

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function paymentTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'pending' || status === 'unpaid') return 'warning';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export default function ProviderEarningsManager() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [activity, setActivity] = useState<EarningsActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/provider/earnings', { cache: 'no-store' });
        const payload = await response.json() as { summary?: EarningsSummary; activity?: EarningsActivity[]; error?: string };
        if (!response.ok || !payload.summary || !payload.activity) throw new Error(payload.error ?? 'Unable to load earnings.');
        setSummary(payload.summary);
        setActivity(payload.activity);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load earnings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currency = summary?.currency ?? 'INR';

  return <LiveProviderShell active="/provider/earnings">
    <ProviderHeading eyebrow="Operations" title="Earnings overview" description="Live service-value and payment status from your bookings. Available balance only includes completed bookings marked paid." />

    {loading ? <Card><p>Loading real earnings data…</p></Card> : null}
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}

    {summary ? <>
      <div className="provider-summary-grid">
        <ProviderDashboardSummary label="Available balance" value={formatCurrency(summary.available_balance, currency)} detail={`${summary.available_count} completed paid job${summary.available_count === 1 ? '' : 's'}`} tone="success" />
        <ProviderDashboardSummary label="Pending earnings" value={formatCurrency(summary.pending_earnings, currency)} detail={`${summary.pending_count} completed awaiting payment`} tone="warning" />
        <ProviderDashboardSummary label="This month" value={formatCurrency(summary.this_month, currency)} detail={`${summary.this_month_count} completed job${summary.this_month_count === 1 ? '' : 's'}`} tone="info" />
        <ProviderDashboardSummary label="Total earnings" value={formatCurrency(summary.total_earnings, currency)} detail={`${summary.total_completed_count} completed job${summary.total_completed_count === 1 ? '' : 's'} total`} />
      </div>

      <Card className="provider-transactions">
        <div className="section-heading"><div><span className="eyebrow">Recent activity</span><h2>Bookings and payment states</h2></div><Badge tone="success">Live booking data</Badge></div>
        {activity.length ? <div className="provider-transaction-list">{activity.map((item) => {
          const date = item.booking_date ? new Date(`${item.booking_date}T00:00:00`) : new Date(item.created_at);
          return <div key={item.id}>
            <div><strong>{item.service_name}</strong><span>{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {item.booking_reference}</span></div>
            <strong>{formatCurrency(item.amount, item.currency)}</strong>
            <Badge tone={paymentTone(item.payment_status)}>Payment {item.payment_status}</Badge>
          </div>;
        })}</div> : <EmptyState title="No booking activity yet">New provider bookings will appear here.</EmptyState>}
        <p className="provider-fixture-note">Amounts come from booking quoted prices. This page does not create payouts or transfer funds.</p>
      </Card>
    </> : null}
  </LiveProviderShell>;
}
