'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Textarea } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

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
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
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
    if (mode === 'in_stock') return tamil ? 'Stock உள்ளது' : 'In stock';
    if (mode === 'made_to_order') return tamil ? 'Order அடிப்படையில் தயாரிக்கப்படும்' : 'Made to order';
    return tamil ? 'Stock இல்லை' : 'Out of stock';
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
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Unable to request this order.');
      setFeedback((current) => ({
        ...current,
        [product.id]: {
          busy: false,
          error: false,
          message: tamil ? 'Order request அனுப்பப்பட்டது.' : 'Order request sent.',
        },
      }));
      setDrafts((current) => ({ ...current, [product.id]: { quantity: 1, note: '' } }));
    } catch (requestError) {
      setFeedback((current) => ({
        ...current,
        [product.id]: {
          busy: false,
          error: true,
          message: requestError instanceof Error ? requestError.message : 'Unable to request this order.',
        },
      }));
    }
  };

  return <section className="container section-stack" aria-label={tamil ? 'Business products' : 'Business products'} style={{ paddingTop: '1rem' }}>
    <div className="page-intro" style={{ marginBottom: 0 }}>
      <span className="eyebrow">Business sales</span>
      <h2>Products</h2>
      <p>{tamil
        ? 'Platform review செய்யப்பட்ட current revision products மட்டும் இங்கே தெரியும். Customer order request அனுப்பலாம்; TakeItEsee payment/Cashfree இந்த stage-ல் செயல்படாது.'
        : 'Only platform-reviewed current product revisions appear here. Customers can send an order request; TakeItEsee payment and Cashfree are not active at this stage.'}</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
      {products.map((product) => {
        const draft = draftFor(product.id);
        const state = feedback[product.id];
        const available = product.stock_mode !== 'out_of_stock';
        const shouldTryImage = product.has_primary_image !== false && !imageFailures[product.id];
        return <article
          className="card"
          id={`product-${product.id}`}
          key={product.id}
          style={{ display: 'grid', gap: '.8rem', alignContent: 'start', scrollMarginTop: '7rem', overflow: 'hidden' }}
        >
          {shouldTryImage ? <img
            src={productImageHref(product.id)}
            alt={`${product.name} product`}
            style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '12px', display: 'block' }}
            onError={() => setImageFailures((current) => ({ ...current, [product.id]: true }))}
          /> : null}
          <div>
            <span className="eyebrow">{stockLabel(product.stock_mode)}</span>
            <h3 style={{ margin: '.35rem 0' }}>{product.name}</h3>
            <strong>{money(product)} / {product.unit_label}</strong>
          </div>
          {product.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}

          {available ? <div style={{ display: 'grid', gap: '.75rem' }}>
            <Input
              label={tamil ? 'Quantity' : 'Quantity'}
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
              label={tamil ? 'Order note (optional)' : 'Order note (optional)'}
              hint={tamil ? 'Delivery/payment details இங்கு share செய்ய வேண்டாம்.' : 'Do not share payment details here.'}
              maxLength={1200}
              value={draft.note}
              onChange={(event) => updateDraft(product.id, { note: event.target.value })}
            />
            <Button type="button" loading={Boolean(state?.busy)} onClick={() => void requestOrder(product)}>
              {tamil ? 'Request order' : 'Request order'}
            </Button>
            <p className="muted" style={{ margin: 0 }}>
              {tamil
                ? 'இது order request மட்டும். Online payment அல்லது automatic stock deduction இல்லை.'
                : 'This sends an order request only. There is no online payment or automatic stock deduction.'}
            </p>
            {state?.message ? <p role={state.error ? 'alert' : 'status'} style={{ margin: 0, color: state.error ? 'var(--danger, #b42318)' : 'var(--color-primary-strong)' }}>
              {state.message} {!state.error ? <Link href="/orders">{tamil ? 'என் orders பார்க்க' : 'View my orders'}</Link> : null}
            </p> : null}
          </div> : <p className="muted" style={{ margin: 0 }}>{tamil ? 'இந்த product தற்போது order செய்ய முடியாது.' : 'This product is not currently available to order.'}</p>}
        </article>;
      })}
    </div>
  </section>;
}
