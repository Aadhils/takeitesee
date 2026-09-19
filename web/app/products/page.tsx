'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '../../components/ui/primitives';
import { usePublicProviderTranslations } from '../../components/i18n/PublicProviderTranslations';
import ProductSmartFilters from '../../components/discovery/ProductSmartFilters';

type StockMode = 'in_stock' | 'out_of_stock' | 'made_to_order';
type ShopState = 'open' | 'closed';
type StockFilter = 'any' | 'orderable' | 'in_stock' | 'made_to_order';
type ShopFilter = 'any' | 'open';
type SortMode = 'relevance' | 'price' | 'price-desc' | 'name';

const stockFilters: StockFilter[] = ['any', 'orderable', 'in_stock', 'made_to_order'];
const shopFilters: ShopFilter[] = ['any', 'open'];
const sortModes: SortMode[] = ['relevance', 'price', 'price-desc', 'name'];
const productPageSize = 24;

type Product = {
  id: string;
  business_id: string;
  business_name: string;
  business_location: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  unit_label: string;
  stock_mode: StockMode;
  business_shop_state: ShopState;
  has_primary_image: boolean;
  verified_business: boolean;
};

type ProductPagePayload = {
  products?: Product[];
  page?: { next_cursor?: string | null; has_more?: boolean };
  error?: string;
};

type SavedProductSummary = { product_id: string };

function productDetailHref(product: Product) {
  return `/products/${encodeURIComponent(product.id)}`;
}

function productImageHref(productId: string) {
  return `/api/marketplace/products/${encodeURIComponent(productId)}/image`;
}

function buildProductParams(query: string, stock: StockFilter, shop: ShopFilter, sort: SortMode) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (stock !== 'any') params.set('stock', stock);
  if (shop !== 'any') params.set('shop', shop);
  if (sort !== 'relevance') params.set('sort', sort);
  return params;
}

function buildProductApiParams(query: string, stock: StockFilter, shop: ShopFilter, sort: SortMode, cursor?: string | null) {
  const params = buildProductParams(query, stock, shop, sort);
  params.set('limit', String(productPageSize));
  if (cursor) params.set('cursor', cursor);
  return params;
}

export default function ProductsPage() {
  const { locale, t } = usePublicProviderTranslations();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [stock, setStock] = useState<StockFilter>('any');
  const [shop, setShop] = useState<ShopFilter>('any');
  const [sort, setSort] = useState<SortMode>('relevance');
  const [urlReady, setUrlReady] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [saveAuthenticated, setSaveAuthenticated] = useState<boolean | null>(null);
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => new Set());
  const [saveBusyId, setSaveBusyId] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stockParam = params.get('stock') as StockFilter;
    const shopParam = params.get('shop') as ShopFilter;
    const sortParam = params.get('sort') as SortMode;
    const initialQuery = params.get('q')?.trim() ?? '';
    setQuery(initialQuery);
    setServerQuery(initialQuery);
    setStock(stockFilters.includes(stockParam) ? stockParam : 'any');
    setShop(shopFilters.includes(shopParam) ? shopParam : 'any');
    setSort(sortModes.includes(sortParam) ? sortParam : 'relevance');
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const timer = window.setTimeout(() => setServerQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query, urlReady]);

  useEffect(() => {
    if (!urlReady) return;
    const params = buildProductParams(query, stock, shop, sort);
    const search = params.toString();
    window.history.replaceState(null, '', search ? `/products?${search}` : '/products');
  }, [query, shop, sort, stock, urlReady]);

  useEffect(() => {
    if (!urlReady) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setLoadMoreError('');
    setProducts([]);
    setNextCursor(null);
    setHasMore(false);

    const params = buildProductApiParams(serverQuery, stock, shop, sort);
    void fetch(`/api/marketplace/products?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ProductPagePayload;
        if (!response.ok) throw new Error(payload.error || t('publicProvider.productMarketplace.loadError'));
        setProducts(Array.isArray(payload.products) ? payload.products : []);
        const cursor = payload.page?.next_cursor ?? null;
        setNextCursor(cursor);
        setHasMore(Boolean(payload.page?.has_more && cursor));
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : t('publicProvider.productMarketplace.loadError'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [serverQuery, shop, sort, stock, t, urlReady]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/saved-products', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) {
            setSaveAuthenticated(false);
            setSavedProductIds(new Set());
          }
          return;
        }
        const payload = await response.json() as { saved_products?: SavedProductSummary[]; error?: string };
        if (!cancelled) setSaveAuthenticated(true);
        if (!response.ok) throw new Error(payload.error || t('publicProvider.savedProduct.loadError'));
        if (!cancelled) setSavedProductIds(new Set((payload.saved_products ?? []).map((item) => item.product_id)));
      })
      .catch((cause) => {
        if (!cancelled) setSaveError(cause instanceof Error ? cause.message : t('publicProvider.savedProduct.loadError'));
      });
    return () => { cancelled = true; };
  }, [t]);

  const money = (product: Product) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: product.currency || 'INR',
        maximumFractionDigits: 2,
      }).format(Number.isFinite(product.price) ? product.price : 0);
    } catch {
      return `${product.currency || 'INR'} ${(Number.isFinite(product.price) ? product.price : 0).toFixed(2)}`;
    }
  };

  const stockPresentation = (mode: StockMode) => {
    if (mode === 'in_stock') return { label: t('publicProvider.businessProducts.inStock'), tone: 'success' as const };
    if (mode === 'made_to_order') return { label: t('publicProvider.businessProducts.madeToOrder'), tone: 'warning' as const };
    return { label: t('publicProvider.businessProducts.outOfStock'), tone: 'neutral' as const };
  };

  const currentContext = (() => {
    const params = buildProductParams(query, stock, shop, sort).toString();
    return params ? `/products?${params}` : '/products';
  })();

  const toggleSavedProduct = async (productId: string) => {
    if (saveBusyId) return;
    const saved = savedProductIds.has(productId);
    setSaveBusyId(productId);
    setSaveError('');
    try {
      const response = await fetch('/api/account/saved-products', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      if (response.status === 401) {
        window.location.assign(`/login?returnTo=${encodeURIComponent(currentContext)}`);
        return;
      }
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || (saved ? t('publicProvider.savedProduct.removeError') : t('publicProvider.savedProduct.saveError')));
      setSaveAuthenticated(true);
      setSavedProductIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(productId); else next.add(productId);
        return next;
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t('publicProvider.savedProduct.updateError'));
    } finally {
      setSaveBusyId('');
    }
  };

  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    const cursor = nextCursor;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const params = buildProductApiParams(serverQuery, stock, shop, sort, cursor);
      const response = await fetch(`/api/marketplace/products?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json() as ProductPagePayload;
      if (!response.ok) throw new Error(payload.error || t('publicProvider.productMarketplace.loadMoreError'));
      const nextProducts = Array.isArray(payload.products) ? payload.products : [];
      setProducts((current) => {
        const ids = new Set(current.map((product) => product.id));
        return [...current, ...nextProducts.filter((product) => !ids.has(product.id))];
      });
      const next = payload.page?.next_cursor ?? null;
      setNextCursor(next);
      setHasMore(Boolean(payload.page?.has_more && next));
    } catch (cause) {
      setLoadMoreError(cause instanceof Error ? cause.message : t('publicProvider.productMarketplace.loadMoreError'));
    } finally {
      setLoadingMore(false);
    }
  };

  const clear = () => {
    setQuery('');
    setStock('any');
    setShop('any');
    setSort('relevance');
  };

  return <div className="discovery-page discovery-workspace">
    <section className="page-intro">
      <span className="eyebrow">{t('publicProvider.productMarketplace.eyebrow')}</span>
      <h1>{t('publicProvider.productMarketplace.title')}</h1>
      <p>{t('publicProvider.productMarketplace.intro')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '1rem' }}>
        <Link href="/explore" className="button button-secondary">{t('publicProvider.productMarketplace.browseServices')}</Link>
        <Link href="/businesses" className="button button-quiet">{t('publicProvider.productMarketplace.browseBusinesses')}</Link>
        {saveAuthenticated ? <Link href="/saved-products" className="button button-quiet">{t('publicProvider.productMarketplace.savedProducts')}</Link> : null}
      </div>
    </section>

    <section className="discovery-search-panel">
      <div className="discovery-search-row">
        <Input
          label={t('publicProvider.productMarketplace.searchLabel')}
          placeholder={t('publicProvider.productMarketplace.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ProductSmartFilters
        stock={stock}
        shop={shop}
        sort={sort}
        resultCount={products.length}
        loading={loading}
        onStockChange={(value) => setStock(value as StockFilter)}
        onShopChange={(value) => setShop(value as ShopFilter)}
        onSortChange={(value) => setSort(value as SortMode)}
        onClearAll={clear}
      />
    </section>

    {saveError ? <p className="field-error" role="alert" style={{ marginBottom: '1rem' }}>{saveError}</p> : null}

    <div className="results-heading">
      <div>
        <span className="eyebrow">{t('publicProvider.productMarketplace.resultsEyebrow')}</span>
        <h2>{loading
          ? t('publicProvider.productMarketplace.loading')
          : serverQuery
            ? t('publicProvider.productMarketplace.resultsFor')
              .replace('{count}', String(products.length))
              .replace('{query}', serverQuery)
            : t('publicProvider.productMarketplace.resultsCount').replace('{count}', String(products.length))}</h2>
      </div>
    </div>

    {loading ? <div className="service-grid"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /></div></div>
      : error ? <Card><EmptyState title={t('publicProvider.productMarketplace.unavailableTitle')}>{error}</EmptyState></Card>
        : products.length ? <>
          <div className="service-grid">{products.map((product) => {
            const stockState = stockPresentation(product.stock_mode);
            const shopOpen = product.business_shop_state === 'open';
            const productHref = productDetailHref(product);
            const saved = savedProductIds.has(product.id);
            return <Card className="discovery-card service-discovery-card" key={product.id}>
              {product.has_primary_image ? <div className="service-card-art" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                  src={productImageHref(product.id)}
                  alt={t('publicProvider.businessProducts.imageAlt').replace('{productName}', product.name)}
                  style={{ width: '100%', height: '100%', minHeight: '160px', objectFit: 'cover', display: 'block' }}
                />
                <span className="art-label" style={{ position: 'absolute', left: '.75rem', bottom: '.75rem' }}>{t('publicProvider.productMarketplace.productLabel')}</span>
              </div> : <div className="service-card-art" aria-hidden="true"><span>{product.name.slice(0, 1)}</span><span className="art-label">{t('publicProvider.productMarketplace.productLabel')}</span></div>}
              <div className="discovery-card-content">
                <div className="card-meta">
                  <Badge tone={stockState.tone}>{stockState.label}</Badge>
                  <Badge tone={shopOpen ? 'success' : 'neutral'}>{shopOpen ? t('publicProvider.productMarketplace.shopOpen') : t('publicProvider.productMarketplace.shopClosed')}</Badge>
                  {product.verified_business ? <Badge tone="info">{t('publicProvider.productMarketplace.verifiedBusiness')}</Badge> : null}
                  {saved ? <Badge tone="success">{t('publicProvider.productMarketplace.saved')}</Badge> : null}
                </div>
                <h3><Link href={productHref}>{product.name}</Link></h3>
                {product.description ? <p className="card-description">{product.description}</p> : null}
                <p className="card-provider"><Link href={`/businesses/${encodeURIComponent(product.business_id)}`}>{product.business_name}</Link>{product.business_location ? <> <span aria-hidden="true">·</span> {product.business_location}</> : null}</p>
                <div className="card-footer">
                  <div>
                    <span className="price">{money(product)} / {product.unit_label}</span>
                    <small style={{ display: 'block', marginTop: '.35rem' }}>{t('publicProvider.productMarketplace.orderOnly')}</small>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', justifyContent: 'flex-end' }}>
                    {saveAuthenticated === false ? <Link href={`/login?returnTo=${encodeURIComponent(currentContext)}`} className="button button-quiet">{t('publicProvider.productMarketplace.signInToSave')}</Link>
                      : saveAuthenticated === true ? <Button type="button" variant={saved ? 'secondary' : 'quiet'} loading={saveBusyId === product.id} disabled={Boolean(saveBusyId && saveBusyId !== product.id)} aria-pressed={saved} onClick={() => void toggleSavedProduct(product.id)}>{saved ? t('publicProvider.savedProduct.saved') : t('publicProvider.savedProduct.save')}</Button>
                        : null}
                    <Link href={productHref} className="button button-secondary">{product.stock_mode === 'out_of_stock' ? t('publicProvider.productMarketplace.viewProduct') : t('publicProvider.productMarketplace.requestProduct')}</Link>
                  </div>
                </div>
              </div>
            </Card>;
          })}</div>
          {loadMoreError ? <p className="field-error" role="alert" style={{ marginTop: '1rem' }}>{loadMoreError}</p> : null}
          {hasMore ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
            <Button type="button" variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
              {t('publicProvider.productMarketplace.loadMore')}
            </Button>
          </div> : <p className="muted" style={{ textAlign: 'center', marginTop: '1.25rem' }}>{t('publicProvider.productMarketplace.endCatalog')}</p>}
        </>
          : <Card><EmptyState title={t('publicProvider.productMarketplace.noMatchesTitle')}>{t('publicProvider.productMarketplace.noMatchesHelp')}</EmptyState></Card>}

    <p className="explore-disclaimer">{t('publicProvider.productMarketplace.disclaimer')}</p>
  </div>;
}
