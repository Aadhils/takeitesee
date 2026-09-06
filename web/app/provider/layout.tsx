import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { productionAuthProvider } from '../../server/auth/session';

const PROVIDER_RETURN_TO_HEADER = 'x-takeitesee-provider-return-to';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function providerReturnTo(value: string | null) {
  if (!value) return '/provider';
  try {
    const base = new URL('https://takeitesee.local');
    const target = new URL(value, base);
    const providerPath = target.pathname === '/provider' || target.pathname.startsWith('/provider/');
    if (target.origin !== base.origin || !providerPath) return '/provider';
    return `${target.pathname}${target.search}`;
  } catch {
    return '/provider';
  }
}

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const session = await productionAuthProvider.getSession();

  if (!session) {
    const requestHeaders = await headers();
    const returnTo = providerReturnTo(requestHeaders.get(PROVIDER_RETURN_TO_HEADER));
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const isProvider = session.roles.includes('professional') || session.roles.includes('business_owner');
  if (!isProvider) {
    redirect('/account');
  }

  return children;
}
