'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Textarea } from '../ui/primitives';
import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import styles from './BusinessStorefrontProducts.module.css';

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  currency: string;
  unit_label: string;
  stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
  has_primary_image?: boolean;
};

type OrderDraft = { quantity: number; note: string };
type OrderFeedback = { busy: boolean; message: string; error: boolean };

function productImageHref(productId: string) {
  return `/api/marketplace/products/${encodeURIComponent(productId)}/image`;
}

export default function BusinessStorefrontProducts({ products }: { products: PublicProduct[] }) {
  const { locale, t } = usePublicProviderTranslations();
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [feedback, setFeedback] = useState<Record<string, OrderFeedback>>({});
  const [imageFailures, setImageFailures] = useState<Record<string, boolean>>({});
  if (!products.length) return null;

  const money = (product: PublicProduct) => {
    const amount = Number(product.price);
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: product.currency || 'INR',
        maximumFractionDigits: 2,
      }).format(Number.isFinite(amount) ? amount : 0);
    } catch {
      return `${product.currency || 'INR'} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
    }
  };

  const stockLabel = (mode: PublicProduct['stock_mode']) => {
    if (mode === 'in_stock') return t('publicProvider.businessProducts.inStock');
    if (mode === 'made_to_order') return t('publicProvider.businessProducts.madeToOrder');
    return t('publicProvider.businessProducts.outOfStock');
  };

  const draftFor = (productId: string): OrderDraft => drafts[productId] ?? { quantity: 1, note: '' };

  const updateDraft = (productId: string, patch: Partial<OrderDraft>) => {
    setDrafts((current) => ({ ...current, [productId]: { ...draftFor(productId), ...patch } }));
  };

  const requestOrder = async (product: PublicProduct) => {
    const draft = draftFor(product.id);
    setFeedback((current) => ({ ...current, [product.id]: { busy: true, message: '', error: false } }));
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          quantity: draft.quantity,
          customer_note: draft.note.trim() || null,
        }),
      });
      const payload = await response.json() as { order?: { id: string }; error?: string };
      if (response.status === 401) {
        const returnTo = typeof window === 'undefined'
          ? '/'
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (!response.ok || !payload.order) throw new Error(payload.error || t('publicProvider.businessProducts.requestError'));
      setFeedback((current) => ({
        ...current,
        [product.id]: {
          busy: false,
          error: false,
          message: t('publicProvider.businessProducts.orderSent'),
        },
      }));
      setDrafts((current) => ({ ...current, [product.id]: { quantity: 1, note: '' } }));
    } catch (requestError) {
      setFeedback((current) => ({
        ...current,
        [product.id]: {
          busy: false,
          error: true,
          message: requestError instanceof Error ? requestError.message : t('publicProvider.businessProducts.requestError'),
        },
      }));
    }
  };

  return <section className={`container section-stack ${styles.section}`} aria-label={t('publicProvider.businessProducts.aria')}>
    <div className={`page-intro ${styles.intro}`}>
      <span className="eyebrow">{t('publicProvider.businessProducts.salesEyebrow')}</span>
      <h2>{t('publicProvider.businessProducts.title')}</h2>
      <p>{t('publicProvider.businessProducts.intro')}</p>
    </div>
    <div className={styles.grid}>
      {products.map((product) => {
        const draft = draftFor(product.id);
        const state = feedback[product.id];
        const available = product.stock_mode !== 'out_of_stock';
        const shouldTryImage = product.has_primary_image !== false && !imageFailures[product.id];
        return <article
          className={`card ${styles.card}`}
          id={`product-${product.id}`}
          key={product.id}
        >
          {shouldTryImage ? <img
            src={productImageHref(product.id)}
            alt={t('publicProvider.businessProducts.imageAlt').replace('{productName}', product.name)}
            className={styles.image}
            onError={() => setImageFailures((current) => ({ ...current, [product.id]: true }))}
          /> : null}
          <div className={styles.summary}>
            <span className="eyebrow">{stockLabel(product.stock_mode)}</span>
            <h3 className={styles.name}>{product.name}</h3>
            <strong className={styles.price}>{money(product)} / {product.unit_label}</strong>
          </div>
          {product.description ? <p className={styles.description}>{product.description}</p> : null}

          {available ? <div className={styles.orderForm}>
            <Input
              label={t('publicProvider.businessProducts.quantity')}
              type="number"
              min={1}
              max={999}
              step={1}
              value={draft.quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                updateDraft(product.id, { quantity: Number.isFinite(next) ? Math.max(1, Math.min(999, Math.trunc(next))) : 1 });
              }}
            />
            <Textarea
              label={t('publicProvider.businessProducts.orderNote')}
              hint={t('publicProvider.businessProducts.noteHint')}
              maxLength={1200}
              value={draft.note}
              onChange={(event) => updateDraft(product.id, { note: event.target.value })}
            />
            <Button type="button" loading={Boolean(state?.busy)} onClick={() => void requestOrder(product)}>
              {t('publicProvider.businessProducts.requestOrder')}
            </Button>
            <p className={`muted ${styles.note}`}>
              {t('publicProvider.businessProducts.orderOnlyNote')}
            </p>
            {state?.message ? <p className={styles.feedback} role={state.error ? 'alert' : 'status'} style={{ color: state.error ? 'var(--danger, #b42318)' : 'var(--color-primary-strong)' }}>
              {state.message} {!state.error ? <Link href="/orders">{t('publicProvider.businessProducts.viewOrders')}</Link> : null}
            </p> : null}
          </div> : <p className={`muted ${styles.note}`}>{t('publicProvider.businessProducts.unavailable')}</p>}
        </article>;
      })}
    </div>
  </section>;
}
