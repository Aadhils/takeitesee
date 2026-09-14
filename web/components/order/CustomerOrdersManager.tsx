'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './CustomerOrders.module.css';

type OrderStatus = 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
type OrderView = 'all' | 'active' | 'fulfilled' | 'closed';

type ProductOrderEvent = {
  id: string;
  order_id: string;
  actor_type: 'customer' | 'business' | 'system';
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

function orderMatchesView(status: OrderStatus, view: OrderView) {
  if (view === 'all') return true;
  if (view === 'active') return status === 'requested' || status === 'accepted';
  if (view === 'fulfilled') return status === 'fulfilled';
  return status === 'declined' || status === 'cancelled';
}

export default function CustomerOrdersManager() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [view, setView] = useState<OrderView>('all');

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
    return <div className={`bookings-page section-stack ${styles.page}`}>
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

  const lifecycleCounts: Record<OrderView, number> = {
    all: orders.length,
    active: orders.filter((order) => order.status === 'requested' || order.status === 'accepted').length,
    fulfilled: orders.filter((order) => order.status === 'fulfilled').length,
    closed: orders.filter((order) => order.status === 'declined' || order.status === 'cancelled').length,
  };
  const lifecycleItems: Array<{ key: OrderView; label: string; count: number }> = [
    { key: 'all', label: tamil ? 'அனைத்தும்' : 'All', count: lifecycleCounts.all },
    { key: 'active', label: tamil ? 'செயலில்' : 'Active', count: lifecycleCounts.active },
    { key: 'fulfilled', label: tamil ? 'நிறைவேற்றப்பட்டது' : 'Fulfilled', count: lifecycleCounts.fulfilled },
    { key: 'closed', label: tamil ? 'மூடப்பட்டது' : 'Closed', count: lifecycleCounts.closed },
  ];
  const visibleOrders = orders.filter((order) => orderMatchesView(order.status, view));

  return <div className={`bookings-page section-stack ${styles.page}`}>
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'வாடிக்கையாளர் Orders' : 'Customer orders'}</span>
      <h1>{tamil ? 'என் product orders' : 'My product orders'}</h1>
      <p>{tamil
        ? 'Business products-க்கு நீங்கள் அனுப்பிய non-payment order requests. TakeItEsee payment/Cashfree இந்த flow-ல் செயல்படாது.'
        : 'Track your non-payment order requests for Business products and open any order for its full activity history.'}</p>
    </section>

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {loading ? <Card><p>{tamil ? 'Orders ஏற்றப்படுகிறது…' : 'Loading orders…'}</p></Card> : null}

    {!loading && !orders.length ? <Card className={styles.emptyOrdersCard}>
      <div className={styles.emptyOrdersState}>
        <EmptyState title={tamil ? 'Order requests இன்னும் இல்லை' : 'No order requests yet'}>
          {tamil ? 'Approved Business storefront-ல் இருந்து product order request அனுப்பலாம்.' : 'Request an order from an approved Business storefront product.'}
        </EmptyState>
      </div>
      <div className={`button-row ${styles.emptyOrdersActions}`}><Link href="/products" className="button button-secondary">{tamil ? 'Products பார்க்க' : 'Browse products'}</Link></div>
    </Card> : null}

    {!loading && orders.length ? <section className={styles.lifecycleSection} aria-label={tamil ? 'Order நிலை filter' : 'Order status filter'}>
      <div className={styles.lifecycleSummary}>
        {lifecycleItems.map((item) => <button
          key={item.key}
          type="button"
          className={`${styles.lifecycleButton} ${view === item.key ? styles.lifecycleButtonActive : ''}`}
          aria-pressed={view === item.key}
          onClick={() => setView(item.key)}
        >
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </button>)}
      </div>
      <p className={styles.lifecycleMeta}>{tamil
        ? `${visibleOrders.length} / ${orders.length} orders காண்பிக்கப்படுகிறது`
        : `Showing ${visibleOrders.length} of ${orders.length} orders`}</p>
    </section> : null}

    {!loading && orders.length && !visibleOrders.length ? <Card className={styles.filteredEmptyCard}>
      <div>
        <strong>{tamil ? 'இந்த பிரிவில் orders இல்லை' : 'No orders in this group'}</strong>
        <p>{tamil ? 'வேறு lifecycle filter தேர்வு செய்யவும்.' : 'Choose another lifecycle filter to continue.'}</p>
      </div>
      <Button type="button" variant="secondary" onClick={() => setView('all')}>
        {tamil ? 'அனைத்து orders' : 'Show all orders'}
      </Button>
    </Card> : null}

    <div className={styles.ordersList}>
      {visibleOrders.map((order) => {
        const total = order.unit_price_snapshot * order.quantity;
        const cancellable = order.status === 'requested' || order.status === 'accepted';
        const latestEvent = order.events.at(-1);
        return <div id={`order-${order.id}`} key={order.id} className={styles.orderAnchor}>
          <Card className={styles.orderCard}>
            <div className={styles.orderHeader}>
              <div className={styles.orderTitle}>
                <span className="eyebrow">{order.business_name_snapshot}</span>
                <h2>{order.product_name_snapshot}</h2>
                <p>{order.quantity} × {money(order.unit_price_snapshot, order.currency_snapshot)} / {order.unit_label_snapshot}</p>
              </div>
              <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
            </div>

            <div className={styles.summaryGrid}>
              <div><span>{tamil ? 'மொத்தம்' : 'Snapshot total'}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
              <div><span>{tamil ? 'கோரிய நேரம்' : 'Requested'}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
              <div><span>{tamil ? 'Revision' : 'Revision'}</span><strong>Rev {order.product_revision}</strong></div>
            </div>

            {latestEvent ? <p className={styles.latestActivity}>
              <strong>{tamil ? 'Latest' : 'Latest'}:</strong> {statusLabel(latestEvent.event_type)} · {new Date(latestEvent.created_at).toLocaleString(locale)}
            </p> : null}

            <div className={styles.orderActions}>
              <Link href={`/orders/${encodeURIComponent(order.id)}`} className="button button-primary">
                {tamil ? 'Order details பார்க்க' : 'View order details'}
              </Link>
              {order.conversation_id ? <Link href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">
                {tamil ? 'Business-க்கு message' : 'Message Business'}
              </Link> : null}
              {cancellable ? <Button type="button" variant="secondary" loading={busyOrderId === order.id} onClick={() => void cancelOrder(order.id)}>
                {tamil ? 'Order request ரத்து செய்' : 'Cancel order request'}
              </Button> : null}
            </div>
          </Card>
        </div>;
      })}
    </div>
  </div>;
}
