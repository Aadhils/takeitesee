'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Textarea } from '../ui/primitives';
import { LiveProviderShell } from './LiveProviderShell';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderOrders.module.css';

type OrderStatus = 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
type OrderAction = 'accept' | 'decline' | 'fulfill';
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

export default function ProviderOrderDetail({ orderId }: { orderId: string }) {
  const { locale, t } = useIdentityWorkspaceTranslations();
  const [order, setOrder] = useState<ProductOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<OrderAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: ProductOrder[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t('provider.orders.detailLoadFallback'));
      const match = (payload.orders ?? []).find((candidate) => candidate.id === orderId) ?? null;
      setNotFound(!match);
      setOrder(match);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('provider.orders.detailLoadFallback'));
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

  const statusLabel = (status: OrderStatus) => ({
    requested: t('provider.orders.statusRequested'),
    accepted: t('provider.orders.statusAccepted'),
    declined: t('provider.orders.statusDeclined'),
    fulfilled: t('provider.orders.statusFulfilled'),
    cancelled: t('provider.orders.statusCancelled'),
  })[status];

  const eventLabel = (status: OrderStatus) => ({
    requested: t('provider.orders.eventRequested'),
    accepted: t('provider.orders.eventAccepted'),
    declined: t('provider.orders.eventDeclined'),
    fulfilled: t('provider.orders.eventFulfilled'),
    cancelled: t('provider.orders.eventCancelled'),
  })[status];

  const actorLabel = (actorType: OrderActorType) => {
    if (actorType === 'customer') return t('provider.orders.actorCustomer');
    if (actorType === 'business') return t('provider.orders.actorBusiness');
    return t('provider.orders.actorSystem');
  };

  const total = useMemo(() => order ? order.unit_price_snapshot * order.quantity : 0, [order]);
  const canDecide = order?.status === 'requested';
  const canFulfill = order?.status === 'accepted';

  const transition = async (action: OrderAction) => {
    if (!order) return;
    if (action === 'decline' && note.trim().length < 3) {
      setError(t('provider.orders.declineReasonRequired'));
      return;
    }
    setBusy(action);
    setError('');
    try {
      const response = await fetch(`/api/provider/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || null }),
      });
      const payload = await response.json() as { order?: ProductOrder; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error || t('provider.orders.updateFallback'));
      setNote('');
      window.dispatchEvent(new Event('provider-product-orders-refresh'));
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : t('provider.orders.updateFallback'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <LiveProviderShell active="/provider/orders"><div className={styles.detailPage}><Card><p>{t('provider.orders.detailLoading')}</p></Card></div></LiveProviderShell>;
  }

  if (notFound || !order) {
    return <LiveProviderShell active="/provider/orders"><div className={styles.detailPage}>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <Card>
        <EmptyState title={t('provider.orders.notFoundTitle')}>
          {t('provider.orders.notFoundBody')}
        </EmptyState>
        <div className="button-row"><Link href="/provider/orders" className="button button-secondary">{t('provider.orders.backOrders')}</Link></div>
      </Card>
    </div></LiveProviderShell>;
  }

  return <LiveProviderShell active="/provider/orders">
    <div className={styles.detailPage}>
      <section className={styles.detailHero}>
        <div>
          <span className="eyebrow">{order.customer_name_snapshot}</span>
          <h1>{order.product_name_snapshot}</h1>
          <p>{t('provider.orders.customerProductOrder')} · {new Date(order.created_at).toLocaleString(locale)}</p>
        </div>
        <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
      </section>

      {error ? <p role="alert" className={styles.error}>{error}</p> : null}

      <div className={styles.detailLayout}>
        <main className={styles.detailMain}>
          <Card className={styles.detailCard}>
            <span className="eyebrow">{t('provider.orders.orderInformation')}</span>
            <h2>{t('provider.orders.orderSnapshot')}</h2>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}><span>{t('provider.orders.customerLabel')}</span><strong>{order.customer_name_snapshot}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.quantityLabel')}</span><strong>{order.quantity} {order.unit_label_snapshot}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.unitPriceLabel')}</span><strong>{money(order.unit_price_snapshot, order.currency_snapshot)}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.snapshotTotal')}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.requestedLabel')}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.statusUpdatedLabel')}</span><strong>{new Date(order.status_changed_at).toLocaleString(locale)}</strong></div>
              <div className={styles.infoRow}><span>{t('provider.orders.productRevisionLabel')}</span><strong>Rev {order.product_revision}</strong></div>
            </div>
          </Card>

          {(order.customer_note || order.business_note) ? <Card className={styles.detailCard}>
            <span className="eyebrow">{t('provider.orders.orderNotes')}</span>
            <h2>{t('provider.orders.requestNotes')}</h2>
            <div className={styles.notes}>
              {order.customer_note ? <div className={styles.noteBox}><strong>{t('provider.orders.customerNote')}</strong><p>{order.customer_note}</p></div> : null}
              {order.business_note ? <div className={styles.noteBox}><strong>{t('provider.orders.businessNote')}</strong><p>{order.business_note}</p></div> : null}
            </div>
          </Card> : null}

          <Card className={styles.detailCard}>
            <span className="eyebrow">{t('provider.orders.orderActivity')}</span>
            <h2>{t('provider.orders.timeline')}</h2>
            {order.events.length ? <ol className={styles.timeline}>
              {order.events.map((event) => <li key={event.id} className={styles.timelineItem}>
                <div className={styles.timelineHeading}>
                  <strong>{eventLabel(event.event_type)}</strong>
                  <Badge tone={statusTone(event.event_type)}>{actorLabel(event.actor_type)}</Badge>
                </div>
                {event.note ? <p>{event.note}</p> : null}
                <p className={styles.timelineMeta}>{new Date(event.created_at).toLocaleString(locale)}</p>
              </li>)}
            </ol> : <EmptyState title={t('provider.orders.noActivityTitle')}>{t('provider.orders.noActivityBody')}</EmptyState>}
          </Card>
        </main>

        <aside className={styles.detailAside}>
          <Card className={styles.detailCard}>
            <span className="eyebrow">{t('provider.orders.actions')}</span>
            {(canDecide || canFulfill) ? <Textarea
              label={canDecide
                ? t('provider.orders.businessNoteDecline')
                : t('provider.orders.fulfilmentNote')}
              hint={canDecide
                ? t('provider.orders.decisionHint')
                : t('provider.orders.fulfilmentHint')}
              value={note}
              maxLength={1200}
              onChange={(event) => setNote(event.target.value)}
            /> : null}

            <div className={styles.detailActions}>
              {canDecide ? <>
                <Button type="button" loading={busy === 'accept'} onClick={() => void transition('accept')}>{t('provider.orders.acceptOrder')}</Button>
                <Button type="button" variant="danger" loading={busy === 'decline'} onClick={() => void transition('decline')}>{t('provider.orders.decline')}</Button>
              </> : null}
              {canFulfill ? <Button type="button" loading={busy === 'fulfill'} onClick={() => void transition('fulfill')}>{t('provider.orders.markFulfilled')}</Button> : null}
              {order.conversation_id ? <Link href={`/provider/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">{t('provider.orders.messageCustomer')}</Link> : null}
              <Link href="/provider/orders" className="button button-secondary">{t('provider.orders.backOrders')}</Link>
            </div>

            <p className={styles.flowNotice}>{t('provider.orders.flowNotice')}</p>
          </Card>
        </aside>
      </div>
    </div>
  </LiveProviderShell>;
}
