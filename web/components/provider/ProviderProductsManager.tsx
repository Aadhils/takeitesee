'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Textarea } from '../ui/primitives';
import { ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';
import ProductPrimaryImageControl from './ProductPrimaryImageControl';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';

type ProductStatus = 'draft' | 'active' | 'paused';
type StockMode = 'in_stock' | 'out_of_stock' | 'made_to_order';
type LaunchStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'withdrawn';
type TrustStatus = 'normal' | 'reverification_required' | 'suspended';

type ProductLaunch = {
  id: string;
  product_id: string;
  business_id: string;
  product_revision: number;
  status: LaunchStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  review_revision: number;
  launch: ProductLaunch | null;
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

type ProviderReadiness = {
  provider_type: 'professional' | 'business';
  verified: boolean;
  profile_complete: boolean;
  marketplace_disclosure_complete: boolean;
  trust_status: TrustStatus;
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

function launchTone(status: LaunchStatus | 'needs_review') {
  if (status === 'approved') return 'success' as const;
  if (status === 'pending') return 'info' as const;
  if (status === 'changes_requested' || status === 'needs_review') return 'warning' as const;
  return 'neutral' as const;
}

export default function ProviderProductsManager() {
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
  const [products, setProducts] = useState<Product[]>([]);
  const [readiness, setReadiness] = useState<ProviderReadiness | null>(null);
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
      const [productResponse, profileResponse] = await Promise.all([
        fetch('/api/provider/products', { cache: 'no-store' }),
        fetch('/api/provider/profile', { cache: 'no-store' }),
      ]);
      const productPayload = await productResponse.json() as { products?: Product[]; error?: string };
      const profilePayload = await profileResponse.json() as { profile?: ProviderReadiness; error?: string };
      if (!productResponse.ok || !productPayload.products) throw new Error(productPayload.error || 'Unable to load products.');
      if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error || 'Unable to load Business readiness.');
      if (profilePayload.profile.provider_type !== 'business') throw new Error('Business Provider identity is required to manage products.');
      setProducts(productPayload.products);
      setReadiness(profilePayload.profile);
    } catch (cause) {
      setProducts([]);
      setReadiness(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: products.length,
    active: products.filter((product) => product.status === 'active').length,
    paused: products.filter((product) => product.status === 'paused').length,
    approved: products.filter((product) => product.launch?.status === 'approved' && product.launch.product_revision === product.review_revision).length,
    pending: products.filter((product) => product.launch?.status === 'pending' && product.launch.product_revision === product.review_revision).length,
  }), [products]);

  const updateDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const updateEditDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setEditDraft((current) => ({ ...current, [key]: value }));
  };

  const catalogActivationBlocker = () => {
    if (!readiness) return tamil ? 'Business readiness load ஆன பிறகு Active செய்யுங்கள்.' : 'Wait for Business readiness to load before setting a product Active.';
    if (readiness.trust_status === 'suspended') return tamil ? 'Provider suspension resolve ஆன பிறகே Product catalog-ஐ மீண்டும் Active செய்யலாம்.' : 'Resolve the Provider suspension before reactivating the Product catalog.';
    if (readiness.trust_status === 'reverification_required') return tamil ? 'Fresh Provider verification approve ஆன பிறகே Product catalog-ஐ Active செய்யலாம்.' : 'Fresh Provider verification must be approved before the Product catalog can be Active.';
    return null;
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
    const blocker = draft.status === 'active' ? catalogActivationBlocker() : null;
    if (blocker) { setError(blocker); return; }
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
      setDraft(emptyDraft);
      await load();
      setNotice(tamil ? 'Product catalog-ல் சேமிக்கப்பட்டது. Active ஆக்கிய பின் public launch review-க்கு submit செய்யலாம்.' : 'Product saved to your catalog. Set it Active when ready, then submit it for public launch review.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product.');
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (productId: string) => {
    const blocker = editDraft.status === 'active' ? catalogActivationBlocker() : null;
    if (blocker) { setError(blocker); return; }
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
      setEditingId(null);
      await load();
      setNotice(tamil ? 'Product மாற்றங்கள் சேமிக்கப்பட்டன. Review-sensitive content மாறியிருந்தால் புதிய revision approval தேவை.' : 'Product changes saved. If review-sensitive content changed, the new revision needs approval.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update product.');
    } finally {
      setSaving(false);
    }
  };

  const setProductStatus = async (productId: string, status: ProductStatus) => {
    const blocker = status === 'active' ? catalogActivationBlocker() : null;
    if (blocker) { setError(blocker); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json() as { product?: Product; error?: string };
      if (!response.ok || !payload.product) throw new Error(payload.error || 'Unable to update product status.');
      await load();
      setNotice(status === 'active'
        ? (tamil ? 'Product catalog மீண்டும் Active செய்யப்பட்டது. Public visibility current approval மற்றும் Business readiness gates-ஐ தொடர்ந்து மதிக்கும்.' : 'Product catalog reactivated. Public visibility still follows the current approval and Business readiness gates.')
        : (tamil ? 'Product catalog status மாற்றப்பட்டது.' : 'Product catalog status updated.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update product status.');
    } finally {
      setSaving(false);
    }
  };

  const changeLaunch = async (product: Product, method: 'POST' | 'DELETE') => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/provider/products/${encodeURIComponent(product.id)}/launch`, { method });
      const payload = await response.json() as { launch?: ProductLaunch; error?: string };
      if (!response.ok || !payload.launch) throw new Error(payload.error || 'Unable to update product launch review.');
      await load();
      setNotice(method === 'POST'
        ? (tamil ? `Revision ${product.review_revision} public launch review-க்கு அனுப்பப்பட்டது.` : `Revision ${product.review_revision} was submitted for public launch review.`)
        : (tamil ? 'Pending public launch request திரும்பப் பெறப்பட்டது.' : 'Pending public launch request was withdrawn.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update product launch review.');
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
        <option value="active" disabled={readiness?.trust_status !== 'normal'}>Active</option>
        <option value="paused">Paused</option>
      </Select>
    </div>
    <Textarea label={tamil ? 'விளக்கம்' : 'Description'} maxLength={5000} rows={4} value={value.description} onChange={(event) => update('description', event.target.value)} />
  </>;

  return <LiveProviderShell active="/provider/products">
    <ProviderHeading
      eyebrow="Business sales"
      title={tamil ? 'Products & catalog' : 'Products & catalog'}
      description={tamil
        ? 'Product-ஐ தயார் செய்து Active ஆக்கி, current revision-ஐ platform review-க்கு அனுப்புங்கள். Approved current revision மட்டும் public storefront-ல் வரலாம்.'
        : 'Prepare a product, set it Active, and submit the current revision for platform review. Only an approved current revision can appear on the public storefront.'}
    />

    <Alert title={tamil ? 'Revision-bound public launch' : 'Revision-bound public launch'} tone="info">
      {tamil
        ? 'Product name, description, SKU, price, currency, unit அல்லது primary image மாற்றினால் புதிய review revision உருவாகும். பழைய approval புதிய content/media-ஐ publish செய்யாது. TakeItEsee payment/Cashfree இன்னும் enable செய்யப்படவில்லை.'
        : 'Changing product name, description, SKU, price, currency, unit, or primary image creates a new review revision. An old approval cannot publish changed content or media. TakeItEsee payment and Cashfree are still disabled.'}
    </Alert>

    {readiness?.trust_status === 'suspended' ? <Alert title={tamil ? 'Product reactivation paused by suspension' : 'Product reactivation paused by suspension'} tone="danger">{tamil ? 'Suspension resolve ஆகும் வரை paused Products private-ஆக இருக்கும்; Active option disabled. ' : 'Paused Products stay private and the Active option remains disabled until the suspension is resolved. '}<Link href="/account/support">{tamil ? 'Platform Support திறக்க →' : 'Open Platform Support →'}</Link></Alert> : readiness?.trust_status === 'reverification_required' ? <Alert title={tamil ? 'Product reactivation needs fresh verification' : 'Product reactivation needs fresh verification'} tone="warning">{tamil ? 'Fresh verification approve ஆன பிறகே Product catalog-ஐ மீண்டும் Active செய்யலாம். ' : 'The Product catalog can be reactivated only after fresh verification is approved. '}<Link href="/provider/verification">{tamil ? 'Re-verification தொடர →' : 'Continue re-verification →'}</Link></Alert> : null}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', margin: '1rem 0' }}>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{tamil ? 'மொத்தம்' : 'Total'}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.all}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">Active</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.active}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{tamil ? 'Paused' : 'Paused'}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.paused}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{tamil ? 'Approved' : 'Approved'}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.approved}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{tamil ? 'Review pending' : 'Review pending'}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.pending}</strong></Card>
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
        const currentLaunch = product.launch?.product_revision === product.review_revision ? product.launch : null;
        const launchStatus = currentLaunch?.status ?? 'needs_review';
        const currentApproved = currentLaunch?.status === 'approved';
        const currentPending = currentLaunch?.status === 'pending';
        const catalogBlocker = catalogActivationBlocker();
        const publicBlockers = [
          !readiness?.verified ? (tamil ? 'Provider verification' : 'Provider verification') : null,
          !readiness?.profile_complete ? (tamil ? 'Business profile basics' : 'Business profile basics') : null,
          !readiness?.marketplace_disclosure_complete ? (tamil ? 'Marketplace disclosure' : 'Marketplace disclosure') : null,
          !currentApproved ? (tamil ? 'Current revision approval' : 'Current revision approval') : null,
        ].filter((value): value is string => Boolean(value));
        const publicReturnReady = !catalogBlocker && publicBlockers.length === 0;
        return <Card key={product.id} style={{ display: 'grid', gap: '.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.75rem' }}>
            <div>
              <span className="eyebrow">{product.sku || (tamil ? 'SKU இல்லை' : 'No SKU')} · Rev {product.review_revision}</span>
              <h2 style={{ margin: '.3rem 0 .2rem' }}>{product.name}</h2>
              <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{money(product)} / {product.unit_label}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              <Badge tone={statusTone(product.status)}>{product.status}</Badge>
              <Badge tone={stockTone(product.stock_mode)}>{product.stock_mode.replaceAll('_', ' ')}</Badge>
              <Badge tone={launchTone(launchStatus)}>{launchStatus === 'needs_review' ? (tamil ? 'review தேவை' : 'needs review') : launchStatus.replaceAll('_', ' ')}</Badge>
            </div>
          </div>

          <ProductPrimaryImageControl productId={product.id} productName={product.name} onChanged={load} />
          {currentLaunch?.review_note ? <Alert tone={currentLaunch.status === 'approved' ? 'success' : 'warning'}>{currentLaunch.review_note}</Alert> : null}
          {product.launch && !currentLaunch ? <Alert tone="warning">{tamil ? `முந்தைய review Rev ${product.launch.product_revision}-க்கு. Current Rev ${product.review_revision} புதிய approval தேவை.` : `The latest review belongs to revision ${product.launch.product_revision}. Current revision ${product.review_revision} needs a new approval.`}</Alert> : null}
          {product.status === 'paused' ? <Alert title={catalogBlocker ? (tamil ? 'Product இன்னும் reactivation blocked' : 'Product reactivation is still blocked') : publicReturnReady ? (tamil ? 'Manual reactivation ready' : 'Ready for manual reactivation') : (tamil ? 'Catalog reactivation ready; public blockers remain' : 'Catalog reactivation ready; public blockers remain')} tone={catalogBlocker ? (readiness?.trust_status === 'suspended' ? 'danger' : 'warning') : publicReturnReady ? 'success' : 'warning'}>
            {catalogBlocker
              ? catalogBlocker
              : publicReturnReady
                ? (tamil ? 'Current revision approved; Business readiness gates அனைத்தும் pass. இந்த Product-ஐ Active செய்தால் public storefront visibility உடனே திரும்பலாம். TakeItEsee automatic-ஆ reactivate செய்யாது.' : 'The current revision is approved and all Business readiness gates pass. Reactivating this Product can return it to the public storefront immediately. TakeItEsee will not reactivate it automatically.')
                : (tamil ? `Catalog status-ஐ manual-ஆ Active செய்யலாம்; ஆனால் public storefront visibility இன்னும் இந்த blocker(s)-ஐ காத்திருக்கிறது: ${publicBlockers.join(', ')}.` : `You can manually return the catalog status to Active, but public storefront visibility still waits for: ${publicBlockers.join(', ')}.`)}
            {' '}<Link href={readiness?.trust_status === 'suspended' ? '/account/support' : readiness?.trust_status === 'reverification_required' ? '/provider/verification' : '/provider/public-readiness'}>{readiness?.trust_status === 'suspended' ? (tamil ? 'Platform Support திறக்க →' : 'Open Platform Support →') : readiness?.trust_status === 'reverification_required' ? (tamil ? 'Verification தொடர →' : 'Continue verification →') : (tamil ? 'Public readiness review செய்ய →' : 'Review public readiness →')}</Link>
          </Alert> : null}

          {editing ? <div style={{ display: 'grid', gap: '1rem' }}>
            {formFields(editDraft, updateEditDraft)}
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Button type="button" loading={saving} onClick={() => void saveProduct(product.id)}>{tamil ? 'மாற்றங்கள் சேமி' : 'Save changes'}</Button>
              <Button type="button" variant="quiet" disabled={saving} onClick={() => setEditingId(null)}>{tamil ? 'ரத்து' : 'Cancel'}</Button>
            </div>
          </div> : <>
            {product.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Button type="button" variant="secondary" onClick={() => { setEditingId(product.id); setEditDraft(draftFromProduct(product)); setNotice(''); }}>{tamil ? 'Edit product' : 'Edit product'}</Button>
              {product.status === 'paused' && !catalogBlocker ? <Button type="button" disabled={saving} onClick={() => void setProductStatus(product.id, 'active')}>{tamil ? 'Catalog மீண்டும் Active செய்' : 'Reactivate catalog'}</Button> : null}
              {currentPending ? <Button type="button" variant="quiet" disabled={saving} onClick={() => void changeLaunch(product, 'DELETE')}>{tamil ? 'Review request திரும்பப் பெறு' : 'Withdraw review request'}</Button> : null}
              {!currentPending && !currentApproved ? <Button type="button" disabled={saving || product.status !== 'active'} onClick={() => void changeLaunch(product, 'POST')}>{tamil ? 'Public launch review-க்கு அனுப்பு' : 'Submit for public launch'}</Button> : null}
            </div>
            {product.status !== 'active' && !currentApproved ? <p className="muted" style={{ margin: 0 }}>{tamil ? 'Public launch submit செய்ய Catalog status Active ஆக இருக்க வேண்டும்.' : 'Catalog status must be Active before submitting for public launch.'}</p> : null}
          </>}
        </Card>;
      }) : <Card><EmptyState title={tamil ? 'Products இன்னும் இல்லை' : 'No products yet'}>{tamil ? 'மேலே உள்ள form மூலம் உங்கள் முதல் Business product-ஐ catalog-ல் சேர்க்கலாம்.' : 'Use the form above to add your first Business product to the catalog.'}</EmptyState></Card>}
    </section>
  </LiveProviderShell>;
}