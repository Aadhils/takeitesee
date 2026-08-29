'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';

type GatewayConfig = {
  enabled: boolean;
  provider: 'cashfree';
  mode: 'sandbox' | 'production';
};

type CheckoutPayload = {
  checkout?: {
    provider: 'cashfree';
    mode: 'sandbox' | 'production';
    payment_intent_id: string;
    order_id: string;
    payment_session_id: string;
    amount_minor: number;
    currency: string;
    expires_at?: string | null;
  };
  error?: string;
  code?: string;
};

type VerifyPayload = {
  verified?: boolean;
  order_status?: string;
  payment_attempt_status?: string | null;
  payment_message?: string | null;
  payment_status?: string | null;
  final?: boolean;
  error?: string;
};

type CashfreeCheckoutResult = { error?: { message?: string } } | void;
type CashfreeInstance = {
  checkout(input: { paymentSessionId: string; redirectTarget?: '_self' | '_blank' | '_top' | '_modal' }): Promise<CashfreeCheckoutResult> | void;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

function paymentTone(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'failed' || status === 'refunded') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

function paymentLabel(status: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'pending') return 'Processing';
  if (status === 'failed') return 'Payment failed';
  if (status === 'refunded') return 'Refunded';
  return 'Unpaid';
}

export default function CustomerPaymentPanel({
  bookingId,
  bookingStatus,
  paymentStatus,
  onPaymentUpdated,
}: {
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  onPaymentUpdated: () => Promise<void>;
}) {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const returnHandled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/payments/config', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as GatewayConfig;
        if (!cancelled) setConfig(payload);
      })
      .catch(() => { if (!cancelled) setConfig({ enabled: false, provider: 'cashfree', mode: 'sandbox' }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (returnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_return') !== '1') return;
    const orderId = params.get('order_id') || params.get('cf_order_id');
    if (!orderId) return;
    returnHandled.current = true;
    setVerifying(true); setError(''); setNotice('Verifying payment with Cashfree…');

    void fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    }).then(async (response) => {
      const payload = await response.json() as VerifyPayload;
      if (!response.ok || !payload.verified) throw new Error(payload.error || 'Payment could not be verified.');
      if (payload.payment_status === 'paid') setNotice('Payment verified successfully. Your booking is paid.');
      else if (payload.payment_status === 'failed') setNotice(payload.payment_message || 'The payment attempt failed. You can try again.');
      else if (payload.payment_status === 'unpaid' && payload.final) setNotice('Checkout ended without payment. You can try again when ready.');
      else setNotice('Payment is still processing. The booking will update automatically when Cashfree confirms it.');
      await onPaymentUpdated();
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Payment could not be verified.');
      setNotice('');
    }).finally(() => {
      setVerifying(false);
      const clean = new URL(window.location.href);
      clean.searchParams.delete('payment_return');
      clean.searchParams.delete('order_id');
      clean.searchParams.delete('cf_order_id');
      window.history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
    });
  }, [bookingId, onPaymentUpdated]);

  useEffect(() => {
    if (paymentStatus !== 'pending') return;
    const timer = window.setInterval(() => {
      void fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-intent`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() as Promise<{ booking_payment_status?: string }> : null)
        .then(async (payload) => {
          if (payload?.booking_payment_status && payload.booking_payment_status !== 'pending') await onPaymentUpdated();
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [bookingId, onPaymentUpdated, paymentStatus]);

  const canPay = ['confirmed', 'completed'].includes(bookingStatus) && ['unpaid', 'failed'].includes(paymentStatus);

  const startCheckout = async () => {
    if (!config?.enabled || !canPay || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!window.Cashfree) throw new Error('Secure payment checkout is still loading. Please try again in a moment.');
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          ...(phone.trim() ? { customer_phone: phone.trim() } : {}),
        }),
      });
      const payload = await response.json() as CheckoutPayload;
      if (!response.ok || !payload.checkout?.payment_session_id) throw new Error(payload.error || 'Secure checkout could not be started.');
      const cashfree = window.Cashfree({ mode: payload.checkout.mode });
      const checkoutResult = cashfree.checkout({ paymentSessionId: payload.checkout.payment_session_id, redirectTarget: '_self' });
      if (checkoutResult && typeof checkoutResult.then === 'function') {
        void checkoutResult.then((result) => {
          const message = result && 'error' in result ? result.error?.message : undefined;
          if (message) setError(message);
        }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Cashfree checkout could not be opened.'));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Secure checkout could not be started.');
      setBusy(false);
    }
  };

  return <>
    {config?.enabled ? <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onLoad={() => setSdkReady(true)} onError={() => setError('Secure payment checkout could not be loaded.')} /> : null}
    <Card className="policy-card">
      <div className="section-heading">
        <div><span className="eyebrow">Secure payment</span><h2>Pay for this booking</h2></div>
        <Badge tone={paymentTone(paymentStatus)}>{paymentLabel(paymentStatus)}</Badge>
      </div>

      {paymentStatus === 'paid' ? <p className="detail-copy">Payment has been verified by the payment gateway and recorded in your booking ledger.</p> : null}
      {paymentStatus === 'refunded' ? <p className="detail-copy">This payment has been recorded as refunded. A new payment cannot be started for this booking.</p> : null}
      {paymentStatus === 'pending' ? <p className="detail-copy">Payment confirmation is in progress. Do not start another payment while this attempt is processing.</p> : null}
      {!['confirmed', 'completed'].includes(bookingStatus) && !['paid', 'refunded'].includes(paymentStatus) ? <p className="detail-copy">Online payment becomes available after the provider confirms the booking.</p> : null}

      {canPay && config && !config.enabled ? <p className="detail-copy">Online payment checkout is being configured. Your booking is safe and no payment will be collected until the gateway is enabled.</p> : null}

      {canPay && config?.enabled ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
        <label style={{ display: 'grid', gap: '.4rem' }}>
          <strong>Mobile number for payment</strong>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^0-9+\s-]/g, '').slice(0, 16))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="10-digit Indian mobile number"
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }}
          />
          <span className="summary-note">Leave blank to use the mobile number already saved in your account.</span>
        </label>
        <Button type="button" loading={busy || verifying} disabled={!sdkReady || busy || verifying} onClick={() => void startCheckout()}>
          {verifying ? 'Verifying payment…' : sdkReady ? 'Pay securely with Cashfree' : 'Loading secure checkout…'}
        </Button>
        <p className="summary-note">Takeitesee never receives or stores your card, UPI PIN, OTP, or banking credentials. Payment is completed on Cashfree's hosted checkout.</p>
      </div> : null}

      {notice ? <p role="status" style={{ marginTop: '1rem' }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ color: '#b42318', marginTop: '1rem' }}>{error}</p> : null}
    </Card>
  </>;
}
