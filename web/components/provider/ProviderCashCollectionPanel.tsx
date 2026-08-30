'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';

type CashStatusPayload = {
  booking_status?: string;
  payment_status?: string;
  payment_method?: 'unselected' | 'online_gateway' | 'cash_on_service';
  cash_collected_at?: string | null;
  error?: string;
};

export default function ProviderCashCollectionPanel({
  bookingId,
  bookingStatus,
  paymentStatus,
  amount,
  currency,
  onUpdated,
}: {
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  amount: number;
  currency: 'INR' | 'USD';
  onUpdated: () => Promise<void>;
}) {
  const [method, setMethod] = useState<CashStatusPayload['payment_method']>('unselected');
  const [cashCollectedAt, setCashCollectedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}/cash-collection`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as CashStatusPayload;
        if (!response.ok) throw new Error(payload.error || 'Cash payment status could not be loaded.');
        if (!cancelled) {
          setMethod(payload.payment_method ?? 'unselected');
          setCashCollectedAt(payload.cash_collected_at ?? null);
        }
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Cash payment status could not be loaded.'); });
    return () => { cancelled = true; };
  }, [bookingId, paymentStatus]);

  if (method !== 'cash_on_service') return null;

  let formatted = `${currency} ${amount.toFixed(2)}`;
  try { formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount); } catch {}

  const confirmCash = async () => {
    if (busy || bookingStatus !== 'completed' || paymentStatus !== 'unpaid') return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/provider/bookings/${encodeURIComponent(bookingId)}/cash-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as CashStatusPayload;
      if (!response.ok || payload.payment_status !== 'paid') throw new Error(payload.error || 'Cash collection could not be confirmed.');
      setCashCollectedAt(payload.cash_collected_at ?? null);
      setNotice('Cash receipt confirmed. The booking payment is now recorded as paid.');
      await onUpdated();
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cash collection could not be confirmed.');
    } finally { setBusy(false); }
  };

  return <Card className="provider-detail-card">
    <div className="section-heading">
      <div><span className="eyebrow">Cash on Service</span><h2>Cash collection</h2></div>
      <Badge tone={paymentStatus === 'paid' ? 'success' : 'warning'}>{paymentStatus === 'paid' ? 'Cash received' : 'Cash due'}</Badge>
    </div>
    <p className="detail-copy">Customer selected cash payment for {formatted}. This amount is collected directly by you and is not treated as a Takeitesee gateway payout.</p>
    {bookingStatus !== 'completed' && paymentStatus !== 'paid' ? <p className="summary-note">Confirm cash only after the scheduled service is completed and the full amount has actually been received.</p> : null}
    {bookingStatus === 'completed' && paymentStatus === 'unpaid' ? <Button type="button" loading={busy} disabled={busy} onClick={() => void confirmCash()}>Confirm full cash received</Button> : null}
    {paymentStatus === 'paid' ? <p className="summary-note">Recorded{cashCollectedAt ? ` on ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(cashCollectedAt))}` : ''}.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}
  </Card>;
}
