import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { productionAuthProvider } from '../../server/auth/session';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const session = await productionAuthProvider.getSession();

  if (!session) {
    redirect('/login?returnTo=/provider');
  }

  const isProvider = session.roles.includes('professional') || session.roles.includes('business_owner');
  if (!isProvider) {
    redirect('/account');
  }

  return children;
}
