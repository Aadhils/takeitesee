import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { absolute: 'Products from Verified Businesses | TakeItEsee' },
  description: 'Discover platform-reviewed products from verified TakeItEsee Businesses, check stock and Shop status, and request an order without online payment.',
  alternates: { canonical: 'https://www.takeitesee.com/products' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Products from Verified Businesses | TakeItEsee',
    description: 'Discover platform-reviewed products from verified TakeItEsee Businesses, check stock and Shop status, and request an order.',
    url: 'https://www.takeitesee.com/products',
    type: 'website',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Products from Verified Businesses | TakeItEsee',
    description: 'Discover platform-reviewed products from verified TakeItEsee Businesses and request an order.',
    images: ['/brand/social'],
  },
};

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return children;
}
