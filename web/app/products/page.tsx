'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton } from '../../components/ui/primitives';
import { useLanguage } from '../../components/i18n/LanguageProvider';

type StockMode = 'in_stock' | 'out_of_stock' | 'made_to_order';
type ShopState = 'open' | 'closed';
type StockFilter = 'any' | 'orderable' | 'in_stock' | 'made_to_order';
type ShopFilter = 'any' | 'open';
type SortMode = 'relevance' | 'price' | 'price-desc' | 'name';

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

type SavedProductSummary = { product_id: string };

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function productDetailHref(product: Product) {
  return `/products/${encodeURIComponent(product.id)}`;
}

function productImageHref(productId: string) {
  return `/api/marketplace/products/${encodeURIComponent(productId)}/image`;
}

export default function ProductsPage() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState<StockFilter>('any');
  const [shop, setShop] = useState<ShopFilter>('any');
  const [sort, setSort] = useState<SortMode>('relevance');
  const [saveAuthenticated, setSaveAuthenticated] = useState<boolean | null>(null);
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(() => new Set());
  const [saveBusyId, setSaveBusyId] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/marketplace/products', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { products?: Product[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Product marketplace unavailable.');
        if (!cancelled) setProducts(Array.isArray(payload.products) ? payload.products : []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Product marketplace unavailable.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
        if (!response.ok) throw new Error(payload.error || 'Unable to load saved Products.');
        if (!cancelled) setSavedProductIds(new Set((payload.saved_products ?? []).map((item) => item.product_id)));
      })
      .catch((cause) => {
        if (!cancelled) setSaveError(cause instanceof Error ? cause.message : 'Unable to load saved Products.');
      });
    return () => { cancelled = true; };
  }, []);

  const filteredProducts = useMemo(() => {
    const needle = normalized(query);
    return products
      .filter((product) => !needle || normalized([
        product.name,
        product.description,
        product.business_name,
        product.business_location,
      ].join(' ')).includes(needle))
      .filter((product) => stock === 'any'
        || (stock === 'orderable' && product.stock_mode !== 'out_of_stock')
        || product.stock_mode === stock)
      .filter((product) => shop === 'any' || product.business_shop_state === 'open')
      .sort((a, b) => sort === 'price'
        ? a.price - b.price
        : sort === 'price-desc'
          ? b.price - a.price
          : sort === 'name'
            ? a.name.localeCompare(b.name)
            : Number(b.business_shop_state === 'open') - Number(a.business_shop_state === 'open')
              || Number(b.stock_mode !== 'out_of_stock') - Number(a.stock_mode !== 'out_of_stock')
              || a.name.localeCompare(b.name));
  }, [products, query, shop, sort, stock]);

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
    if (mode === 'in_stock') return { label: tamil ? 'Stock உள்ளது' : 'In stock', tone: 'success' as const };
    if (mode === 'made_to_order') return { label: tamil ? 'Order அடிப்படையில்' : 'Made to order', tone: 'warning' as const };
    return { label: tamil ? 'Stock இல்லை' : 'Out of stock', tone: 'neutral' as const };
  };

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
        window.location.assign(`/login?returnTo=${encodeURIComponent('/products')}`);
        return;
      }
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || (saved ? 'Unable to remove saved Product.' : 'Unable to save Product.'));
      setSaveAuthenticated(true);
      setSavedProductIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(productId); else next.add(productId);
        return next;
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to update saved Product.');
    } finally {
      setSaveBusyId('');
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
      <span className="eyebrow">{tamil ? 'Business marketplace' : 'Business marketplace'}</span>
      <h1>{tamil ? 'Products கண்டுபிடிக்கவும்' : 'Discover products'}</h1>
      <p>{tamil
        ? 'Platform review செய்யப்பட்ட current product revisions மட்டும் இங்கே தெரியும். Stock மற்றும் Shop status பார்க்கலாம்; order request Business storefront-ல் existing flow மூலம் அனுப்பலாம்.'
        : 'Browse only current product revisions approved for public launch. See stock and Shop status here, then use the existing Business storefront flow to request an order.'}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '1rem' }}>
        <Link href="/explore" className="button button-secondary">{tamil ? 'Services பார்க்க' : 'Browse services'}</Link>
        <Link href="/businesses" className="button button-quiet">{tamil ? 'Businesses பார்க்க' : 'Browse Businesses'}</Link>
        {saveAuthenticated ? <Link href="/saved-products" className="button button-quiet">{tamil ? 'Saved Products' : 'Saved Products'}</Link> : null}
      </div>
    </section>

    <section className="discovery-search-panel">
      <div className="discovery-search-row">
        <Input
          label={tamil ? 'Product தேடல்' : 'Search products'}
          placeholder={tamil ? 'Product, Business அல்லது location' : 'Product, Business, or location'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="discovery-filter-fields">
        <Select label={tamil ? 'Stock நிலை' : 'Stock'} value={stock} onChange={(event) => setStock(event.target.value as StockFilter)}>
          <option value="any">{tamil ? 'எந்த stock நிலையும்' : 'Any stock status'}</option>
          <option value="orderable">{tamil ? 'Order செய்யக்கூடியவை' : 'Orderable only'}</option>
          <option value="in_stock">{tamil ? 'Stock உள்ளவை' : 'In stock'}</option>
          <option value="made_to_order">{tamil ? 'Order அடிப்படையில்' : 'Made to order'}</option>
        </Select>
        <Select label={tamil ? 'Shop நிலை' : 'Shop status'} value={shop} onChange={(event) => setShop(event.target.value as ShopFilter)}>
          <option value="any">{tamil ? 'Open/Closed அனைத்தும்' : 'Open or Closed'}</option>
          <option value="open">{tamil ? 'Shop Open மட்டும்' : 'Shop Open only'}</option>
        </Select>
        <Select label={tamil ? 'Sort' : 'Sort'} value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="relevance">{tamil ? 'Useful முதலில்' : 'Useful first'}</option>
          <option value="price">{tamil ? 'குறைந்த விலை' : 'Lowest price'}</option>
          <option value="price-desc">{tamil ? 'அதிக விலை' : 'Highest price'}</option>
          <option value="name">{tamil ? 'பெயர்' : 'Name'}</option>
        </Select>
      </div>
      <div className="discovery-search-footer">
        <Button type="button" variant="quiet" onClick={clear}>{tamil ? 'Filters clear செய்' : 'Clear filters'}</Button>
      </div>
    </section>

    {saveError ? <p className="field-error" role="alert" style={{ marginBottom: '1rem' }}>{saveError}</p> : null}

    <div className="results-heading">
      <div>
        <span className="eyebrow">{tamil ? 'Approved products' : 'Approved products'}</span>
        <h2>{loading ? (tamil ? 'Products ஏற்றப்படுகிறது…' : 'Loading products…') : `${filteredProducts.length} ${tamil ? 'products' : 'products'}`}</h2>
      </div>
    </div>

    {loading ? <div className="service-grid"><div className="loading-card"><Skeleton className="loading-art" /><Skeleton className="loading-line" /><Skeleton className="loading-line short" /></div></div>
      : error ? <Card><EmptyState title={tamil ? 'Product marketplace தற்போது கிடைக்கவில்லை' : 'Product marketplace unavailable'}>{error}</EmptyState></Card>
        : filteredProducts.length ? <div className="service-grid">{filteredProducts.map((product) => {
          const stockState = stockPresentation(product.stock_mode);
          const shopOpen = product.business_shop_state === 'open';
          const productHref = productDetailHref(product);
          const saved = savedProductIds.has(product.id);
          return <Card className="discovery-card service-discovery-card" key={product.id}>
            {product.has_primary_image ? <div className="service-card-art" style={{ padding: 0, overflow: 'hidden' }}>
              <img
                src={productImageHref(product.id)}
                alt={`${product.name} product`}
                style={{ width: '100%', height: '100%', minHeight: '160px', objectFit: 'cover', display: 'block' }}
              />
              <span className="art-label" style={{ position: 'absolute', left: '.75rem', bottom: '.75rem' }}>{tamil ? 'Product' : 'Product'}</span>
            </div> : <div className="service-card-art" aria-hidden="true"><span>{product.name.slice(0, 1)}</span><span className="art-label">{tamil ? 'Product' : 'Product'}</span></div>}
            <div className="discovery-card-content">
              <div className="card-meta">
                <Badge tone={stockState.tone}>{stockState.label}</Badge>
                <Badge tone={shopOpen ? 'success' : 'neutral'}>{shopOpen ? (tamil ? 'Shop Open' : 'Shop Open') : (tamil ? 'Shop Closed' : 'Shop Closed')}</Badge>
                {product.verified_business ? <Badge tone="info">{tamil ? 'Verified Business' : 'Verified Business'}</Badge> : null}
                {saved ? <Badge tone="success">{tamil ? 'Saved' : 'Saved'}</Badge> : null}
              </div>
              <h3><Link href={productHref}>{product.name}</Link></h3>
              {product.description ? <p className="card-description">{product.description}</p> : null}
              <p className="card-provider"><Link href={`/businesses/${encodeURIComponent(product.business_id)}`}>{product.business_name}</Link>{product.business_location ? <> <span aria-hidden="true">·</span> {product.business_location}</> : null}</p>
              <div className="card-footer">
                <div>
                  <span className="price">{money(product)} / {product.unit_label}</span>
                  <small style={{ display: 'block', marginTop: '.35rem' }}>{tamil ? 'Order request மட்டும்; online payment இல்லை.' : 'Order request only; no online payment.'}</small>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', justifyContent: 'flex-end' }}>
                  {saveAuthenticated === false ? <Link href={`/login?returnTo=${encodeURIComponent('/products')}`} className="button button-quiet">{tamil ? 'Save செய்ய Sign in' : 'Sign in to save'}</Link>
                    : saveAuthenticated === true ? <Button type="button" variant={saved ? 'secondary' : 'quiet'} loading={saveBusyId === product.id} disabled={Boolean(saveBusyId && saveBusyId !== product.id)} aria-pressed={saved} onClick={() => void toggleSavedProduct(product.id)}>{saved ? (tamil ? 'Saved ✓' : 'Saved ✓') : (tamil ? 'Save Product' : 'Save Product')}</Button>
                      : null}
                  <Link href={productHref} className="button button-secondary">{product.stock_mode === 'out_of_stock' ? (tamil ? 'Product பார்க்க' : 'View product') : (tamil ? 'இந்த product order கேள்' : 'Request this product')}</Link>
                </div>
              </div>
            </div>
          </Card>;
        })}</div>
          : <Card><EmptyState title={tamil ? 'இந்த filters-க்கு products இல்லை' : 'No products match these filters'}>{tamil ? 'Filters clear செய்து மீண்டும் பார்க்கவும்.' : 'Clear the filters and browse the approved catalog again.'}</EmptyState></Card>}

    <p className="explore-disclaimer">{tamil
      ? 'Save என்பது shortlist மட்டும். Shop Open/Closed என்பது தகவல் signal மட்டும். Out of stock products order செய்ய முடியாது. TakeItEsee payment/Cashfree activation இன்னும் இல்லை.'
      : 'Saving creates a shortlist only. Shop Open/Closed is informational only. Out-of-stock products cannot be ordered. TakeItEsee payment and Cashfree are not active.'}</p>
  </div>;
}