import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { productionAuthProvider } from '../../server/auth/session';

const SUPER_ADMIN_RETURN_TO_HEADER = 'x-takeitesee-super-admin-return-to';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function superAdminReturnTo(value: string | null) {
  if (!value) return '/super-admin';
  try {
    const base = new URL('https://takeitesee.local');
    const target = new URL(value, base);
    const superAdminPath = target.pathname === '/super-admin' || target.pathname.startsWith('/super-admin/');
    if (target.origin !== base.origin || !superAdminPath) return '/super-admin';
    return `${target.pathname}${target.search}`;
  } catch {
    return '/super-admin';
  }
}

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const session = await productionAuthProvider.getSession();

  if (!session) {
    const requestHeaders = await headers();
    const returnTo = superAdminReturnTo(requestHeaders.get(SUPER_ADMIN_RETURN_TO_HEADER));
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (!session.roles.includes('super_admin')) redirect('/admin');

  return children;
}
