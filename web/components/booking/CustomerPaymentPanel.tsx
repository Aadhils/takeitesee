'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type GatewayConfig = {
  enabled: boolean;
  provider: 'cashfree';
  mode: 'sandbox' | 'production';
};

type PaymentMethod = 'unselected' | 'online_gateway' | 'cash_on_service';
type PaymentMethodPayload = {
  payment_method?: PaymentMethod;
  payment_status?: string;
  booking_status?: string;
  cash_collected_at?: string | null;
  error?: string;
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
  const { locale, t } = useOperationalTranslations();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unselected');
  const [cashCollectedAt, setCashCollectedAt] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [methodBusy, setMethodBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const returnHandled = useRef(false);

  const paymentLabel = (value: string) => value === 'paid' ? t('pay.paid') : value === 'pending' ? t('pay.processing') : value === 'failed' ? t('pay.failed') : value === 'refunded' ? t('pay.refunded') : t('pay.unpaid');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch('/api/payments/config', { cache: 'no-store' }).then(async (response) => response.json() as Promise<GatewayConfig>),
      fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-method`, { cache: 'no-store' }).then(async (response) => {
        const payload = await response.json() as PaymentMethodPayload;
        if (!response.ok) throw new Error(payload.error || 'Payment method could not be loaded.');
        return payload;
      }),
    ]).then(([gatewayConfig, methodPayload]) => {
      if (cancelled) return;
      setConfig(gatewayConfig);
      setPaymentMethod(methodPayload.payment_method ?? 'unselected');
      setCashCollectedAt(methodPayload.cash_collected_at ?? null);
    }).catch(() => {
      if (!cancelled) setConfig({ enabled: false, provider: 'cashfree', mode: 'sandbox' });
    });
    return () => { cancelled = true; };
  }, [bookingId]);

  useEffect(() => {
    if (returnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_return') !== '1') return;
    const orderId = params.get('order_id') || params.get('cf_order_id');
    if (!orderId) return;
    returnHandled.current = true;
    setVerifying(true); setError(''); setNotice(t('pay.verifyStart'));

    void fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    }).then(async (response) => {
      const payload = await response.json() as VerifyPayload;
      if (!response.ok || !payload.verified) throw new Error(payload.error || 'Payment could not be verified.');
      if (payload.payment_status === 'paid') setNotice(t('pay.verifySuccess'));
      else if (payload.payment_status === 'failed') setNotice(payload.payment_message || t('pay.verifyFailed'));
      else if (payload.payment_status === 'unpaid' && payload.final) setNotice(t('pay.verifyUnpaid'));
      else setNotice(t('pay.verifyPending'));
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

  const selectPaymentMethod = async (method: 'cash_on_service' | 'online_gateway') => {
    if (!canPay || methodBusy) return;
    setMethodBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const payload = await response.json() as PaymentMethodPayload;
      if (!response.ok || !payload.payment_method) throw new Error(payload.error || 'Payment method could not be updated.');
      setPaymentMethod(payload.payment_method);
      setCashCollectedAt(payload.cash_collected_at ?? null);
      setNotice(method === 'cash_on_service' ? t('pay.cashSelectedNotice') : t('pay.onlineSelectedNotice'));
      await onPaymentUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payment method could not be updated.');
    } finally { setMethodBusy(false); }
  };

  const startCheckout = async () => {
    if (!config?.enabled || !canPay || busy || paymentMethod === 'cash_on_service') return;
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
      setPaymentMethod('online_gateway');
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
    {config?.enabled && paymentMethod !== 'cash_on_service' ? <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onLoad={() => setSdkReady(true)} onError={() => setError('Secure payment checkout could not be loaded.')} /> : null}
    <Card className="policy-card">
      <div className="section-heading">
        <div><span className="eyebrow">{t('pay.option')}</span><h2>{t('pay.title')}</h2></div>
        <Badge tone={paymentTone(paymentStatus)}>{paymentLabel(paymentStatus)}</Badge>
      </div>

      {paymentStatus === 'paid' && paymentMethod === 'cash_on_service' ? <p className="detail-copy">{t('pay.cashConfirmedPrefix')}{cashCollectedAt ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(cashCollectedAt))}` : ''}.</p> : null}
      {paymentStatus === 'paid' && paymentMethod !== 'cash_on_service' ? <p className="detail-copy">{t('pay.onlineRecorded')}</p> : null}
      {paymentStatus === 'refunded' ? <p className="detail-copy">{t('pay.refundedHelp')}</p> : null}
      {paymentStatus === 'pending' ? <p className="detail-copy">{t('pay.processingHelp')}</p> : null}
      {!['confirmed', 'completed'].includes(bookingStatus) && !['paid', 'refunded'].includes(paymentStatus) ? <p className="detail-copy">{t('pay.afterConfirm')}</p> : null}

      {canPay && paymentMethod === 'cash_on_service' ? <div style={{ display: 'grid', gap: '.8rem', marginTop: '1rem' }}>
        <Badge tone="success">{t('pay.cashSelected')}</Badge>
        <p className="detail-copy">{t('pay.cashDirect')}</p>
        {config?.enabled ? <Button type="button" variant="quiet" loading={methodBusy} disabled={methodBusy} onClick={() => void selectPaymentMethod('online_gateway')}>{t('pay.switchOnline')}</Button> : null}
      </div> : null}

      {canPay && paymentMethod !== 'cash_on_service' ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
        <div>
          <strong>{t('pay.cashOnService')}</strong>
          <p className="summary-note">{t('pay.cashHelp')}</p>
        </div>
        <Button type="button" variant={config?.enabled ? 'quiet' : undefined} loading={methodBusy} disabled={methodBusy || busy || verifying} onClick={() => void selectPaymentMethod('cash_on_service')}>{t('pay.cashAction')}</Button>
      </div> : null}

      {canPay && paymentMethod !== 'cash_on_service' && config && !config.enabled ? <p className="detail-copy" style={{ marginTop: '1rem' }}>{t('pay.onlineUnavailable')}</p> : null}

      {canPay && paymentMethod !== 'cash_on_service' && config?.enabled ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ececf2' }}>
        <div><strong>{t('pay.online')}</strong><p className="summary-note">{t('pay.onlineHelp')}</p></div>
        <label style={{ display: 'grid', gap: '.4rem' }}>
          <strong>{t('pay.mobile')}</strong>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^0-9+\s-]/g, '').slice(0, 16))}
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('pay.mobilePlaceholder')}
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }}
          />
          <span className="summary-note">{t('pay.mobileHelp')}</span>
        </label>
        <Button type="button" loading={busy || verifying} disabled={!sdkReady || busy || verifying || methodBusy} onClick={() => void startCheckout()}>
          {verifying ? t('pay.verifying') : sdkReady ? t('pay.secure') : t('pay.loadingCheckout')}
        </Button>
        <p className="summary-note">{t('pay.safety')}</p>
      </div> : null}

      {notice ? <p role="status" style={{ marginTop: '1rem' }}>{notice}</p> : null}
      {error ? <p role="alert" style={{ color: '#b42318', marginTop: '1rem' }}>{error}</p> : null}
    </Card>
  </>;
}
