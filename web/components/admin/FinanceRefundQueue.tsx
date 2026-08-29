'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState } from '../ui/primitives';

type RefundItem = {
  id: string;
  booking_id: string;
  booking_reference: string;
  service_name: string;
  booking_status: string;
  payment_status: string;
  attempt_no: number;
  refund_id: string;
  amount_minor: number;
  currency: string;
  status: 'created' | 'pending' | 'onhold' | 'succeeded' | 'failed' | 'cancelled' | 'requires_review';
  reason: string;
  status_description?: string | null;
  refund_arn?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type QueuePayload = {
  refunds?: RefundItem[];
  gateway?: { enabled: boolean; provider: string; mode: 'sandbox' | 'production' };
  refund?: RefundItem;
  error?: string;
  code?: string;
};

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}

function tone(status: RefundItem['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'created' || status === 'pending' || status === 'onhold' || status === 'requires_review') return 'warning';
  return 'info';
}

export default function FinanceRefundQueue() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [gateway, setGateway] = useState<QueuePayload['gateway']>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await fetch('/api/super-admin/refunds', { cache: 'no-store' });
      const body = await response.json() as QueuePayload;
      if (!response.ok || !body.refunds) throw new Error(body.error ?? 'Unable to load refund queue.');
      setRefunds(body.refunds);
      setGateway(body.gateway ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load refund queue.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reconcile = async (item: RefundItem) => {
    if (busy) return;
    setBusy(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/refunds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refund_id: item.id }),
      });
      const body = await response.json() as QueuePayload;
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? 'Refund could not be reconciled.');
      setNotice(body.error ?? `Refund ${item.refund_id} reconciled with Cashfree.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refund could not be reconciled.');
    } finally { setBusy(''); }
  };

  const active = useMemo(() => refunds.filter((item) => ['created','pending','onhold','requires_review'].includes(item.status)), [refunds]);
  const recent = useMemo(() => refunds.filter((item) => !['created','pending','onhold','requires_review'].includes(item.status)).slice(0, 20), [refunds]);

  const renderRefund = (item: RefundItem) => {
    const canReconcile = ['created','pending','onhold'].includes(item.status) && Boolean(gateway?.enabled);
    return <Card key={item.id}>
      <div className="section-heading">
        <div><span className="eyebrow">{item.booking_reference} · attempt #{item.attempt_no}</span><h2>{money(item.amount_minor, item.currency)}</h2></div>
        <Badge tone={tone(item.status)}>{item.status.replaceAll('_', ' ')}</Badge>
      </div>
      <p><strong>{item.service_name}</strong> · Booking {item.booking_status.replaceAll('_', ' ')} · Payment {item.payment_status.replaceAll('_', ' ')}</p>
      <dl className="provider-profile-details">
        <div><dt>Refund ID</dt><dd>{item.refund_id}</dd></div>
        <div><dt>Reason</dt><dd>{item.reason}</dd></div>
        <div><dt>Gateway state</dt><dd>{item.status_description || item.status.replaceAll('_', ' ')}</dd></div>
        <div><dt>Refund ARN</dt><dd>{item.refund_arn || 'Not available yet'}</dd></div>
      </dl>
      {item.status === 'requires_review' ? <Alert tone="warning" title="Provider payout recovery required">No gateway refund was sent automatically because the provider settlement is already processing or paid. Review the booking and recovery path before refunding the customer.</Alert> : null}
      <div className="flex flex-wrap gap-3" style={{ marginTop: '1rem' }}>
        {canReconcile ? <Button type="button" variant="secondary" loading={busy === item.id} disabled={Boolean(busy)} onClick={() => void reconcile(item)}>{item.status === 'created' ? 'Retry / submit same refund' : 'Refresh Cashfree status'}</Button> : null}
        <Link href={`/admin/bookings/${encodeURIComponent(item.booking_id)}`} className="button button-secondary">Open booking</Link>
      </div>
    </Card>;
  };

  return <section className="section-stack">
    <div><span className="eyebrow">Refund operations</span><h2>Gateway refund reconciliation</h2><p>Track full-booking Cashfree refunds without confusing a refund request with money actually returned. Only verified SUCCESS closes the customer payment as refunded.</p></div>
    {error ? <Alert tone="danger" title="Refund queue needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="info" title="Refund reconciliation">{notice}</Alert> : null}
    {gateway && !gateway.enabled ? <Alert tone="warning" title="Cashfree refund actions disabled">Gateway credentials are not configured. Existing refund records remain immutable and can be reconciled later with the same refund IDs.</Alert> : null}
    {loading ? <Card><p>Loading refund queue…</p></Card> : null}

    {!loading && active.length ? <div className="section-stack"><div><h3>Needs attention</h3><p>{active.length} active refund{active.length === 1 ? '' : 's'}.</p></div>{active.map(renderRefund)}</div> : null}
    {!loading && !active.length ? <Card><EmptyState title="No active refunds">Pending, on-hold, or finance-review refunds will appear here.</EmptyState></Card> : null}
    {!loading && recent.length ? <div className="section-stack"><div><h3>Recent terminal refunds</h3></div>{recent.map(renderRefund)}</div> : null}
  </section>;
}
