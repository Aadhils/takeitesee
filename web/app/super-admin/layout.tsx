import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { productionAuthProvider } from '../../server/auth/session';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const session = await productionAuthProvider.requireAdmin().catch(() => null);

  if (!session) redirect('/account');
  if (!session.roles.includes('super_admin')) redirect('/admin');

  return children;
}
