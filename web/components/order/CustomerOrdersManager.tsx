'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

type OrderStatus = 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
type OrderActorType = 'customer' | 'business' | 'system';

type ProductOrderEvent = {
  id: string;
  order_id: string;
  actor_type: OrderActorType;
  event_type: OrderStatus;
  note: string | null;
  created_at: string;
};

type ProductOrder = {
  id: string;
  product_id: string;
  business_id: string;
  customer_user_id: string;
  product_revision: number;
  product_name_snapshot: string;
  business_name_snapshot: string;
  customer_name_snapshot: string;
  unit_price_snapshot: number;
  currency_snapshot: string;
  unit_label_snapshot: string;
  quantity: number;
  customer_note: string | null;
  business_note: string | null;
  status: OrderStatus;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
  events: ProductOrderEvent[];
};

function statusTone(status: OrderStatus) {
  if (status === 'fulfilled') return 'success' as const;
  if (status === 'accepted') return 'info' as const;
  if (status === 'requested') return 'warning' as const;
  return 'neutral' as const;
}

export default function CustomerOrdersManager() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: ProductOrder[]; error?: string };
      if (response.status === 401) {
        setAuthRequired(true);
        setOrders([]);
        return;
      }
      if (!response.ok) throw new Error(payload.error || 'Unable to load orders.');
      setAuthRequired(false);
      setOrders(payload.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (loading || !orders.length || typeof window === 'undefined') return;
    const targetId = window.location.hash.slice(1);
    if (!targetId.startsWith('order-')) return;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [loading, orders]);

  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const statusLabel = (status: OrderStatus) => {
    const english: Record<OrderStatus, string> = {
      requested: 'Requested',
      accepted: 'Accepted',
      declined: 'Declined',
      fulfilled: 'Fulfilled',
      cancelled: 'Cancelled',
    };
    const tamilCopy: Record<OrderStatus, string> = {
      requested: 'கோரப்பட்டது',
      accepted: 'ஏற்றுக்கொள்ளப்பட்டது',
      declined: 'நிராகரிக்கப்பட்டது',
      fulfilled: 'நிறைவேற்றப்பட்டது',
      cancelled: 'ரத்து செய்யப்பட்டது',
    };
    return tamil ? tamilCopy[status] : english[status];
  };

  const eventLabel = (status: OrderStatus) => {
    const english: Record<OrderStatus, string> = {
      requested: 'Order requested',
      accepted: 'Order accepted',
      declined: 'Order declined',
      fulfilled: 'Order fulfilled',
      cancelled: 'Order cancelled',
    };
    const tamilCopy: Record<OrderStatus, string> = {
      requested: 'Order கோரப்பட்டது',
      accepted: 'Order ஏற்றுக்கொள்ளப்பட்டது',
      declined: 'Order நிராகரிக்கப்பட்டது',
      fulfilled: 'Order நிறைவேற்றப்பட்டது',
      cancelled: 'Order ரத்து செய்யப்பட்டது',
    };
    return tamil ? tamilCopy[status] : english[status];
  };

  const actorLabel = (actorType: OrderActorType) => {
    if (actorType === 'customer') return tamil ? 'வாடிக்கையாளர்' : 'Customer';
    if (actorType === 'business') return tamil ? 'Business' : 'Business';
    return tamil ? 'System' : 'System';
  };

  const cancelOrder = async (orderId: string) => {
    setBusyOrderId(orderId);
    setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const payload = await response.json() as { order?: ProductOrder; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Unable to cancel this order.');
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel this order.');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (authRequired) {
    return <div className="bookings-page section-stack">
      <section className="page-intro">
        <span className="eyebrow">{tamil ? 'வாடிக்கையாளர் Orders' : 'Customer orders'}</span>
        <h1>{tamil ? 'என் product orders' : 'My product orders'}</h1>
        <p>{tamil ? 'உங்கள் order request history பார்க்க sign in செய்யவும்.' : 'Sign in to view your product order request history.'}</p>
      </section>
      <Card>
        <EmptyState title={tamil ? 'Sign in தேவை' : 'Sign in required'}>
          {tamil ? 'Product order requests உங்கள் Customer account-க்கு இணைக்கப்படும்.' : 'Product order requests are linked to your Customer account.'}
        </EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Forders" className="button button-primary">Sign in</Link>
          <Link href="/signup" className="button button-secondary">{tamil ? 'Account உருவாக்கவும்' : 'Create account'}</Link>
        </div>
      </Card>
    </div>;
  }

  return <div className="bookings-page section-stack">
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'வாடிக்கையாளர் Orders' : 'Customer orders'}</span>
      <h1>{tamil ? 'என் product orders' : 'My product orders'}</h1>
      <p>{tamil
        ? 'Business products-க்கு நீங்கள் அனுப்பிய non-payment order requests. TakeItEsee payment/Cashfree இந்த flow-ல் செயல்படாது.'
        : 'Your non-payment order requests for Business products. TakeItEsee payment and Cashfree are not active in this flow.'}</p>
    </section>

    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}
    {loading ? <Card><p>{tamil ? 'Orders ஏற்றப்படுகிறது…' : 'Loading orders…'}</p></Card> : null}

    {!loading && !orders.length ? <Card>
      <EmptyState title={tamil ? 'Order requests இன்னும் இல்லை' : 'No order requests yet'}>
        {tamil ? 'Approved Business storefront-ல் இருந்து product order request அனுப்பலாம்.' : 'Request an order from an approved Business storefront product.'}
      </EmptyState>
      <div className="button-row"><Link href="/explore" className="button button-secondary">{tamil ? 'Marketplace பார்க்க' : 'Explore marketplace'}</Link></div>
    </Card> : null}

    <div style={{ display: 'grid', gap: '1rem' }}>
      {orders.map((order) => {
        const total = order.unit_price_snapshot * order.quantity;
        const cancellable = order.status === 'requested' || order.status === 'accepted';
        return <div id={`order-${order.id}`} key={order.id} style={{ scrollMarginTop: '6rem' }}><Card style={{ display: 'grid', gap: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow">{order.business_name_snapshot}</span>
              <h2 style={{ margin: '.3rem 0' }}>{order.product_name_snapshot}</h2>
              <p style={{ margin: 0 }}>{order.quantity} × {money(order.unit_price_snapshot, order.currency_snapshot)} / {order.unit_label_snapshot}</p>
            </div>
            <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
          </div>
          <strong>{tamil ? 'Snapshot total' : 'Snapshot total'}: {money(total, order.currency_snapshot)}</strong>
          {order.customer_note ? <p style={{ margin: 0 }}><strong>{tamil ? 'உங்கள் note' : 'Your note'}:</strong> {order.customer_note}</p> : null}
          {order.business_note ? <p style={{ margin: 0 }}><strong>{tamil ? 'Business note' : 'Business note'}:</strong> {order.business_note}</p> : null}
          <p className="muted" style={{ margin: 0 }}>
            {tamil ? 'Requested' : 'Requested'} {new Date(order.created_at).toLocaleString(locale)} · Rev {order.product_revision}
          </p>

          {order.events.length ? <div style={{ borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: '.75rem' }}>
            <strong>{tamil ? 'Order activity' : 'Order activity'}</strong>
            <ol style={{ margin: '.55rem 0 0', paddingLeft: '1.25rem', display: 'grid', gap: '.55rem' }}>
              {order.events.map((event) => <li key={event.id}>
                <div>
                  <strong>{eventLabel(event.event_type)}</strong>
                  <span className="muted"> · {actorLabel(event.actor_type)} · {new Date(event.created_at).toLocaleString(locale)}</span>
                </div>
                {event.note ? <p className="muted" style={{ margin: '.2rem 0 0' }}>{event.note}</p> : null}
              </li>)}
            </ol>
          </div> : null}

          {(order.conversation_id || cancellable) ? <div className="button-row">
            {order.conversation_id ? <Link href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">
              {tamil ? 'Business-க்கு message' : 'Message Business'}
            </Link> : null}
            {cancellable ? <Button type="button" variant="secondary" loading={busyOrderId === order.id} onClick={() => void cancelOrder(order.id)}>
              {tamil ? 'Order request ரத்து செய்' : 'Cancel order request'}
            </Button> : null}
          </div> : null}
        </Card></div>;
      })}
    </div>
  </div>;
}
