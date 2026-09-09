import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'Manage your private TakeItEsee booking review activity.',
  robots: { index: false, follow: false },
};

export default function ReviewsLayout({ children }: { children: ReactNode }) {
  return children;
}
