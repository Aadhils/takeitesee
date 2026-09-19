'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './BusinessProductOrderAttention.module.css';

type ProviderContext = { provider_type?: 'business' | 'professional' };
type ProductOrder = {
  id: string;
  customer_name_snapshot: string;
  product_name_snapshot: string;
  status: 'requested' | 'accepted' | 'declined' | 'fulfilled' | 'cancelled';
  created_at: string;
};

export default function BusinessProductOrderAttention() {
  const { t } = useIdentityWorkspaceTranslations();
  const [business, setBusiness] = useState(false);
  const [orders, setOrders] = useState<ProductOrder[]>([]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/provider/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: ProductOrder[] };
      if (!response.ok) return;
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
    } catch {
      // Attention is progressive enhancement; the main Business dashboard remains usable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/provider/context', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ provider?: ProviderContext }> : null)
      .then((payload) => {
        if (cancelled) return;
        const isBusiness = payload?.provider?.provider_type === 'business';
        setBusiness(isBusiness);
        if (isBusiness) void loadOrders();
      })
      .catch(() => { if (!cancelled) setBusiness(false); });
    return () => { cancelled = true; };
  }, [loadOrders]);

  useEffect(() => {
    if (!business) return;
    const refresh = () => { void loadOrders(); };
    const visibilityRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visibilityRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visibilityRefresh);
    };
  }, [business, loadOrders]);

  const requestedOrders = useMemo(() => orders
    .filter((order) => order.status === 'requested')
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()), [orders]);

  if (!business || requestedOrders.length === 0) return null;

  const latest = requestedOrders[0];
  const count = requestedOrders.length;
  const countLabel = count > 99 ? '99+' : String(count);

  return <aside className={styles.attention} aria-label={t('provider.business.newOrdersLabel')} aria-live="polite">
    <div className={styles.heading}>
      <div className={styles.copy}>
        <span className="eyebrow">{t('provider.business.orderAttention')}</span>
        <strong>{countLabel} {count === 1 ? t('provider.business.orderSingular') : t('provider.business.orderPlural')}</strong>
      </div>
      <Badge tone="warning">{countLabel}</Badge>
    </div>
    <p className={styles.latest}>{latest.customer_name_snapshot} · {t('provider.business.requested')} {latest.product_name_snapshot}</p>
    <div className={styles.actions}>
      <Link href={`/provider/orders/${encodeURIComponent(latest.id)}`} className="button button-primary">
        {t('provider.business.reviewLatestOrder')}
      </Link>
      <Link href="/provider/orders" className={`button button-secondary ${styles.allOrders}`}>
        {t('provider.business.allOrders')}
      </Link>
    </div>
  </aside>;
}
