import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Review booking',
  description: 'Review private TakeItEsee service booking details before confirmation.',
  robots: { index: false, follow: false },
};

export default function ServiceReviewLayout({ children }: { children: ReactNode }) {
  return children;
}
