'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import LocalizedAccountShell from './LocalizedAccountShell';
import styles from './CustomerSavedItemsResponsive.module.css';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type SavedProduct = {
  product_id: string;
  saved_at: string;
  available: boolean;
  product: null | {
    id: string;
    business_id: string;
    business_name: string;
    business_location: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    unit_label: string;
    stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
    has_primary_image: boolean;
  };
};

function productImageHref(productId: string) {
  return `/api/marketplace/products/${encodeURIComponent(productId)}/image`;
}

export default function SavedProductsPage() {
  const { locale, t } = useRemainingWorkspaceTranslations();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/account/saved-products', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthenticated(false);
        setItems([]);
        return;
      }
      const payload = await response.json() as { saved_products?: SavedProduct[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t('savedProducts.error.load'));
      setAuthenticated(true);
      setItems(payload.saved_products ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('savedProducts.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (productId: string) => {
    if (busyId) return;
    setBusyId(productId);
    setError('');
    try {
      const response = await fetch('/api/account/saved-products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('savedProducts.error.remove'));
      setItems((current) => current.filter((item) => item.product_id !== productId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('savedProducts.error.remove'));
    } finally {
      setBusyId('');
    }
  };

  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  const stockLabel = (mode: NonNullable<SavedProduct['product']>['stock_mode']) => {
    if (mode === 'in_stock') return t('savedProducts.stock.inStock');
    if (mode === 'made_to_order') return t('savedProducts.stock.madeToOrder');
    return t('savedProducts.stock.outOfStock');
  };

  return <div className={styles.savedItemsJourney}><LocalizedAccountShell active="/saved-products">
    <section className="account-page-heading">
      <span className="eyebrow">{t('savedProducts.eyebrow')}</span>
      <h1>{t('savedProducts.title')}</h1>
      <p>{t('savedProducts.intro')}</p>
    </section>

    {authenticated === false ? <Card className="saved-products-empty-card">
      <EmptyState title={t('savedProducts.signInTitle')}>
        {t('savedProducts.signInHelp')}
      </EmptyState>
      <div className="button-row saved-products-empty-actions"><Link className="button button-primary" href="/login?returnTo=%2Fsaved-products">{t('savedProducts.signIn')}</Link><Link className="button button-secondary" href="/signup">{t('savedProducts.createAccount')}</Link></div>
    </Card> : loading ? <Card><p>{t('savedProducts.loading')}</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('common.retry')}</Button></Card> : items.length === 0 ? <Card className="saved-products-empty-card">
      <EmptyState title={t('savedProducts.emptyTitle')}>
        {t('savedProducts.emptyHelp')}
      </EmptyState>
      <div className="saved-products-empty-actions"><Link className="button button-primary" href="/products">{t('savedProducts.browse')}</Link></div>
    </Card> : <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => {
        if (!item.available || !item.product) {
          return <Card key={item.product_id} className="policy-card">
            <div className="section-heading"><div><span className="eyebrow">{t('savedProducts.unavailableEyebrow')}</span><h2>{t('savedProducts.unavailableTitle')}</h2></div><Badge tone="neutral">{t('savedProducts.unavailableBadge')}</Badge></div>
            <p className="detail-copy">{t('savedProducts.unavailableHelp')}</p>
            <Button type="button" variant="quiet" loading={busyId === item.product_id} onClick={() => void remove(item.product_id)}>{t('savedProducts.remove')}</Button>
          </Card>;
        }

        const product = item.product;
        return <Card key={item.product_id} className="policy-card" style={{ overflow: 'hidden' }}>
          {product.has_primary_image ? <img src={productImageHref(product.id)} alt={t('savedProducts.imageAlt').replace('{productName}', product.name)} style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '12px', marginBottom: '.75rem' }} /> : null}
          <div className="section-heading"><div><span className="eyebrow">{product.business_name}</span><h2>{product.name}</h2><p className="summary-note">{product.business_location || t('savedProducts.locationMissing')}</p></div><Badge tone="success">{t('savedProducts.savedBadge')}</Badge></div>
          {product.description ? <p className="detail-copy">{product.description}</p> : null}
          <dl className="review-details"><div><dt>{t('savedProducts.price')}</dt><dd>{money(product.price, product.currency)} / {product.unit_label}</dd></div><div><dt>{t('savedProducts.stock')}</dt><dd>{stockLabel(product.stock_mode)}</dd></div><div><dt>{t('savedProducts.savedDate')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(item.saved_at))}</dd></div></dl>
          <div className="button-row"><Link className="button button-primary" href={`/products/${encodeURIComponent(product.id)}`}>{t('savedProducts.open')}</Link><Button type="button" variant="quiet" loading={busyId === item.product_id} onClick={() => void remove(item.product_id)}>{t('savedProducts.unsave')}</Button></div>
        </Card>;
      })}
    </div>}
  </LocalizedAccountShell></div>;
}
