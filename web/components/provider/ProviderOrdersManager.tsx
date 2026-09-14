'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderOrders.module.css';

type OrderStatus = 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
type OrderActorType = 'customer' | 'business' | 'system';
type OrderView = 'new' | 'accepted' | 'fulfilled' | 'closed';

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

function orderMatchesView(status: OrderStatus, view: OrderView) {
  if (view === 'new') return status === 'requested';
  if (view === 'accepted') return status === 'accepted';
  if (view === 'fulfilled') return status === 'fulfilled';
  return status === 'declined' || status === 'cancelled';
}

export default function ProviderOrdersManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<OrderView>('new');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: ProductOrder[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load Business product orders.');
      setOrders(payload.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Business product orders.');
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

  const counts: Record<OrderView, number> = {
    new: orders.filter((order) => order.status === 'requested').length,
    accepted: orders.filter((order) => order.status === 'accepted').length,
    fulfilled: orders.filter((order) => order.status === 'fulfilled').length,
    closed: orders.filter((order) => order.status === 'declined' || order.status === 'cancelled').length,
  };
  const lifecycleItems: Array<{ key: OrderView; label: string; count: number }> = [
    { key: 'new', label: tamil ? 'புதியது' : 'New', count: counts.new },
    { key: 'accepted', label: tamil ? 'ஏற்றது' : 'Accepted', count: counts.accepted },
    { key: 'fulfilled', label: tamil ? 'முடிந்தது' : 'Fulfilled', count: counts.fulfilled },
    { key: 'closed', label: tamil ? 'மூடப்பட்டது' : 'Closed', count: counts.closed },
  ];
  const visibleOrders = orders.filter((order) => orderMatchesView(order.status, view));

  return <LiveProviderShell active="/provider/orders">
    <div className={styles.page}>
      <ProviderHeading
        eyebrow={tamil ? 'Business sales' : 'Business sales'}
        title={tamil ? 'Product orders' : 'Product orders'}
        description={tamil
          ? 'Customer non-payment order requests-ஐ review செய்து manage செய்யுங்கள். Payment/Cashfree இங்கு செயல்படாது.'
          : 'Review and manage Customer non-payment product order requests. Payment and Cashfree are not active here.'}
      />

      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {loading ? <Card><p>{tamil ? 'Product orders ஏற்றப்படுகிறது…' : 'Loading product orders…'}</p></Card> : null}

      {!loading && !orders.length && !error ? <Card className={styles.emptyCard}>
        <EmptyState title={tamil ? 'Product order requests இன்னும் இல்லை' : 'No product order requests yet'}>
          {tamil ? 'Public-approved product-ஐ Customer request செய்த பிறகு orders இங்கே தெரியும்.' : 'Orders will appear here after a Customer requests a public-approved product.'}
        </EmptyState>
      </Card> : null}

      {!loading && orders.length ? <section className={styles.lifecycleSection} aria-label={tamil ? 'Business order filter' : 'Business order filter'}>
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
          ? `${visibleOrders.length} orders காட்டப்படுகிறது`
          : `Showing ${visibleOrders.length} orders`}</p>
      </section> : null}

      {!loading && orders.length && !visibleOrders.length ? <Card className={styles.filteredEmptyCard}>
        <strong>{tamil ? 'இந்த நிலையில் orders இல்லை' : 'No orders in this status'}</strong>
        <p>{tamil ? 'மேலே வேறு status தேர்வு செய்யவும்.' : 'Choose another status above to continue.'}</p>
      </Card> : null}

      <div className={styles.ordersList}>
        {visibleOrders.map((order) => {
          const total = order.unit_price_snapshot * order.quantity;
          const latestEvent = order.events.at(-1);
          return <div id={`order-${order.id}`} key={order.id} className={styles.orderAnchor}>
            <Card className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <div className={styles.orderTitle}>
                  <span className="eyebrow">{order.customer_name_snapshot}</span>
                  <h2>{order.product_name_snapshot}</h2>
                  <p>{order.quantity} × {money(order.unit_price_snapshot, order.currency_snapshot)} / {order.unit_label_snapshot}</p>
                </div>
                <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
              </div>

              <div className={styles.summaryGrid}>
                <div><span>{tamil ? 'மொத்தம்' : 'Snapshot total'}</span><strong>{money(total, order.currency_snapshot)}</strong></div>
                <div><span>{tamil ? 'கோரப்பட்டது' : 'Requested'}</span><strong>{new Date(order.created_at).toLocaleString(locale)}</strong></div>
                <div><span>{tamil ? 'Revision' : 'Revision'}</span><strong>Rev {order.product_revision}</strong></div>
              </div>

              {latestEvent ? <p className={styles.latestActivity}>
                <strong>{tamil ? 'Latest' : 'Latest'}:</strong> {statusLabel(latestEvent.event_type)} · {new Date(latestEvent.created_at).toLocaleString(locale)}
              </p> : null}

              <div className={styles.orderActions}>
                <Link href={`/provider/orders/${encodeURIComponent(order.id)}`} className="button button-primary">
                  {tamil ? 'Order details பார்க்க' : 'View order details'}
                </Link>
                {order.conversation_id ? <Link href={`/provider/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">
                  {tamil ? 'Customer-க்கு message' : 'Message Customer'}
                </Link> : null}
              </div>
            </Card>
          </div>;
        })}
      </div>
    </div>
  </LiveProviderShell>;
}
