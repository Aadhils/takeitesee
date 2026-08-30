import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Help & Support',
  description: 'Get help using TakeItEsee marketplace discovery, bookings, provider services, and account features.',
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Help & Support | TakeItEsee',
    description: 'Get help using TakeItEsee marketplace discovery, bookings, provider services, and account features.',
    url: '/help',
  },
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return children;
}
