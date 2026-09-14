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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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
      if (!response.ok) throw new Error(payload.error || 'Unable to load this Business product order.');
      const match = (payload.orders ?? []).find((candidate) => candidate.id === orderId) ?? null;
      setNotFound(!match);
      setOrder(match);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this Business product order.');
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
      cancelled: 'Customer cancelled',
    };
    const tamilCopy: Record<OrderStatus, string> = {
      requested: 'Order கோரிக்கை',
      accepted: 'ஏற்றுக்கொள்ளப்பட்டது',
      declined: 'நிராகரிக்கப்பட்டது',
      fulfilled: 'நிறைவேற்றப்பட்டது',
      cancelled: 'Customer ரத்து செய்தார்',
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
  const canDecide = order?.status === 'requested';
  const canFulfill = order?.status === 'accepted';

  const transition = async (action: OrderAction) => {
    if (!order) return;
    if (action === 'decline' && note.trim().length < 3) {
      setError(tamil ? 'Decline reason குறைந்தது 3 characters வேண்டும்.' : 'A decline reason of at least 3 characters is required.');
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
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Unable to update this order.');
      setNote('');
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update this order.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <LiveProviderShell active="/provider/orders"><div className={styles.detailPage}><Card><p>{tamil ? 'Order ஏற்றப்படுகிறது…' : 'Loading order…'}</p></Card></div></LiveProviderShell>;
  }

  if (notFound || !order) {
    return <LiveProviderShell active="/provider/orders"><div className={styles.detailPage}>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <Card>
        <EmptyState title={tamil ? 'Order கிடைக்கவில்லை' : 'Order not found'}>
          {tamil ? 'இந்த order இந்த Business workspace-ல் இல்லை அல்லது இனி கிடைக்கவில்லை.' : 'This order is not available in this Business workspace.'}
        </EmptyState>
        <div className="button-row"><Link href="/provider/orders" className="button button-secondary">{tamil ? 'Product orders' : 'Back to product orders'}</Link></div>
      </Card>
    </div></LiveProviderShell>;
  }

  return <LiveProviderShell active="/provider/orders">
    <div className={styles.detailPage}>
      <section className={styles.detailHero}>
        <div>
          <span className="eyebrow">{order.customer_name_snapshot}</span>
          <h1>{order.product_name_snapshot}</h1>
          <p>{tamil ? 'Customer product order' : 'Customer product order'} · {new Date(order.created_at).toLocaleString(locale)}</p>
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
              <div className={styles.infoRow}><span>{tamil ? 'Customer' : 'Customer'}</span><strong>{order.customer_name_snapshot}</strong></div>
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
              {order.customer_note ? <div className={styles.noteBox}><strong>{tamil ? 'Customer note' : 'Customer note'}</strong><p>{order.customer_note}</p></div> : null}
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
            {(canDecide || canFulfill) ? <Textarea
              label={canDecide
                ? (tamil ? 'Business note / decline reason' : 'Business note / decline reason')
                : (tamil ? 'Fulfilment note (optional)' : 'Fulfilment note (optional)')}
              hint={canDecide
                ? (tamil ? 'Decline செய்ய reason கட்டாயம்; Accept செய்ய optional.' : 'Required when declining; optional when accepting.')
                : (tamil ? 'Payment confirmation இங்கு சேர்க்க வேண்டாம்.' : 'Do not use this field as payment confirmation.')}
              value={note}
              maxLength={1200}
              onChange={(event) => setNote(event.target.value)}
            /> : null}

            <div className={styles.detailActions}>
              {canDecide ? <>
                <Button type="button" loading={busy === 'accept'} onClick={() => void transition('accept')}>{tamil ? 'Accept order' : 'Accept order'}</Button>
                <Button type="button" variant="danger" loading={busy === 'decline'} onClick={() => void transition('decline')}>{tamil ? 'Decline' : 'Decline'}</Button>
              </> : null}
              {canFulfill ? <Button type="button" loading={busy === 'fulfill'} onClick={() => void transition('fulfill')}>{tamil ? 'Mark fulfilled' : 'Mark fulfilled'}</Button> : null}
              {order.conversation_id ? <Link href={`/provider/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">{tamil ? 'Customer-க்கு message' : 'Message Customer'}</Link> : null}
              <Link href="/provider/orders" className="button button-secondary">{tamil ? 'Product orders' : 'Back to product orders'}</Link>
            </div>

            <p className={styles.flowNotice}>{tamil
              ? 'இது non-payment order-request flow. TakeItEsee payment/Cashfree இந்த order-ல் செயல்படாது.'
              : 'This is a non-payment order-request flow. TakeItEsee payment and Cashfree are not active for this order.'}</p>
          </Card>
        </aside>
      </div>
    </div>
  </LiveProviderShell>;
}
