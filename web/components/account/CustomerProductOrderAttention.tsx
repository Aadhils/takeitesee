'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProductOrderNotification = {
  id: string;
  target_path: string | null;
  event_type: 'product_order_accepted' | 'product_order_declined' | 'product_order_fulfilled';
  title: string;
  body: string;
  created_at: string;
};

type ProductOrderAttentionPayload = {
  unread_count?: number;
  latest?: ProductOrderNotification | null;
};

type CustomerProductOrderAttentionProps = {
  onUnreadChange?: (count: number) => void;
};

function tone(eventType: ProductOrderNotification['event_type']) {
  if (eventType === 'product_order_fulfilled') return 'success' as const;
  if (eventType === 'product_order_accepted') return 'info' as const;
  return 'warning' as const;
}

export default function CustomerProductOrderAttention({ onUnreadChange }: CustomerProductOrderAttentionProps) {
  const router = useRouter();
  const { locale, t } = useIdentityWorkspaceTranslations();
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState<ProductOrderNotification | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?mode=product-order-unread-updates', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as ProductOrderAttentionPayload;
      const unread = Math.max(0, payload.unread_count ?? 0);
      setCount(unread);
      setLatest(payload.latest ?? null);
    } catch {
      // Product Order attention is progressive enhancement; account navigation remains usable.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    onUnreadChange?.(count);
  }, [count, onUnreadChange]);

  useEffect(() => {
    const refresh = () => { void load(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('customer-product-order-attention-refresh', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('customer-product-order-attention-refresh', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, [load]);

  if (!count || !latest) return null;

  const safeTarget = latest.target_path?.startsWith('/orders/') ? latest.target_path : '/orders';
  const orderMatch = safeTarget.match(/^\/orders\/([0-9a-f-]+)$/i);
  const countLabel = count > 99 ? '99+' : String(count);

  const reviewLatest = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (orderMatch?.[1]) {
        const response = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mark_product_order_updates_read: true, order_id: orderMatch[1] }),
        });
        if (response.ok) window.dispatchEvent(new Event('customer-product-order-attention-refresh'));
      }
    } catch {
      // Acknowledgement is best effort; the exact order remains reachable.
    } finally {
      router.push(safeTarget);
    }
  };

  return <section className="customer-product-order-attention" aria-label={t('account.productOrderAttention.aria')} aria-live="polite">
    <Card className="customer-product-order-attention-card">
      <div className="customer-product-order-attention-heading">
        <div>
          <span className="eyebrow">{t('account.productOrderAttention.eyebrow')}</span>
          <h2>{t('account.productOrderAttention.title')}</h2>
        </div>
        <Badge tone="info">{countLabel} {count === 1 ? t('account.productOrderAttention.newUpdate') : t('account.productOrderAttention.newUpdates')}</Badge>
      </div>

      <div className="customer-product-order-attention-latest">
        <div>
          <Badge tone={tone(latest.event_type)}>{latest.title}</Badge>
          <p>{latest.body}</p>
          <span>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(latest.created_at))}</span>
        </div>
        <div className="customer-product-order-attention-actions">
          <Button type="button" loading={opening} onClick={() => void reviewLatest()}>{t('account.productOrderAttention.reviewLatest')}</Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/orders')}>{t('account.productOrderAttention.allOrders')}</Button>
        </div>
      </div>

      <style jsx global>{`
        .customer-product-order-attention-card { display: grid; gap: .8rem; border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border)); background: color-mix(in srgb, var(--color-selected) 64%, white); }
        .customer-product-order-attention-heading, .customer-product-order-attention-latest { display: flex; align-items: center; justify-content: space-between; gap: .85rem; }
        .customer-product-order-attention-heading > div, .customer-product-order-attention-latest > div:first-child { min-width: 0; display: grid; gap: .3rem; }
        .customer-product-order-attention-heading h2, .customer-product-order-attention-latest p { margin: 0; }
        .customer-product-order-attention-latest p { overflow-wrap: anywhere; }
        .customer-product-order-attention-latest span { color: var(--color-ink-muted); font-size: .78rem; }
        .customer-product-order-attention-actions { display: flex; flex: 0 0 auto; gap: .55rem; }
        @media (max-width: 720px) {
          .customer-product-order-attention-heading, .customer-product-order-attention-latest { align-items: stretch; flex-direction: column; }
          .customer-product-order-attention-actions { display: grid; grid-template-columns: 1fr; }
          .customer-product-order-attention-actions :global(.button) { width: 100%; justify-content: center; }
        }
      `}</style>
    </Card>
  </section>;
}
