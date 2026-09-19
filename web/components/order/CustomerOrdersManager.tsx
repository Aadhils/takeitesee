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
  const { locale, t } = useLanguage();
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
      if (!response.ok) throw new Error(payload.error || t('orders.loadFallback'));
      setAuthRequired(false);
      setOrders(payload.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('orders.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    if (status === 'requested') return t('orders.status.requested');
    if (status === 'accepted') return t('orders.status.accepted');
    if (status === 'declined') return t('orders.status.declined');
    if (status === 'fulfilled') return t('orders.status.fulfilled');
    return t('orders.status.cancelled');
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
      if (!response.ok || !payload.order) throw new Error(payload.error || t('orders.cancelFallback'));
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('orders.cancelFallback'));
    } finally {
      setBusyOrderId(null);
    }
  };

  if (authRequired) {
    return <div className={`bookings-page section-stack ${styles.page}`}>
      <section className="page-intro">
        <span className="eyebrow">{t('orders.customerEyebrow')}</span>
        <h1>{t('orders.title')}</h1>
        <p>{t('orders.signInIntro')}</p>
      </section>
      <Card>
        <EmptyState title={t('orders.signInRequired')}>
          {t('orders.signInHelp')}
        </EmptyState>
        <div className="button-row">
          <Link href="/login?returnTo=%2Forders" className="button button-primary">{t('orders.signIn')}</Link>
          <Link href="/signup" className="button button-secondary">{t('orders.createAccount')}</Link>
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
    { key: 'all', label: t('orders.viewAll'), count: lifecycleCounts.all },
    { key: 'active', label: t('orders.viewActive'), count: lifecycleCounts.active },
    { key: 'fulfilled', label: t('orders.viewFulfilled'), count: lifecycleCounts.fulfilled },
    { key: 'closed', label: t('orders.viewClosed'), count: lifecycleCounts.closed },
  ];
  const visibleOrders = orders.filter((order) => orderMatchesView(order.status, view));

  return <div className={`bookings-page section-stack ${styles.page}`}>
    <section className="page-intro">
      <span className="eyebrow">{t('orders.customerEyebrow')}</span>
      <h1>{t('orders.title')}</h1>
      <p>{t('orders.intro')}</p>
    </section>

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {loading ? <Card><p>{t('orders.loading')}</p></Card> : null}

    {!loading && !orders.length ? <Card className={styles.emptyOrdersCard}>
      <div className={styles.emptyOrdersState}>
        <EmptyState title={t('orders.emptyTitle')}>
          {t('orders.emptyHelp')}
        </EmptyState>
      </div>
      <div className={`button-row ${styles.emptyOrdersActions}`}><Link href="/products" className="button button-secondary">{t('orders.browseProducts')}</Link></div>
    </Card> : null}

    {!loading && orders.length ? <section className={styles.lifecycleSection} aria-label={t('orders.filterAria')}>
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
      <p className={styles.lifecycleMeta}>{t('orders.lifecycleMeta').replace('{visible}', String(visibleOrders.length)).replace('{total}', String(orders.length))}</p>
    </section> : null}

    {!loading && orders.length && !visibleOrders.length ? <Card className={styles.filteredEmptyCard}>
      <div>
        <strong>{t('orders.filteredEmptyTitle')}</strong>
        <p>{t('orders.filteredEmptyHelp')}</p>
      </div>
      <Button type="button" variant="secondary" onClick={() => setView('all')}>
        {t('orders.showAll')}
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
              <div><span>{t('orders.snapshotTotal')}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
              <div><span>{t('orders.requestedAt')}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
              <div><span>{t('orders.revision')}</span><strong>Rev {order.product_revision}</strong></div>
            </div>

            {latestEvent ? <p className={styles.latestActivity}>
              <strong>{t('orders.latest')}:</strong> {statusLabel(latestEvent.event_type)} · {new Date(latestEvent.created_at).toLocaleString(locale)}
            </p> : null}

            <div className={styles.orderActions}>
              <Link href={`/orders/${encodeURIComponent(order.id)}`} className="button button-primary">
                {t('orders.viewDetails')}
              </Link>
              {order.conversation_id ? <Link href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">
                {t('orders.messageBusiness')}
              </Link> : null}
              {cancellable ? <Button type="button" variant="secondary" loading={busyOrderId === order.id} onClick={() => void cancelOrder(order.id)}>
                {t('orders.cancelRequest')}
              </Button> : null}
            </div>
          </Card>
        </div>;
      })}
    </div>
  </div>;
}
