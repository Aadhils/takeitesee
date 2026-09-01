import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Explore Services',
  description: 'Browse active TakeItEsee marketplace services from verified professionals and local service businesses.',
  alternates: { canonical: '/explore' },
  openGraph: {
    title: 'Explore Services | TakeItEsee',
    description: 'Browse active TakeItEsee marketplace services from verified professionals and local service businesses.',
    url: '/explore',
  },
  twitter: {
    card: 'summary',
    title: 'Explore Services | TakeItEsee',
    description: 'Browse active TakeItEsee marketplace services from verified professionals and local service businesses.',
  },
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
