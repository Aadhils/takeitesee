'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Textarea } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProductStatus = 'draft' | 'active' | 'paused';
type StockMode = 'in_stock' | 'out_of_stock' | 'made_to_order';

type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  unit_label: string;
  stock_mode: StockMode;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

type ProductDraft = {
  name: string;
  description: string;
  sku: string;
  price: string;
  currency: string;
  unit_label: string;
  stock_mode: StockMode;
  status: ProductStatus;
};

const emptyDraft: ProductDraft = {
  name: '',
  description: '',
  sku: '',
  price: '0',
  currency: 'INR',
  unit_label: 'item',
  stock_mode: 'in_stock',
  status: 'draft',
};

function draftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    description: product.description || '',
    sku: product.sku || '',
    price: String(product.price),
    currency: product.currency,
    unit_label: product.unit_label,
    stock_mode: product.stock_mode,
    status: product.status,
  };
}

function statusTone(status: ProductStatus) {
  if (status === 'active') return 'success' as const;
  if (status === 'paused') return 'warning' as const;
  return 'neutral' as const;
}

function stockTone(mode: StockMode) {
  if (mode === 'in_stock') return 'success' as const;
  if (mode === 'made_to_order') return 'info' as const;
  return 'warning' as const;
}

export default function ProviderProductsManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/products', { cache: 'no-store' });
      const payload = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok || !payload.products) throw new Error(payload.error || 'Unable to load products.');
      setProducts(payload.products);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: products.length,
    active: products.filter((product) => product.status === 'active').length,
    draft: products.filter((product) => product.status === 'draft').length,
    paused: products.filter((product) => product.status === 'paused').length,
  }), [products]);

  const updateDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const updateEditDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setEditDraft((current) => ({ ...current, [key]: value }));
  };

  const productPayload = (value: ProductDraft) => ({
    name: value.name,
    description: value.description || null,
    sku: value.sku || null,
    price: Number(value.price),
    currency: value.currency,
    unit_label: value.unit_label,
    stock_mode: value.stock_mode,
    status: value.status,
  });

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload(draft)),
      });
      const payload = await response.json() as { product?: Product; error?: string };
      if (!response.ok || !payload.product) throw new Error(payload.error || 'Unable to create product.');
      setProducts((current) => [payload.product!, ...current]);
      setDraft(emptyDraft);
      setNotice(tamil ? 'Product catalog-ல் சேமிக்கப்பட்டது. இது இன்னும் public marketplace-ல் வெளியிடப்படவில்லை.' : 'Product saved to your catalog. It is not public in the marketplace yet.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product.');
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (productId: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload(editDraft)),
      });
      const payload = await response.json() as { product?: Product; error?: string };
      if (!response.ok || !payload.product) throw new Error(payload.error || 'Unable to update product.');
      setProducts((current) => current.map((product) => product.id === productId ? payload.product! : product));
      setEditingId(null);
      setNotice(tamil ? 'Product மாற்றங்கள் சேமிக்கப்பட்டன.' : 'Product changes saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update product.');
    } finally {
      setSaving(false);
    }
  };

  const money = (product: Product) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: product.currency, maximumFractionDigits: 2 }).format(product.price);
    } catch {
      return `${product.currency} ${product.price.toFixed(2)}`;
    }
  };

  const formFields = (value: ProductDraft, update: <K extends keyof ProductDraft>(key: K, next: ProductDraft[K]) => void) => <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '.8rem' }}>
      <Input label={tamil ? 'Product பெயர்' : 'Product name'} required maxLength={160} value={value.name} onChange={(event) => update('name', event.target.value)} />
      <Input label="SKU" maxLength={64} value={value.sku} onChange={(event) => update('sku', event.target.value)} hint={tamil ? 'Optional; இந்த Business-ல் unique.' : 'Optional; unique within this Business.'} />
      <Input label={tamil ? 'விலை' : 'Price'} required type="number" min="0" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} />
      <Input label={tamil ? 'Currency code' : 'Currency'} required maxLength={3} value={value.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} />
      <Input label={tamil ? 'Unit' : 'Unit label'} required maxLength={40} value={value.unit_label} onChange={(event) => update('unit_label', event.target.value)} placeholder="item" />
      <Select label={tamil ? 'Stock நிலை' : 'Stock mode'} value={value.stock_mode} onChange={(event) => update('stock_mode', event.target.value as StockMode)}>
        <option value="in_stock">{tamil ? 'Stock உள்ளது' : 'In stock'}</option>
        <option value="out_of_stock">{tamil ? 'Stock இல்லை' : 'Out of stock'}</option>
        <option value="made_to_order">{tamil ? 'Order வந்ததும் தயாரிப்பு' : 'Made to order'}</option>
      </Select>
      <Select label={tamil ? 'Catalog நிலை' : 'Catalog status'} value={value.status} onChange={(event) => update('status', event.target.value as ProductStatus)}>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
      </Select>
    </div>
    <Textarea label={tamil ? 'விளக்கம்' : 'Description'} maxLength={5000} rows={4} value={value.description} onChange={(event) => update('description', event.target.value)} />
  </>;

  return <LiveProviderShell active="/provider/products">
    <ProviderHeading
      eyebrow={tamil ? 'Business sales' : 'Business sales'}
      title={tamil ? 'Products & catalog' : 'Products & catalog'}
      description={tamil
        ? 'உங்கள் Business விற்கும் products-ஐ தயார் செய்யுங்கள். இந்த foundation-ல் catalog owner-only; public launch/order இன்னும் enable செய்யப்படவில்லை.'
        : 'Prepare the products your Business sells. In this foundation the catalog is owner-only; public launch and ordering are not enabled yet.'}
    />

    <Alert title={tamil ? 'Public launch இன்னும் இல்லை' : 'Public launch is not enabled yet'} tone="info">
      {tamil
        ? 'Active status என்பது உங்கள் catalog நிலை மட்டும். Product launch governance முடியும் வரை எந்த Product-மும் public marketplace அல்லது storefront-ல் தெரியாது; payment/Cashfree செயல்படாது.'
        : 'Active is only an owner catalog state. No product is visible on the public marketplace or storefront until product launch governance is added, and payment/Cashfree remains disabled.'}
    </Alert>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', margin: '1rem 0' }}>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{tamil ? 'மொத்தம்' : 'Total'}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.all}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">Active</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.active}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">Draft</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.draft}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">Paused</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.paused}</strong></Card>
    </div>

    {error ? <Alert title={tamil ? 'Product catalog error' : 'Product catalog error'} tone="danger">{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}

    <Card style={{ marginTop: '1rem' }}>
      <form onSubmit={createProduct} style={{ display: 'grid', gap: '1rem' }}>
        <div><span className="eyebrow">{tamil ? 'புதிய Product' : 'New product'}</span><h2 style={{ margin: '.35rem 0 0' }}>{tamil ? 'Catalog item சேர்க்கவும்' : 'Add a catalog item'}</h2></div>
        {formFields(draft, updateDraft)}
        <div><Button type="submit" loading={saving}>{tamil ? 'Product சேமி' : 'Save product'}</Button></div>
      </form>
    </Card>

    <section style={{ display: 'grid', gap: '.8rem', marginTop: '1rem' }} aria-label={tamil ? 'Business products' : 'Business products'}>
      {loading ? <Card><p>{tamil ? 'Products ஏற்றப்படுகின்றன…' : 'Loading products…'}</p></Card> : products.length ? products.map((product) => {
        const editing = editingId === product.id;
        return <Card key={product.id} style={{ display: 'grid', gap: '.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.75rem' }}>
            <div>
              <span className="eyebrow">{product.sku || (tamil ? 'SKU இல்லை' : 'No SKU')}</span>
              <h2 style={{ margin: '.3rem 0 .2rem' }}>{product.name}</h2>
              <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{money(product)} / {product.unit_label}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              <Badge tone={statusTone(product.status)}>{product.status}</Badge>
              <Badge tone={stockTone(product.stock_mode)}>{product.stock_mode.replaceAll('_', ' ')}</Badge>
            </div>
          </div>

          {editing ? <div style={{ display: 'grid', gap: '1rem' }}>
            {formFields(editDraft, updateEditDraft)}
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Button type="button" loading={saving} onClick={() => void saveProduct(product.id)}>{tamil ? 'மாற்றங்கள் சேமி' : 'Save changes'}</Button>
              <Button type="button" variant="quiet" disabled={saving} onClick={() => setEditingId(null)}>{tamil ? 'ரத்து' : 'Cancel'}</Button>
            </div>
          </div> : <>
            {product.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}
            <div><Button type="button" variant="secondary" onClick={() => { setEditingId(product.id); setEditDraft(draftFromProduct(product)); setNotice(''); }}>{tamil ? 'Edit product' : 'Edit product'}</Button></div>
          </>}
        </Card>;
      }) : <Card><EmptyState title={tamil ? 'Products இன்னும் இல்லை' : 'No products yet'}>{tamil ? 'மேலே உள்ள form மூலம் உங்கள் முதல் Business product-ஐ catalog-ல் சேர்க்கலாம்.' : 'Use the form above to add your first Business product to the private catalog.'}</EmptyState></Card>}
    </section>
  </LiveProviderShell>;
}
