import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const description = 'Find verified local service businesses and active marketplace listings on TakeItEsee.';

export const metadata: Metadata = {
  title: 'Local Service Businesses',
  description,
  alternates: { canonical: '/businesses' },
  openGraph: {
    title: 'Local Service Businesses | TakeItEsee',
    description,
    url: '/businesses',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Service Businesses | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function BusinessesLayout({ children }: { children: ReactNode }) {
  return children;
}
