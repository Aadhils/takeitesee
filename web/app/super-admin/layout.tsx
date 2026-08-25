import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { productionAuthProvider } from '../../server/auth/session';

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  try {
    const session = await productionAuthProvider.requireAdmin();
    if (!session.roles.includes('super_admin')) redirect('/admin');
  } catch {
    redirect('/account');
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
