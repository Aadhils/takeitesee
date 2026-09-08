'use client';

import { useLanguage } from '../i18n/LanguageProvider';

type PublicProduct = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  currency: string;
  unit_label: string;
  stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
};

export default function BusinessStorefrontProducts({ products }: { products: PublicProduct[] }) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
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

  return <section className="container section-stack" aria-label={tamil ? 'Business products' : 'Business products'} style={{ paddingTop: '1rem' }}>
    <div className="page-intro" style={{ marginBottom: 0 }}>
      <span className="eyebrow">Business sales</span>
      <h2>Products</h2>
      <p>{tamil
        ? 'Platform review செய்யப்பட்ட current revision products மட்டும் இங்கே தெரியும். Order request அடுத்த commerce stage-ல் enable செய்யப்படும்; payment/Cashfree இப்போது செயல்படாது.'
        : 'Only platform-reviewed current product revisions appear here. Order requests will be enabled in the next commerce stage; payment and Cashfree are not active.'}</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
      {products.map((product) => <article className="card" key={product.id} style={{ display: 'grid', gap: '.75rem', alignContent: 'start' }}>
        <div>
          <span className="eyebrow">{stockLabel(product.stock_mode)}</span>
          <h3 style={{ margin: '.35rem 0' }}>{product.name}</h3>
          <strong>{money(product)} / {product.unit_label}</strong>
        </div>
        {product.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}
        <p className="muted" style={{ margin: 0 }}>{product.stock_mode === 'out_of_stock'
          ? (tamil ? 'இந்த product தற்போது order செய்ய முடியாது.' : 'This product is not currently available to order.')
          : (tamil ? 'Order request விரைவில் enable செய்யப்படும்.' : 'Order requests will be enabled next.')}</p>
      </article>)}
    </div>
  </section>;
}
