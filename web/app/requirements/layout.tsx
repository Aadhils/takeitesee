import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'My Requirements',
  description: 'Create and manage your TakeItEsee service requirements and proposal activity.',
  robots: { index: false, follow: false },
};

export default function RequirementsLayout({ children }: { children: ReactNode }) {
  return children;
}
