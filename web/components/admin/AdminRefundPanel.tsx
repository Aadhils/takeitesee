'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../ui/primitives';

type RefundState = {
  id: string;
  attempt_no: number;
  gateway: string;
  refund_id: string;
  amount_minor: number;
  currency: string;
  status: 'created' | 'pending' | 'onhold' | 'succeeded' | 'failed' | 'cancelled' | 'requires_review';
  reason: string;
  status_description?: string | null;
  refund_arn?: string | null;
  requested_speed?: string | null;
  accepted_speed?: string | null;
  processed_speed?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type RefundPayload = {
  refund?: RefundState | null;
  gateway?: { enabled: boolean; mode: 'sandbox' | 'production'; provider: string };
  requires_review?: boolean;
  message?: string;
  error?: string;
  code?: string;
};

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100); }
  catch { return `${currency} ${(minor / 100).toFixed(2)}`; }
}

function refundTone(status: RefundState['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'created' || status === 'pending' || status === 'onhold' || status === 'requires_review') return 'warning';
  return 'info';
}

export default function AdminRefundPanel({
  bookingId,
  bookingStatus,
  paymentStatus,
  amount,
  currency,
}: {
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  amount: number;
  currency: string;
}) {
  const [refund, setRefund] = useState<RefundState | null>(null);
  const [gateway, setGateway] = useState<RefundPayload['gateway']>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/refund`, { cache: 'no-store' });
      const body = await response.json() as RefundPayload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load refund state.');
      setRefund(body.refund ?? null);
      setGateway(body.gateway ?? null);
      if (body.refund?.reason && !reason) setReason(body.refund.reason);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load refund state.');
    } finally {
      setLoaded(true);
    }
  }, [bookingId, reason]);

  useEffect(() => { void load(); }, [load]);

  const requestRefund = async () => {
    if (busy || reason.trim().length < 3 || reason.trim().length > 100) return;
    setBusy('request'); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json() as RefundPayload;
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? 'Refund could not be requested.');
      setRefund(body.refund ?? null);
      setNotice(body.message ?? body.error ?? (body.refund?.status === 'succeeded' ? 'Refund completed.' : 'Refund request submitted to Cashfree.'));
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refund could not be requested.');
    } finally { setBusy(''); }
  };

  const refreshRefund = async () => {
    if (busy) return;
    setBusy('refresh'); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/refund`, { method: 'PATCH' });
      const body = await response.json() as RefundPayload;
      if (!response.ok) throw new Error(body.error ?? 'Refund status could not be refreshed.');
      setRefund(body.refund ?? null);
      setNotice('Refund status refreshed from Cashfree.');
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refund status could not be refreshed.');
    } finally { setBusy(''); }
  };

  const lifecycleEligible = paymentStatus === 'paid' && (bookingStatus === 'cancelled' || bookingStatus === 'completed');
  const canCreateAttempt = lifecycleEligible && (!refund || refund.status === 'failed' || refund.status === 'cancelled');
  const canRetryReserved = refund?.status === 'created';
  const canRefresh = refund?.status === 'pending' || refund?.status === 'onhold';

  return <Card className="admin-detail-card">
    <div className="section-heading">
      <div><span className="eyebrow">Gateway refunds</span><h2>Full-booking refund</h2></div>
      {refund ? <Badge tone={refundTone(refund.status)}>{refund.status.replaceAll('_', ' ')}</Badge> : <Badge tone="neutral">No refund</Badge>}
    </div>

    {!loaded ? <p>Loading refund state…</p> : null}
    {error ? <Alert tone="danger" title="Refund action needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="info" title="Refund status">{notice}</Alert> : null}
    {gateway && !gateway.enabled ? <Alert tone="warning" title="Cashfree refund submission disabled">Payment gateway credentials are not configured for this deployment. A reserved refund must not be duplicated; configure the gateway and retry the same refund.</Alert> : null}
    {refund?.status === 'requires_review' ? <Alert tone="warning" title="Finance recovery review required">The provider payout is already processing or paid. Takeitesee did not send a customer refund automatically because provider recovery must be handled first.</Alert> : null}

    <dl className="admin-detail-list">
      <div><dt>Refund amount</dt><dd>{refund ? money(refund.amount_minor, refund.currency) : money(Math.round(amount * 100), currency)}</dd></div>
      <div><dt>Method</dt><dd>Full booking amount · Cashfree · Standard speed</dd></div>
      {refund ? <><div><dt>Attempt</dt><dd>#{refund.attempt_no}</dd></div><div><dt>Merchant refund ID</dt><dd>{refund.refund_id}</dd></div></> : null}
      {refund?.refund_arn ? <div><dt>Refund ARN</dt><dd>{refund.refund_arn}</dd></div> : null}
      {refund?.status_description ? <div><dt>Gateway status</dt><dd>{refund.status_description}</dd></div> : null}
    </dl>

    {canCreateAttempt || canRetryReserved ? <div className="grid gap-3" style={{ marginTop: '1rem' }}>
      <Input label="Refund reason" value={reason} maxLength={100} onChange={(event) => setReason(event.target.value)} />
      <p className="admin-fixture-note">Only a full refund is supported in this finance model. The booking becomes refunded only after Cashfree confirms SUCCESS.</p>
      <Button type="button" disabled={!gateway?.enabled || reason.trim().length < 3 || reason.trim().length > 100 || Boolean(busy)} loading={busy === 'request'} onClick={() => void requestRefund()}>
        {canRetryReserved ? 'Retry / reconcile same refund' : 'Request full refund'}
      </Button>
    </div> : null}

    {canRefresh ? <Button type="button" variant="secondary" disabled={Boolean(busy)} loading={busy === 'refresh'} onClick={() => void refreshRefund()}>Refresh refund status</Button> : null}
    {!refund && !lifecycleEligible ? <p className="admin-fixture-note">Gateway refund becomes available only when a paid booking is cancelled or completed.</p> : null}
    {refund?.status === 'succeeded' ? <p className="admin-fixture-note">Cashfree confirmed the refund. The shared payment ledger and booking timeline have been reconciled automatically.</p> : null}
  </Card>;
}
