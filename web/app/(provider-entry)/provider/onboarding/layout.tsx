import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Provider onboarding',
  description: 'Apply to join TakeItEsee as a professional or business service provider.',
  robots: { index: false, follow: false },
};

export default function ProviderOnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
