'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LocalizedAccountShell from './LocalizedAccountShell';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

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
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
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
      if (!response.ok) throw new Error(payload.error || 'Unable to load saved Products.');
      setAuthenticated(true);
      setItems(payload.saved_products ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load saved Products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
      if (!response.ok) throw new Error(payload.error || 'Unable to remove saved Product.');
      setItems((current) => current.filter((item) => item.product_id !== productId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove saved Product.');
    } finally {
      setBusyId('');
    }
  };

  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  const stockLabel = (mode: NonNullable<SavedProduct['product']>['stock_mode']) => {
    if (mode === 'in_stock') return tamil ? 'Stock உள்ளது' : 'In stock';
    if (mode === 'made_to_order') return tamil ? 'Order அடிப்படையில்' : 'Made to order';
    return tamil ? 'Stock இல்லை' : 'Out of stock';
  };

  return <LocalizedAccountShell active="/saved-products">
    <section className="account-page-heading">
      <span className="eyebrow">{tamil ? 'Product shortlist' : 'Product shortlist'}</span>
      <h1>{tamil ? 'சேமித்த Products' : 'Saved Products'}</h1>
      <p>{tamil ? 'பின்னர் பார்க்க அல்லது order request அனுப்ப நீங்கள் சேமித்த approved Business Products.' : 'Approved Business Products you saved to revisit or request later.'}</p>
    </section>

    {authenticated === false ? <Card>
      <EmptyState title={tamil ? 'Saved Products பார்க்க sign in செய்யவும்' : 'Sign in to view saved Products'}>
        {tamil ? 'Products-ஐ shortlist செய்து பின்னர் மீண்டும் பார்க்க உங்கள் account-ல் sign in செய்யவும்.' : 'Sign in to shortlist Products and return to them from your account.'}
      </EmptyState>
      <div className="button-row"><Link className="button button-primary" href="/login?returnTo=%2Fsaved-products">Sign in</Link><Link className="button button-secondary" href="/signup">{tamil ? 'Account உருவாக்கவும்' : 'Create account'}</Link></div>
    </Card> : loading ? <Card><p>{tamil ? 'Saved Products ஏற்றுகிறது…' : 'Loading saved Products…'}</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{tamil ? 'மீண்டும் முயற்சி' : 'Try again'}</Button></Card> : items.length === 0 ? <Card>
      <EmptyState title={tamil ? 'இன்னும் saved Products இல்லை' : 'No saved Products yet'}>
        {tamil ? 'Product marketplace-ல் ஒரு approved Product-ஐ Save செய்து shortlist தொடங்குங்கள்.' : 'Save an approved Product from the Product marketplace to start your shortlist.'}
      </EmptyState>
      <Link className="button button-primary" href="/products">{tamil ? 'Products பார்க்க' : 'Browse Products'}</Link>
    </Card> : <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => {
        if (!item.available || !item.product) {
          return <Card key={item.product_id} className="policy-card">
            <div className="section-heading"><div><span className="eyebrow">{tamil ? 'Saved Product' : 'Saved Product'}</span><h2>{tamil ? 'இந்த Product தற்போது public-ஆ கிடைக்கவில்லை' : 'This saved Product is no longer publicly available'}</h2></div><Badge tone="neutral">Unavailable</Badge></div>
            <p className="detail-copy">{tamil ? 'Product revision approval மாறியிருக்கலாம், pause/remove செய்யப்பட்டிருக்கலாம். Saved reference-ஐ வேண்டுமெனில் remove செய்யலாம்.' : 'Its public approval may have changed, or the Product may have been paused or removed. You can remove the saved reference.'}</p>
            <Button type="button" variant="quiet" loading={busyId === item.product_id} onClick={() => void remove(item.product_id)}>{tamil ? 'Saved Product-ஐ நீக்கு' : 'Remove saved Product'}</Button>
          </Card>;
        }

        const product = item.product;
        return <Card key={item.product_id} className="policy-card" style={{ overflow: 'hidden' }}>
          {product.has_primary_image ? <img src={productImageHref(product.id)} alt={`${product.name} product`} style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '12px', marginBottom: '.75rem' }} /> : null}
          <div className="section-heading"><div><span className="eyebrow">{product.business_name}</span><h2>{product.name}</h2><p className="summary-note">{product.business_location || (tamil ? 'Business location குறிப்பிடப்படவில்லை' : 'Business location not specified')}</p></div><Badge tone="success">{tamil ? 'Saved' : 'Saved'}</Badge></div>
          {product.description ? <p className="detail-copy">{product.description}</p> : null}
          <dl className="review-details"><div><dt>{tamil ? 'விலை' : 'Price'}</dt><dd>{money(product.price, product.currency)} / {product.unit_label}</dd></div><div><dt>{tamil ? 'Stock' : 'Stock'}</dt><dd>{stockLabel(product.stock_mode)}</dd></div><div><dt>{tamil ? 'சேமித்த தேதி' : 'Saved'}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(item.saved_at))}</dd></div></dl>
          <div className="button-row"><Link className="button button-primary" href={`/products/${encodeURIComponent(product.id)}`}>{tamil ? 'Product திற' : 'Open Product'}</Link><Button type="button" variant="quiet" loading={busyId === item.product_id} onClick={() => void remove(item.product_id)}>{tamil ? 'Unsave' : 'Unsave'}</Button></div>
        </Card>;
      })}
    </div>}
  </LocalizedAccountShell>;
}
