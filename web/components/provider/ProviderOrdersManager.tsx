'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Textarea } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

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

export default function ProviderOrdersManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<{ orderId: string; action: OrderAction } | null>(null);

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

  const transition = async (order: ProductOrder, action: OrderAction) => {
    const note = notes[order.id] ?? '';
    if (action === 'decline' && note.trim().length < 3) {
      setError(tamil ? 'Decline reason குறைந்தது 3 characters வேண்டும்.' : 'A decline reason of at least 3 characters is required.');
      return;
    }
    setBusy({ orderId: order.id, action });
    setError('');
    try {
      const response = await fetch(`/api/provider/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || null }),
      });
      const payload = await response.json() as { order?: ProductOrder; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Unable to update this order.');
      setNotes((current) => ({ ...current, [order.id]: '' }));
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update this order.');
    } finally {
      setBusy(null);
    }
  };

  return <LiveProviderShell active="/provider/orders">
    <ProviderHeading
      eyebrow={tamil ? 'Business sales' : 'Business sales'}
      title={tamil ? 'Product orders' : 'Product orders'}
      description={tamil
        ? 'Customer non-payment order requests-ஐ review செய்து Accept, Decline அல்லது Fulfilled ஆக update செய்யுங்கள். Payment/Cashfree இங்கு செயல்படாது.'
        : 'Review Customer non-payment order requests and accept, decline, or mark them fulfilled. Payment and Cashfree are not active here.'}
    />

    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}
    {loading ? <Card><p>{tamil ? 'Product orders ஏற்றப்படுகிறது…' : 'Loading product orders…'}</p></Card> : null}

    {!loading && !orders.length && !error ? <Card>
      <EmptyState title={tamil ? 'Product order requests இன்னும் இல்லை' : 'No product order requests yet'}>
        {tamil ? 'Public-approved product-ஐ Customer request செய்த பிறகு orders இங்கே தெரியும்.' : 'Orders will appear here after a Customer requests a public-approved product.'}
      </EmptyState>
    </Card> : null}

    <div style={{ display: 'grid', gap: '1rem' }}>
      {orders.map((order) => {
        const total = order.unit_price_snapshot * order.quantity;
        const canDecide = order.status === 'requested';
        const canFulfill = order.status === 'accepted';
        const note = notes[order.id] ?? '';
        return <div id={`order-${order.id}`} key={order.id} style={{ scrollMarginTop: '6rem' }}><Card style={{ display: 'grid', gap: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow">{order.customer_name_snapshot}</span>
              <h2 style={{ margin: '.3rem 0' }}>{order.product_name_snapshot}</h2>
              <p style={{ margin: 0 }}>{order.quantity} × {money(order.unit_price_snapshot, order.currency_snapshot)} / {order.unit_label_snapshot}</p>
            </div>
            <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
          </div>
          <strong>{tamil ? 'Snapshot total' : 'Snapshot total'}: {money(total, order.currency_snapshot)}</strong>
          {order.customer_note ? <p style={{ margin: 0 }}><strong>{tamil ? 'Customer note' : 'Customer note'}:</strong> {order.customer_note}</p> : null}
          {order.business_note ? <p style={{ margin: 0 }}><strong>{tamil ? 'Business note' : 'Business note'}:</strong> {order.business_note}</p> : null}
          <p className="muted" style={{ margin: 0 }}>
            {tamil ? 'Requested' : 'Requested'} {new Date(order.created_at).toLocaleString(locale)} · Product rev {order.product_revision}
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

          {order.conversation_id ? <div className="button-row">
            <Link href={`/provider/messages?conversation=${encodeURIComponent(order.conversation_id)}`} className="button button-secondary">
              {tamil ? 'Customer-க்கு message' : 'Message Customer'}
            </Link>
          </div> : null}

          {(canDecide || canFulfill) ? <Textarea
            label={canDecide
              ? (tamil ? 'Business note / decline reason' : 'Business note / decline reason')
              : (tamil ? 'Fulfilment note (optional)' : 'Fulfilment note (optional)')}
            hint={canDecide
              ? (tamil ? 'Decline செய்ய reason கட்டாயம்; Accept செய்ய optional.' : 'Required when declining; optional when accepting.')
              : (tamil ? 'Payment confirmation இங்கு சேர்க்க வேண்டாம்.' : 'Do not use this field as payment confirmation.')}
            value={note}
            maxLength={1200}
            onChange={(event) => setNotes((current) => ({ ...current, [order.id]: event.target.value }))}
          /> : null}

          {canDecide ? <div className="button-row">
            <Button type="button" loading={busy?.orderId === order.id && busy.action === 'accept'} onClick={() => void transition(order, 'accept')}>
              {tamil ? 'Accept order' : 'Accept order'}
            </Button>
            <Button type="button" variant="danger" loading={busy?.orderId === order.id && busy.action === 'decline'} onClick={() => void transition(order, 'decline')}>
              {tamil ? 'Decline' : 'Decline'}
            </Button>
          </div> : null}

          {canFulfill ? <div className="button-row">
            <Button type="button" loading={busy?.orderId === order.id && busy.action === 'fulfill'} onClick={() => void transition(order, 'fulfill')}>
              {tamil ? 'Mark fulfilled' : 'Mark fulfilled'}
            </Button>
          </div> : null}
        </Card></div>;
      })}
    </div>
  </LiveProviderShell>;
}
