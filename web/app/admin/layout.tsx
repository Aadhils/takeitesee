import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminAccessProvider, type AdminAccessSummary } from '../../components/admin/AdminAccessContext';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { productionAuthProvider } from '../../server/auth/session';
import './admin-live.css';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let session;
  try {
    session = await productionAuthProvider.requireAdmin();
  } catch {
    redirect('/account');
  }

  const access: AdminAccessSummary = {
    isSuperAdmin: session.roles.includes('super_admin'),
    scopeTypes: [],
    scopeCount: 0,
    canManage: false,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
      .from('admin_memberships')
      .select('id')
      .eq('user_id', session.user_id)
      .eq('active', true)
      .maybeSingle();

    if (membership) {
      const { data: scopes } = await supabase
        .from('admin_scopes')
        .select('scope_type, can_view, can_manage')
        .eq('admin_membership_id', membership.id);

      const visibleScopes = (scopes ?? []).filter((scope) => scope.can_view || scope.can_manage);
      access.scopeTypes = Array.from(new Set(visibleScopes.map((scope) => String(scope.scope_type))));
      access.scopeCount = visibleScopes.length;
      access.canManage = visibleScopes.some((scope) => scope.can_manage);
    }
  } catch {
    // The route has already passed the authoritative admin guard. Keep rendering with
    // the role-level summary if the non-critical scope summary cannot be loaded.
  }

  const mode = access.isSuperAdmin ? 'super' : 'delegated';
  const scopeTypes = access.scopeTypes.length ? access.scopeTypes.join(' + ') : 'assigned';

  return (
    <AdminAccessProvider value={access}>
      <div
        className="admin-live-access-enabled"
        data-admin-mode={mode}
        data-admin-scope-types={scopeTypes}
        data-admin-scope-count={String(access.scopeCount)}
        data-admin-can-manage={access.canManage ? 'true' : 'false'}
      >
        <Link href="/admin/moderation" className="admin-live-moderation-shortcut">
          Moderation queue
        </Link>
        {children}
      </div>
    </AdminAccessProvider>
  );
}
