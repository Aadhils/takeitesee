import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import { productionAuthProvider } from '../../server/auth/session';
import './super-admin.css';

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  let session;

  try {
    session = await productionAuthProvider.requireAdmin();
  } catch {
    redirect('/account');
  }

  if (!session.roles.includes('super_admin')) {
    redirect('/admin');
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
