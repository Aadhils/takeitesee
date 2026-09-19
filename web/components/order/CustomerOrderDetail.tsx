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
  const { locale, t } = useLanguage();
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
      if (!response.ok) throw new Error(payload.error || t('orders.detail.loadFallback'));
      const match = (payload.orders ?? []).find((candidate) => candidate.id === orderId) ?? null;
      setAuthRequired(false);
      setNotFound(!match);
      setOrder(match);
      if (match) {
        void fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_product_order_updates_read: true, order_id: match.id }),
        }).then((acknowledgement) => {
          if (acknowledgement.ok) window.dispatchEvent(new Event('customer-product-order-attention-refresh'));
        }).catch(() => {
          // Notification acknowledgement is best effort; order detail remains usable.
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('orders.detail.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => { void load(); }, [load]);

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

  const eventLabel = (status: OrderStatus) => {
    if (status === 'requested') return t('orders.detail.event.requested');
    if (status === 'accepted') return t('orders.detail.event.accepted');
    if (status === 'declined') return t('orders.detail.event.declined');
    if (status === 'fulfilled') return t('orders.detail.event.fulfilled');
    return t('orders.detail.event.cancelled');
  };

  const actorLabel = (actorType: OrderActorType) => {
    if (actorType === 'customer') return t('orders.detail.actor.customer');
    if (actorType === 'business') return t('orders.detail.actor.business');
    return t('orders.detail.actor.system');
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
      if (!response.ok || !payload.order) throw new Error(payload.error || t('orders.cancelFallback'));
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('orders.cancelFallback'));
    } finally {
      setCancelling(false);
    }
  };

  if (authRequired) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}>
      <section className="page-intro">
        <span className="eyebrow">{t('orders.detail.productOrder')}</span>
        <h1>{t('orders.signInRequired')}</h1>
        <p>{t('orders.detail.signInHelp')}</p>
      </section>
      <Card>
        <div className="button-row">
          <Link href={`/login?returnTo=${encodeURIComponent(`/orders/${orderId}`)}`} className="button button-primary">{t('orders.signIn')}</Link>
          <Link href="/orders" className="button button-secondary">{t('orders.detail.backToOrders')}</Link>
        </div>
      </Card>
    </div>;
  }

  if (loading) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}><Card><p>{t('orders.detail.loading')}</p></Card></div>;
  }

  if (notFound || !order) {
    return <div className={`bookings-page section-stack ${styles.detailPage}`}>
      <Card>
        <EmptyState title={t('orders.detail.notFoundTitle')}>
          {t('orders.detail.notFoundHelp')}
        </EmptyState>
        <div className="button-row"><Link href="/orders" className="button button-secondary">{t('orders.detail.myOrders')}</Link></div>
      </Card>
    </div>;
  }

  return <div className={`bookings-page section-stack ${styles.detailPage}`}>
    <section className={styles.detailHero}>
      <div>
        <span className="eyebrow">{order.business_name_snapshot}</span>
        <h1>{order.product_name_snapshot}</h1>
        <p>{t('orders.detail.requestLabel')} · {new Date(order.created_at).toLocaleString(locale)}</p>
      </div>
      <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
    </section>

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}

    <div className={styles.detailLayout}>
      <main className={styles.detailMain}>
        <Card className={styles.detailCard}>
          <span className="eyebrow">{t('orders.detail.informationEyebrow')}</span>
          <h2>{t('orders.detail.snapshotTitle')}</h2>
          <div className={styles.infoRows}>
            <div className={styles.infoRow}><span>{t('orders.detail.business')}</span><strong>{order.business_name_snapshot}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.detail.quantity')}</span><strong>{order.quantity} {order.unit_label_snapshot}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.detail.unitPrice')}</span><strong>{money(order.unit_price_snapshot, order.currency_snapshot)}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.snapshotTotal')}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.requestedAt')}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.detail.statusUpdated')}</span><strong>{new Date(order.status_changed_at).toLocaleString(locale)}</strong></div>
            <div className={styles.infoRow}><span>{t('orders.detail.productRevision')}</span><strong>Rev {order.product_revision}</strong></div>
          </div>
        </Card>

        {(order.customer_note || order.business_note) ? <Card className={styles.detailCard}>
          <span className="eyebrow">{t('orders.detail.notesEyebrow')}</span>
          <h2>{t('orders.detail.notesTitle')}</h2>
          <div className={styles.notes}>
            {order.customer_note ? <div className={styles.noteBox}><strong>{t('orders.detail.yourNote')}</strong><p>{order.customer_note}</p></div> : null}
            {order.business_note ? <div className={styles.noteBox}><strong>{t('orders.detail.businessNote')}</strong><p>{order.business_note}</p></div> : null}
          </div>
        </Card> : null}

        <Card className={styles.detailCard}>
          <span className="eyebrow">{t('orders.detail.activityEyebrow')}</span>
          <h2>{t('orders.detail.timelineTitle')}</h2>
          {order.events.length ? <ol className={styles.timeline}>
            {order.events.map((event) => <li key={event.id} className={styles.timelineItem}>
              <div className={styles.timelineHeading}>
                <strong>{eventLabel(event.event_type)}</strong>
                <Badge tone={statusTone(event.event_type)}>{actorLabel(event.actor_type)}</Badge>
              </div>
              {event.note ? <p>{event.note}</p> : null}
              <p className={styles.timelineMeta}>{new Date(event.created_at).toLocaleString(locale)}</p>
            </li>)}
          </ol> : <EmptyState title={t('orders.detail.noActivityTitle')}>{t('orders.detail.noActivityHelp')}</EmptyState>}
        </Card>
      </main>

      <aside className={styles.detailAside}>
        <Card className={styles.detailCard}>
          <span className="eyebrow">{t('orders.detail.actionsEyebrow')}</span>
          <div className={styles.detailActions}>
            <Link href="/orders" className="button button-secondary">{t('orders.detail.backToOrders')}</Link>
            {order.conversation_id ? <Link href={`/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-primary">{t('orders.messageBusiness')}</Link> : null}
            {cancellable ? <Button type="button" variant="secondary" loading={cancelling} onClick={() => void cancelOrder()}>{t('orders.cancelRequest')}</Button> : null}
          </div>
          <p className={styles.flowNotice}>{t('orders.detail.flowNotice')}</p>
        </Card>
      </aside>
    </div>
  </div>;
}
