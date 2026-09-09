import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Booking confirmation',
  description: 'View your private TakeItEsee booking confirmation details.',
  robots: { index: false, follow: false },
};

export default function ConfirmationLayout({ children }: { children: ReactNode }) {
  return children;
}
