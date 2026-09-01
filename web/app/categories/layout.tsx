import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const description = 'Explore service categories available on TakeItEsee and discover active local marketplace listings.';

export const metadata: Metadata = {
  title: 'Service Categories',
  description,
  alternates: { canonical: '/categories' },
  openGraph: {
    title: 'Service Categories | TakeItEsee',
    description,
    url: '/categories',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Service Categories | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
