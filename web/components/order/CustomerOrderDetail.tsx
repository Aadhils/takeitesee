'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './CustomerOrders.module.css';

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

export default function CustomerOrderDetail({ orderId }: { orderId: string }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [order, setOrder] = useState<ProductOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: ProductOrder[]; error?: string };
      if (response.status === 401) {
        setAuthRequired(true);
        setOrder(null);
        return;
      }
      if (!response.ok) throw new Error(payload.error || 'Unable to load this order.');
      const match = (payload.orders ?? []).find((candidate) => candidate.id === orderId) ?? null;
      setAuthRequired(false);
      setNotFound(!match);
      setOrder(match);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

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
    if (actorType === 'business') return 'Business';
    return 'System';
  };

  const total = useMemo(() => order ? order.unit_price_snapshot * order.quantity : 0, [order]);
  const cancellable = order?.status === 'requested' || order?.status === 'accepted';

  const cancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
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
      setCancelling(false);
    }
  };

  if (authRequired) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}>
      <section className="page-intro">
        <span className="eyebrow">{tamil ? 'Product order' : 'Product order'}</span>
        <h1>{tamil ? 'Sign in தேவை' : 'Sign in required'}</h1>
        <p>{tamil ? 'இந்த order பார்க்க Customer account-ல் sign in செய்யவும்.' : 'Sign in to view this Customer product order.'}</p>
      </section>
      <Card>
        <div className="button-row">
          <Link href={`/login?returnTo=${encodeURIComponent(`/orders/${orderId}`)}`} className="button button-primary">Sign in</Link>
          <Link href="/orders" className="button button-secondary">{tamil ? 'Orders-க்கு திரும்பு' : 'Back to orders'}</Link>
        </div>
      </Card>
    </div>;
  }

  if (loading) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}><Card><p>{tamil ? 'Order ஏற்றப்படுகிறது…' : 'Loading order…'}</p></Card></div>;
  }

  if (notFound || !order) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}>
      <Card>
        <EmptyState title={tamil ? 'Order கிடைக்கவில்லை' : 'Order not found'}>
          {tamil ? 'இந்த order உங்கள் Customer account-ல் இல்லை அல்லது இனி கிடைக்கவில்லை.' : 'This order is not available in your Customer account.'}
        </EmptyState>
        <div className="button-row"><Link href="/orders" className="button button-secondary">{tamil ? 'என் orders' : 'My orders'}</Link></div>
      </Card>
    </div>;
  }

  return <div className={`bookings-page section-stack ${styles.detailPage}`}>
    <section className={styles.detailHero}>
      <div>
        <span className="eyebrow">{order.business_name_snapshot}</span>
        <h1>{order.product_name_snapshot}</h1>
        <p>{tamil ? 'Product order request' : 'Product order request'} · {new Date(order.created_at).toLocaleString(locale)}</p>
      </div>
      <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
    </section>

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}

    <div className={styles.detailLayout}>
      <main className={styles.detailMain}>
        <Card className={styles.detailCard}>
          <span className="eyebrow">{tamil ? 'ORDER INFORMATION' : 'ORDER INFORMATION'}</span>
          <h2>{tamil ? 'Order snapshot' : 'Order snapshot'}</h2>
          <div className={styles.infoRows}>
            <div className={styles.infoRow}><span>{tamil ? 'Business' : 'Business'}</span><strong>{order.business_name_snapshot}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Quantity' : 'Quantity'}</span><strong>{order.quantity} {order.unit_label_snapshot}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Unit price' : 'Unit price'}</span><strong>{money(order.unit_price_snapshot, order.currency_snapshot)}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Snapshot total' : 'Snapshot total'}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Requested' : 'Requested'}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Status updated' : 'Status updated'}</span><strong>{new Date(order.status_changed_at).toLocaleString(locale)}</strong></div>
            <div className={styles.infoRow}><span>{tamil ? 'Product revision' : 'Product revision'}</span><strong>Rev {order.product_revision}</strong></div>
          </div>
        </Card>

        {(order.customer_note || order.business_note) ? <Card className={styles.detailCard}>
          <span className="eyebrow">{tamil ? 'ORDER NOTES' : 'ORDER NOTES'}</span>
          <h2>{tamil ? 'Request notes' : 'Request notes'}</h2>
          <div className={styles.notes}>
            {order.customer_note ? <div className={styles.noteBox}><strong>{tamil ? 'உங்கள் note' : 'Your note'}</strong><p>{order.customer_note}</p></div> : null}
            {order.business_note ? <div className={styles.noteBox}><strong>{tamil ? 'Business note' : 'Business note'}</strong><p>{order.business_note}</p></div> : null}
          </div>
        </Card> : null}

        <Card className={styles.detailCard}>
          <span className="eyebrow">{tamil ? 'ORDER ACTIVITY' : 'ORDER ACTIVITY'}</span>
          <h2>{tamil ? 'Order timeline' : 'Order timeline'}</h2>
          {order.events.length ? <ol className={styles.timeline}>
            {order.events.map((event) => <li key={event.id} className={styles.timelineItem}>
              <div className={styles.timelineHeading}>
                <strong>{eventLabel(event.event_type)}</strong>
                <Badge tone={statusTone(event.event_type)}>{actorLabel(event.actor_type)}</Badge>
              </div>
              {event.note ? <p>{event.note}</p> : null}
              <p className={styles.timelineMeta}>{new Date(event.created_at).toLocaleString(locale)}</p>
            </li>)}
          </ol> : <EmptyState title={tamil ? 'Activity இன்னும் இல்லை' : 'No activity yet'}>{tamil ? 'Order status updates இங்கே தோன்றும்.' : 'Order status updates will appear here.'}</EmptyState>}
        </Card>
      </main>

      <aside className={styles.detailAside}>
        <Card className={styles.detailCard}>
          <span className="eyebrow">{tamil ? 'ACTIONS' : 'ACTIONS'}</span>
          <div className={styles.detailActions}>
            <Link href="/orders" className="button button-secondary">{tamil ? 'என் orders' : 'Back to orders'}</Link>
            {order.conversation_id ? <Link href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-primary">{tamil ? 'Business-க்கு message' : 'Message Business'}</Link> : null}
            {cancellable ? <Button type="button" variant="secondary" loading={cancelling} onClick={() => void cancelOrder()}>{tamil ? 'Order request ரத்து செய்' : 'Cancel order request'}</Button> : null}
          </div>
          <p className={styles.flowNotice}>{tamil
            ? 'இது non-payment order request flow. TakeItEsee payment/Cashfree இந்த order-ல் செயல்படாது.'
            : 'This is a non-payment order-request flow. TakeItEsee payment and Cashfree are not active for this order.'}</p>
        </Card>
      </aside>
    </div>
  </div>;
}
