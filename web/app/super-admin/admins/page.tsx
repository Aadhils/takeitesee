import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export default async function AdminsPage() {
  const session = await productionAuthProvider.requireAdmin();
  if (!session.roles.includes('super_admin')) throw new Error('Super Admin access required.');

  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipError } = await supabase
    .from('admin_memberships')
    .select('id, user_id, active, created_at')
    .order('created_at');
  if (membershipError) throw new Error(membershipError.message);

  const membershipIds = (memberships ?? []).map((item) => item.id);
  const userIds = (memberships ?? []).map((item) => item.user_id);

  const [{ data: users, error: userError }, { data: scopes, error: scopeError }] = await Promise.all([
    userIds.length ? supabase.from('users').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    membershipIds.length ? supabase.from('admin_scopes').select('id, admin_membership_id, scope_type, application_id, location_id, category_id, service_id, can_view, can_manage').in('admin_membership_id', membershipIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (userError || scopeError) throw new Error(userError?.message || scopeError?.message);

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const scopesByMembership = new Map<string, typeof scopes>();
  for (const scope of scopes ?? []) {
    const current = scopesByMembership.get(scope.admin_membership_id) ?? [];
    current.push(scope);
    scopesByMembership.set(scope.admin_membership_id, current);
  }

  return (
    <main className="container section-stack">
      <section className="admin-page-heading">
        <div>
          <span className="eyebrow">Access control</span>
          <h1>Admins & permissions</h1>
          <p>Review active administrators and the exact scopes granted to each account.</p>
        </div>
        <div className="admin-heading-action"><Link className="button button-secondary" href="/admin">Open Admin dashboard</Link></div>
      </section>

      <section className="card">
        <div className="admin-section-heading"><div><span className="eyebrow">Delegation</span><h2>Add administrator</h2></div></div>
        <p>Assignment controls are being connected in this phase. The current screen is read-only so existing production permissions cannot be changed accidentally.</p>
        <button className="button button-primary" type="button" disabled>Add admin</button>
      </section>

      <section className="section-stack">
        <div className="admin-section-heading"><div><span className="eyebrow">Platform access</span><h2>Current administrators</h2></div><span>{(memberships ?? []).length} membership(s)</span></div>
        {(memberships ?? []).length ? (memberships ?? []).map((membership) => {
          const user = usersById.get(membership.user_id);
          const memberScopes = scopesByMembership.get(membership.id) ?? [];
          return (
            <article className="card" key={membership.id}>
              <div className="admin-record-top">
                <div><span className="eyebrow">{membership.active ? 'Active administrator' : 'Inactive administrator'}</span><h2>{user?.name || 'Admin user'}</h2><p>{user?.email || membership.user_id}</p></div>
                <span className={`badge ${membership.active ? 'badge-success' : 'badge-neutral'}`}>{membership.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="admin-tag-list">
                {memberScopes.length ? memberScopes.map((scope) => (
                  <span className="badge badge-neutral" key={scope.id}>
                    {scope.scope_type} · {scope.can_view ? 'view' : 'no view'} · {scope.can_manage ? 'manage' : 'read only'}
                  </span>
                )) : <span className="muted">No scopes assigned</span>}
              </div>
            </article>
          );
        }) : <div className="card"><p>No admin memberships found.</p></div>}
      </section>
    </main>
  );
}
