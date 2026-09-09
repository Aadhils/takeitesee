import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Book service',
  description: 'Choose private booking details for a TakeItEsee service.',
  robots: { index: false, follow: false },
};

export default function ServiceBookingLayout({ children }: { children: ReactNode }) {
  return children;
}
