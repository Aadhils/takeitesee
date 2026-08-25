import Link from 'next/link';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { assignAdministrator } from './actions';

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

  const [
    { data: users, error: userError },
    { data: scopes, error: scopeError },
    { data: applications, error: applicationError },
    { data: locations, error: locationError },
    { data: categories, error: categoryError },
    { data: services, error: serviceError },
  ] = await Promise.all([
    userIds.length ? supabase.from('users').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    membershipIds.length ? supabase.from('admin_scopes').select('id, admin_membership_id, scope_type, application_id, location_id, category_id, service_id, can_view, can_manage').in('admin_membership_id', membershipIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('platform_applications').select('id, name, code').order('name'),
    supabase.from('platform_locations').select('id, name, location_type').order('name'),
    supabase.from('platform_categories').select('id, name, code').order('name'),
    supabase.from('services').select('id, name').order('name').limit(200),
  ]);
  const readError = userError || scopeError || applicationError || locationError || categoryError || serviceError;
  if (readError) throw new Error(readError.message);

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const scopesByMembership = new Map<string, typeof scopes>();
  for (const scope of scopes ?? []) {
    const current = scopesByMembership.get(scope.admin_membership_id) ?? [];
    current.push(scope);
    scopesByMembership.set(scope.admin_membership_id, current);
  }

  const applicationNames = new Map((applications ?? []).map((item) => [item.id, item.name]));
  const locationNames = new Map((locations ?? []).map((item) => [item.id, item.name]));
  const categoryNames = new Map((categories ?? []).map((item) => [item.id, item.name]));
  const serviceNames = new Map((services ?? []).map((item) => [item.id, item.name]));

  function describeScope(scope: NonNullable<typeof scopes>[number]) {
    if (scope.scope_type === 'platform') return 'Entire platform';
    if (scope.scope_type === 'application') return applicationNames.get(scope.application_id) || 'Application';
    if (scope.scope_type === 'location') return locationNames.get(scope.location_id) || 'Location';
    if (scope.scope_type === 'category') return categoryNames.get(scope.category_id) || 'Category';
    if (scope.scope_type === 'service') return serviceNames.get(scope.service_id) || 'Service';
    return 'Scoped access';
  }

  return (
    <main className="container section-stack">
      <section className="admin-page-heading">
        <div>
          <span className="eyebrow">Access control</span>
          <h1>Admins & permissions</h1>
          <p>Grant operational access to an existing Takeitesee account without changing customer or provider ownership.</p>
        </div>
        <div className="admin-heading-action"><Link className="button button-secondary" href="/admin">Open Admin dashboard</Link></div>
      </section>

      <section className="card section-stack">
        <div className="admin-section-heading">
          <div><span className="eyebrow">Delegation</span><h2>Add or update administrator</h2></div>
          <span className="badge badge-neutral">Super Admin only</span>
        </div>
        <p>Use an email that already has a Takeitesee account. Assign one exact resource scope at a time; repeating the same scope updates its permissions instead of creating a duplicate.</p>

        <form action={assignAdministrator} className="admin-form-grid">
          <label>
            <span>Account email</span>
            <input name="email" type="email" placeholder="admin@example.com" required />
          </label>
          <label>
            <span>Scope type</span>
            <select name="scope_type" required defaultValue="application">
              <option value="application">Application</option>
              <option value="location">Location / market</option>
              <option value="category">Category</option>
              <option value="service">Service</option>
            </select>
          </label>
          <label className="admin-form-span-2">
            <span>Resource</span>
            <select name="target_id" required defaultValue="">
              <option value="" disabled>Select the matching resource</option>
              {(applications ?? []).length ? <optgroup label="Applications">{(applications ?? []).map((item) => <option key={`app-${item.id}`} value={item.id}>{item.name} ({item.code})</option>)}</optgroup> : null}
              {(locations ?? []).length ? <optgroup label="Locations & markets">{(locations ?? []).map((item) => <option key={`loc-${item.id}`} value={item.id}>{item.name} · {item.location_type}</option>)}</optgroup> : null}
              {(categories ?? []).length ? <optgroup label="Categories">{(categories ?? []).map((item) => <option key={`cat-${item.id}`} value={item.id}>{item.name} ({item.code})</option>)}</optgroup> : null}
              {(services ?? []).length ? <optgroup label="Services">{(services ?? []).map((item) => <option key={`svc-${item.id}`} value={item.id}>{item.name}</option>)}</optgroup> : null}
            </select>
          </label>
          <label className="admin-check-row">
            <input name="can_view" type="checkbox" defaultChecked />
            <span><strong>View</strong><small>Can see records inside this scope.</small></span>
          </label>
          <label className="admin-check-row">
            <input name="can_manage" type="checkbox" />
            <span><strong>Manage</strong><small>Can perform approved operational changes inside this scope.</small></span>
          </label>
          <div className="admin-form-span-2">
            <button className="button button-primary" type="submit">Assign administrator</button>
          </div>
        </form>
        {!((applications ?? []).length || (locations ?? []).length || (categories ?? []).length || (services ?? []).length) ? (
          <p className="muted">Create at least one application, location, category, or live service before assigning a delegated scope.</p>
        ) : null}
      </section>

      <section className="section-stack">
        <div className="admin-section-heading"><div><span className="eyebrow">Platform access</span><h2>Current administrators</h2></div><span>{(memberships ?? []).length} membership(s)</span></div>
        {(memberships ?? []).length ? (memberships ?? []).map((membership) => {
          const user = usersById.get(membership.user_id);
          const memberScopes = scopesByMembership.get(membership.id) ?? [];
          return (
            <article className="card section-stack" key={membership.id}>
              <div className="admin-record-top">
                <div><span className="eyebrow">{membership.active ? 'Active administrator' : 'Inactive administrator'}</span><h2>{user?.name || 'Admin user'}</h2><p>{user?.email || membership.user_id}</p></div>
                <span className={`badge ${membership.active ? 'badge-success' : 'badge-neutral'}`}>{membership.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="admin-tag-list">
                {memberScopes.length ? memberScopes.map((scope) => (
                  <span className="badge badge-neutral" key={scope.id} title={describeScope(scope)}>
                    {scope.scope_type}: {describeScope(scope)} · {scope.can_view ? 'view' : 'no view'} · {scope.can_manage ? 'manage' : 'read only'}
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
