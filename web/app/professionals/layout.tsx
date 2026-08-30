import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Verified Professionals',
  description: 'Discover verified professionals with active services on the TakeItEsee marketplace.',
  alternates: { canonical: '/professionals' },
  openGraph: {
    title: 'Verified Professionals | TakeItEsee',
    description: 'Discover verified professionals with active services on the TakeItEsee marketplace.',
    url: '/professionals',
  },
};

export default function ProfessionalsLayout({ children }: { children: ReactNode }) {
  return children;
}
