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
  const { locale, t } = useIdentityWorkspaceTranslations();
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
      if (!productResponse.ok || !productPayload.products) throw new Error(productPayload.error || t('provider.products.loadFallback'));
      if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error || t('provider.products.readinessFallback'));
      if (profilePayload.profile.provider_type !== 'business') throw new Error(t('provider.products.businessRequired'));
      setProducts(productPayload.products);
      setReadiness(profilePayload.profile);
    } catch (cause) {
      setProducts([]);
      setReadiness(null);
      setError(cause instanceof Error ? cause.message : t('provider.products.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    if (!readiness) return t('provider.products.activationWait');
    if (readiness.trust_status === 'suspended') return t('provider.products.suspensionBlocker');
    if (readiness.trust_status === 'reverification_required') return t('provider.products.reverificationBlocker');
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
      if (!response.ok || !payload.product) throw new Error(payload.error || t('provider.products.createFallback'));
      setDraft(emptyDraft);
      await load();
      setNotice(t('provider.products.createdNotice'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.createFallback'));
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
      if (!response.ok || !payload.product) throw new Error(payload.error || t('provider.products.updateFallback'));
      setEditingId(null);
      await load();
      setNotice(t('provider.products.updatedNotice'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.updateFallback'));
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
      if (!response.ok || !payload.product) throw new Error(payload.error || t('provider.products.statusFallback'));
      await load();
      setNotice(status === 'active'
        ? t('provider.products.reactivatedNotice')
        : t('provider.products.statusUpdatedNotice'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.statusFallback'));
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
      if (!response.ok || !payload.launch) throw new Error(payload.error || t('provider.products.launchFallback'));
      await load();
      setNotice(method === 'POST'
        ? `${t('provider.products.revision')} ${product.review_revision} ${t('provider.products.launchSubmittedSuffix')}`
        : t('provider.products.launchWithdrawnNotice'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('provider.products.launchFallback'));
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
      <Input label={t('provider.products.name')} required maxLength={160} value={value.name} onChange={(event) => update('name', event.target.value)} />
      <Input label="SKU" maxLength={64} value={value.sku} onChange={(event) => update('sku', event.target.value)} hint={t('provider.products.skuHint')} />
      <Input label={t('provider.products.price')} required type="number" min="0" step="0.01" value={value.price} onChange={(event) => update('price', event.target.value)} />
      <Input label={t('provider.products.currency')} required maxLength={3} value={value.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} />
      <Input label={t('provider.products.unitLabel')} required maxLength={40} value={value.unit_label} onChange={(event) => update('unit_label', event.target.value)} placeholder="item" />
      <Select label={t('provider.products.stockMode')} value={value.stock_mode} onChange={(event) => update('stock_mode', event.target.value as StockMode)}>
        <option value="in_stock">{t('provider.products.inStock')}</option>
        <option value="out_of_stock">{t('provider.products.outOfStock')}</option>
        <option value="made_to_order">{t('provider.products.madeToOrder')}</option>
      </Select>
      <Select label={t('provider.products.catalogStatus')} value={value.status} onChange={(event) => update('status', event.target.value as ProductStatus)}>
        <option value="draft">{t('provider.products.draft')}</option>
        <option value="active" disabled={readiness?.trust_status !== 'normal'}>{t('provider.products.active')}</option>
        <option value="paused">{t('provider.products.paused')}</option>
      </Select>
    </div>
    <Textarea label={t('provider.products.description')} maxLength={5000} rows={4} value={value.description} onChange={(event) => update('description', event.target.value)} />
  </>;

  return <LiveProviderShell active="/provider/products">
    <ProviderHeading
      eyebrow={t('provider.products.eyebrow')}
      title={t('provider.products.title')}
      description={t('provider.products.intro')}
    />

    <Alert title={t('provider.products.revisionLaunchTitle')} tone="info">
      {t('provider.products.revisionLaunchBody')}
    </Alert>

    {readiness?.trust_status === 'suspended' ? <Alert title={t('provider.products.suspensionTitle')} tone="danger">{t('provider.products.suspensionBody')} <Link href="/account/support">{t('provider.products.openPlatformSupport')} →</Link></Alert> : readiness?.trust_status === 'reverification_required' ? <Alert title={t('provider.products.reverificationTitle')} tone="warning">{t('provider.products.reverificationBody')} <Link href="/provider/verification">{t('provider.products.continueReverification')} →</Link></Alert> : null}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.75rem', margin: '1rem 0' }}>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{t('provider.products.total')}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.all}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{t('provider.products.active')}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.active}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{t('provider.products.paused')}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.paused}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{t('provider.products.approved')}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.approved}</strong></Card>
      <Card style={{ padding: '1rem' }}><span className="eyebrow">{t('provider.products.reviewPending')}</span><strong style={{ display: 'block', marginTop: '.35rem', fontSize: '1.6rem' }}>{counts.pending}</strong></Card>
    </div>

    {error ? <Alert title={t('provider.products.errorTitle')} tone="danger">{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}

    <Card style={{ marginTop: '1rem' }}>
      <form onSubmit={createProduct} style={{ display: 'grid', gap: '1rem' }}>
        <div><span className="eyebrow">{t('provider.products.newProduct')}</span><h2 style={{ margin: '.35rem 0 0' }}>{t('provider.products.addCatalogItem')}</h2></div>
        {formFields(draft, updateDraft)}
        <div><Button type="submit" loading={saving}>{t('provider.products.saveProduct')}</Button></div>
      </form>
    </Card>

    <section style={{ display: 'grid', gap: '.8rem', marginTop: '1rem' }} aria-label={t('provider.products.ariaLabel')}>
      {loading ? <Card><p>{t('provider.products.loading')}</p></Card> : products.length ? products.map((product) => {
        const editing = editingId === product.id;
        const currentLaunch = product.launch?.product_revision === product.review_revision ? product.launch : null;
        const launchStatus = currentLaunch?.status ?? 'needs_review';
        const currentApproved = currentLaunch?.status === 'approved';
        const currentPending = currentLaunch?.status === 'pending';
        const catalogBlocker = catalogActivationBlocker();
        const publicBlockers = [
          !readiness?.verified ? t('provider.products.blockerVerification') : null,
          !readiness?.profile_complete ? t('provider.products.blockerProfileBasics') : null,
          !readiness?.marketplace_disclosure_complete ? t('provider.products.blockerDisclosure') : null,
          !currentApproved ? t('provider.products.blockerRevisionApproval') : null,
        ].filter((value): value is string => Boolean(value));
        const publicReturnReady = !catalogBlocker && publicBlockers.length === 0;
        return <Card key={product.id} style={{ display: 'grid', gap: '.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.75rem' }}>
            <div>
              <span className="eyebrow">{product.sku || t('provider.products.noSku')} · Rev {product.review_revision}</span>
              <h2 style={{ margin: '.3rem 0 .2rem' }}>{product.name}</h2>
              <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>{money(product)} / {product.unit_label}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              <Badge tone={statusTone(product.status)}>{product.status === 'active' ? t('provider.products.active') : product.status === 'paused' ? t('provider.products.paused') : t('provider.products.draft')}</Badge>
              <Badge tone={stockTone(product.stock_mode)}>{product.stock_mode === 'in_stock' ? t('provider.products.inStock') : product.stock_mode === 'out_of_stock' ? t('provider.products.outOfStock') : t('provider.products.madeToOrder')}</Badge>
              <Badge tone={launchTone(launchStatus)}>{launchStatus === 'needs_review' ? t('provider.products.needsReview') : launchStatus === 'pending' ? t('provider.products.reviewPending') : launchStatus === 'approved' ? t('provider.products.approved') : launchStatus === 'changes_requested' ? t('provider.products.changesRequested') : launchStatus === 'rejected' ? t('provider.products.rejected') : t('provider.products.withdrawn')}</Badge>
            </div>
          </div>

          <ProductPrimaryImageControl productId={product.id} productName={product.name} onChanged={load} />
          {currentLaunch?.review_note ? <Alert tone={currentLaunch.status === 'approved' ? 'success' : 'warning'}>{currentLaunch.review_note}</Alert> : null}
          {product.launch && !currentLaunch ? <Alert tone="warning">`${t('provider.products.previousReviewPrefix')} ${product.launch.product_revision}. ${t('provider.products.currentRevisionPrefix')} ${product.review_revision} ${t('provider.products.needsNewApprovalSuffix')}`</Alert> : null}
          {product.status === 'paused' ? <Alert title={catalogBlocker ? t('provider.products.reactivationBlockedTitle') : publicReturnReady ? t('provider.products.manualReactivationReadyTitle') : t('provider.products.publicBlockersRemainTitle')} tone={catalogBlocker ? (readiness?.trust_status === 'suspended' ? 'danger' : 'warning') : publicReturnReady ? 'success' : 'warning'}>
            {catalogBlocker
              ? catalogBlocker
              : publicReturnReady
                ? t('provider.products.publicReadyBody')
                : `${t('provider.products.publicBlockersPrefix')} ${publicBlockers.join(', ')}.`}
            {' '}<Link href={readiness?.trust_status === 'suspended' ? '/account/support' : readiness?.trust_status === 'reverification_required' ? '/provider/verification' : '/provider/public-readiness'}>{readiness?.trust_status === 'suspended' ? `${t('provider.products.openPlatformSupport')} →` : readiness?.trust_status === 'reverification_required' ? `${t('provider.products.continueVerification')} →` : `${t('provider.products.reviewPublicReadiness')} →`}</Link>
          </Alert> : null}

          {editing ? <div style={{ display: 'grid', gap: '1rem' }}>
            {formFields(editDraft, updateEditDraft)}
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Button type="button" loading={saving} onClick={() => void saveProduct(product.id)}>{t('provider.products.saveChanges')}</Button>
              <Button type="button" variant="quiet" disabled={saving} onClick={() => setEditingId(null)}>{t('provider.products.cancel')}</Button>
            </div>
          </div> : <>
            {product.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <Button type="button" variant="secondary" onClick={() => { setEditingId(product.id); setEditDraft(draftFromProduct(product)); setNotice(''); }}>{t('provider.products.editProduct')}</Button>
              {product.status === 'paused' && !catalogBlocker ? <Button type="button" disabled={saving} onClick={() => void setProductStatus(product.id, 'active')}>{t('provider.products.reactivateCatalog')}</Button> : null}
              {currentPending ? <Button type="button" variant="quiet" disabled={saving} onClick={() => void changeLaunch(product, 'DELETE')}>{t('provider.products.withdrawReview')}</Button> : null}
              {!currentPending && !currentApproved ? <Button type="button" disabled={saving || product.status !== 'active'} onClick={() => void changeLaunch(product, 'POST')}>{t('provider.products.submitPublicLaunch')}</Button> : null}
            </div>
            {product.status !== 'active' && !currentApproved ? <p className="muted" style={{ margin: 0 }}>{t('provider.products.activeRequiredForLaunch')}</p> : null}
          </>}
        </Card>;
      }) : <Card><EmptyState title={t('provider.products.emptyTitle')}>{t('provider.products.emptyBody')}</EmptyState></Card>}
    </section>
  </LiveProviderShell>;
}