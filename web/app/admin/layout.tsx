import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { productionAuthProvider } from '../../server/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await productionAuthProvider.requireAdmin();
  } catch {
    redirect('/account');
  }

  return children;
}
