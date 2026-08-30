import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Service Categories',
  description: 'Explore service categories available on TakeItEsee and discover active local marketplace listings.',
  alternates: { canonical: '/categories' },
  openGraph: {
    title: 'Service Categories | TakeItEsee',
    description: 'Explore service categories available on TakeItEsee and discover active local marketplace listings.',
    url: '/categories',
  },
};

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
