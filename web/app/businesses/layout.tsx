import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Local Service Businesses',
  description: 'Find verified local service businesses and active marketplace listings on TakeItEsee.',
  alternates: { canonical: '/businesses' },
  openGraph: {
    title: 'Local Service Businesses | TakeItEsee',
    description: 'Find verified local service businesses and active marketplace listings on TakeItEsee.',
    url: '/businesses',
  },
  twitter: {
    card: 'summary',
    title: 'Local Service Businesses | TakeItEsee',
    description: 'Find verified local service businesses and active marketplace listings on TakeItEsee.',
  },
};

export default function BusinessesLayout({ children }: { children: ReactNode }) {
  return children;
}
