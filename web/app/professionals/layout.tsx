import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const description = 'Discover verified professionals with active services on the TakeItEsee marketplace.';

export const metadata: Metadata = {
  title: 'Verified Professionals',
  description,
  alternates: { canonical: '/professionals' },
  openGraph: {
    title: 'Verified Professionals | TakeItEsee',
    description,
    url: '/professionals',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verified Professionals | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function ProfessionalsLayout({ children }: { children: ReactNode }) {
  return children;
}
