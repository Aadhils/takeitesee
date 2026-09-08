import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import BusinessShopPublicStatus from '../../../components/detail/BusinessShopPublicStatus';
import BusinessStorefrontProducts from '../../../components/detail/BusinessStorefrontProducts';
import ProductShareAction from '../../../components/detail/ProductShareAction';
import { hasMarketplaceDisclosure } from '../../../server/marketplace/public-directory';

const siteUrl = 'https://www.takeitesee.com';

type PublicProduct = {
  id: string;
  business_id: string;
  name: string | null;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  unit_label: string | null;
  stock_mode: 'in_stock' | 'out_of_stock' | 'made_to_order';
};

type PublicBusiness = {
  id: string;
  name: string | null;
  description: string | null;
  location: string | null;
  verified: boolean;
  legal_name: string | null;
  principal_address: string | null;
  public_contact_email: string | null;
  public_contact_phone: string | null;
  grievance_officer_name: string | null;
  grievance_officer_designation: string | null;
  grievance_email: string | null;
  grievance_phone: string | null;
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function seoText(value: string | null | undefined, fallback: string, max = 160) {
  const text = (value || fallback).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const loadPublicProduct = cache(async (productId: string) => {
  const supabase = publicSupabase();
  if (!supabase) return null;

  // Existing business_products anon RLS is the publication authority. A product
  // hidden by launch governance is indistinguishable from a missing product here.
  const { data: product, error: productError } = await supabase
    .from('business_products')
    .select('id,business_id,name,description,price,currency,unit_label,stock_mode')
    .eq('id', productId)
    .maybeSingle();
  if (productError || !product?.id || !product.business_id || !product.name) return null;

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id,name,description,location,verified,legal_name,principal_address,public_contact_email,public_contact_phone,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone')
    .eq('id', product.business_id)
    .eq('verified', true)
    .maybeSingle();
  if (businessError || !business || business.verified !== true || !hasMarketplaceDisclosure(business)) return null;

  return {
    product: product as PublicProduct,
    business: business as PublicBusiness,
  };
});

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  const record = await loadPublicProduct(productId);

  if (!record) {
    return {
      title: { absolute: 'Product unavailable | TakeItEsee' },
      robots: { index: false, follow: false },
    };
  }

  const { product, business } = record;
  const productName = product.name || 'Product';
  const businessName = business.name || 'Verified Business';
  const location = business.location || '';
  const pageTitle = `${productName} by ${businessName}${location ? ` in ${location}` : ''}`;
  const socialTitle = `${pageTitle} | TakeItEsee`;
  const description = seoText(
    product.description,
    `View ${productName} from ${businessName}${location ? ` in ${location}` : ''} on TakeItEsee and send a non-payment order request.`,
  );
  const canonical = `${siteUrl}/products/${encodeURIComponent(productId)}`;

  return {
    title: { absolute: socialTitle },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      type: 'website',
      images: ['/brand/social'],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: ['/brand/social'],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const record = await loadPublicProduct(productId);
  if (!record) notFound();

  const { product, business } = record;
  const productName = product.name || 'Product';
  const businessName = business.name || 'Verified Business';
  const canonical = `${siteUrl}/products/${encodeURIComponent(product.id)}`;
  const storefrontHref = `/businesses/${encodeURIComponent(product.business_id)}#product-${product.id}`;
  const availability = product.stock_mode === 'out_of_stock'
    ? 'https://schema.org/OutOfStock'
    : product.stock_mode === 'made_to_order'
      ? 'https://schema.org/PreOrder'
      : 'https://schema.org/InStock';
  const price = Number(product.price || 0);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    description: product.description || undefined,
    url: canonical,
    offers: {
      '@type': 'Offer',
      url: canonical,
      price: Number.isFinite(price) ? price : 0,
      priceCurrency: product.currency || 'INR',
      availability,
      seller: {
        '@type': 'LocalBusiness',
        name: businessName,
        url: `${siteUrl}/businesses/${encodeURIComponent(product.business_id)}`,
      },
    },
  };

  return <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    />
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem' }}>
      <Link href="/products" className="button button-quiet">← Browse products</Link>
      <ProductShareAction productId={product.id} productName={productName} businessName={businessName} />
    </div>
    <section className="container page-intro" style={{ paddingTop: '1rem' }}>
      <span className="eyebrow">Business product</span>
      <h1>{productName}</h1>
      <p>{product.description || `Product from ${businessName}.`}</p>
      <p style={{ marginTop: '.75rem' }}>
        Sold by <Link href={`/businesses/${encodeURIComponent(product.business_id)}`}>{businessName}</Link>
        {business.location ? <> <span aria-hidden="true">·</span> {business.location}</> : null}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '1rem' }}>
        <Link href={storefrontHref} className="button button-secondary">View in Business storefront</Link>
        <Link href="/products" className="button button-quiet">Back to product marketplace</Link>
      </div>
    </section>
    <BusinessShopPublicStatus businessId={product.business_id} />
    <BusinessStorefrontProducts products={[{
      id: product.id,
      name: productName,
      description: product.description || '',
      price: product.price ?? 0,
      currency: product.currency || 'INR',
      unit_label: product.unit_label || 'item',
      stock_mode: product.stock_mode,
    }]} />
  </>;
}
