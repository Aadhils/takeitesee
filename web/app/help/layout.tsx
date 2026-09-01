import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const description = 'Get help using TakeItEsee marketplace discovery, bookings, provider services, and account features.';

export const metadata: Metadata = {
  title: 'Help & Support',
  description,
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Help & Support | TakeItEsee',
    description,
    url: '/help',
    images: ['/brand/social'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Help & Support | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return children;
}
