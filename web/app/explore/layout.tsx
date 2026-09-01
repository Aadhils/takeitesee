import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const description = 'Browse active TakeItEsee marketplace services from verified professionals and local service businesses.';

export const metadata: Metadata = {
  title: 'Explore Services',
  description,
  alternates: { canonical: '/explore' },
  openGraph: {
    title: 'Explore Services | TakeItEsee',
    description,
    url: '/explore',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Services | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
