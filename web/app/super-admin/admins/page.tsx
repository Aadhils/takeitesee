import Link from 'next/link';
import { Alert, Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { grantExistingAdminAccess, setDelegatedAdminMembershipActive, updateDelegatedAdminScope } from './actions';

export const dynamic = 'force-dynamic';

type MembershipRow = {
  id: string;
  user_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type UserRow = { id: string; name: string | null; email: string | null };
type NamedRow = { id: string; name: string };
type ScopeRow = {
  id: string;
  admin_membership_id: string;
  scope_type: string;
  application_id: string | null;
  location_id: string | null;
  category_id: string | null;
  service_id: string | null;
  can_view: boolean;
  can_manage: boolean;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export default async function SuperAdminAdminsPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: membershipsData, error: membershipsError }, { data: allApplicationsData, error: allApplicationsError }] = await Promise.all([
    supabase
      .from('admin_memberships')
      .select('id,user_id,active,created_at,updated_at')
      .order('created_at', { ascending: true }),
    supabase.from('platform_applications').select('id,name').order('name', { ascending: true }),
  ]);
  if (membershipsError) throw new Error(membershipsError.message);
  if (allApplicationsError) throw new Error(allApplicationsError.message);

  const memberships = (membershipsData ?? []) as MembershipRow[];
  const grantApplications = (allApplicationsData ?? []) as NamedRow[];
  const membershipIds = memberships.map((row) => row.id);
  const userIds = memberships.map((row) => row.user_id);

  const [usersResult, scopesResult] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id,name,email').in('id', userIds)
      : Promise.resolve({ data: [] as UserRow[], error: null }),
    membershipIds.length
      ? supabase.from('admin_scopes').select('id,admin_membership_id,scope_type,application_id,location_id,category_id,service_id,can_view,can_manage').in('admin_membership_id', membershipIds)
      : Promise.resolve({ data: [] as ScopeRow[], error: null }),
  ]);

  if (usersResult.error) throw new Error(usersResult.error.message);
  if (scopesResult.error) throw new Error(scopesResult.error.message);

  const scopes = (scopesResult.data ?? []) as ScopeRow[];
  const locationIds = Array.from(new Set(scopes.map((row) => row.location_id).filter((id): id is string => Boolean(id))));
  const categoryIds = Array.from(new Set(scopes.map((row) => row.category_id).filter((id): id is string => Boolean(id))));
  const serviceIds = Array.from(new Set(scopes.map((row) => row.service_id).filter((id): id is string => Boolean(id))));

  const [locationsResult, categoriesResult, servicesResult] = await Promise.all([
    locationIds.length ? supabase.from('platform_locations').select('id,name').in('id', locationIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    categoryIds.length ? supabase.from('platform_categories').select('id,name').in('id', categoryIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    serviceIds.length ? supabase.from('services').select('id,name').in('id', serviceIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ]);

  for (const result of [locationsResult, categoriesResult, servicesResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const users = new Map(((usersResult.data ?? []) as UserRow[]).map((row) => [row.id, row]));
  const applications = new Map(grantApplications.map((row) => [row.id, row.name]));
  const locations = new Map(((locationsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const categories = new Map(((categoriesResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const services = new Map(((servicesResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));

  function scopeLabel(scope: ScopeRow) {
    if (scope.scope_type === 'platform') return 'Entire platform';
    if (scope.scope_type === 'application') return applications.get(scope.application_id ?? '') ?? 'Assigned application';
    if (scope.scope_type === 'location') return locations.get(scope.location_id ?? '') ?? 'Assigned location';
    if (scope.scope_type === 'category') return categories.get(scope.category_id ?? '') ?? 'Assigned category';
    if (scope.scope_type === 'service') return services.get(scope.service_id ?? '') ?? 'Assigned service';
    return 'Assigned scope';
  }

  const activeCount = memberships.filter((membership) => membership.active).length;
  const revokedCount = memberships.length - activeCount;
  const protectedIds = new Set(
    memberships
      .filter((membership) => scopes.some((scope) => scope.admin_membership_id === membership.id && scope.scope_type === 'platform' && scope.can_manage))
      .map((membership) => membership.id),
  );
  const delegatedCount = memberships.length - protectedIds.size;

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">People & permissions</span>
        <h1>Admin management</h1>
        <p>See who has Admin access, their current status and assigned scope at a glance. Open an administrator only when you need to change access or permissions.</p>
        <p><Link href="/super-admin">← Super Admin</Link> · <Link href="/super-admin/audit">Audit log →</Link></p>
      </section>

      {params.updated ? <Alert tone="success" title={params.updated === 'granted' ? 'Admin access granted' : 'Admin permissions updated'}>{params.updated === 'granted' ? 'The existing TakeItEsee account now has the selected Admin application scope.' : 'The change is live and has been written to the Super Admin audit log.'}</Alert> : null}
      {params.error === 'protected' ? <Alert tone="danger" title="Protected authority">Super Admin or self-access cannot be changed from this delegated control screen.</Alert> : null}
      {params.error === 'account_or_application_not_found' ? <Alert tone="danger" title="Account or application not found">Use the email of an existing TakeItEsee account and select an available application.</Alert> : null}
      {params.error === 'grant_input' ? <Alert tone="danger" title="Admin details required">Enter the account email and choose an application before granting access.</Alert> : null}
      {params.error && !['protected', 'account_or_application_not_found', 'grant_input'].includes(params.error) ? <Alert tone="danger" title="Permission change failed">The requested Admin permission change could not be saved.</Alert> : null}

      <Card>
        <div className="admin-record-top">
          <div>
            <span className="eyebrow">Grant delegated access</span>
            <h2>Add existing Admin</h2>
            <p>Grant application-scoped Admin access to someone who already has a TakeItEsee account. This does not create or invite a new account.</p>
          </div>
          <Badge tone="info">Super Admin only</Badge>
        </div>
        <form action={grantExistingAdminAccess} className="admin-settings-grid">
          <label className="field">
            <span className="field-label">Account email</span>
            <input className="field-control" type="email" name="email" autoComplete="email" required placeholder="admin@example.com" />
            <span className="field-hint">The email must already belong to a TakeItEsee account.</span>
          </label>
          <label className="field">
            <span className="field-label">Application scope</span>
            <select className="field-control" name="application_id" required defaultValue="">
              <option value="" disabled>Select application</option>
              {grantApplications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
            </select>
            <span className="field-hint">Access is limited to this application; platform-wide Super Admin authority is never granted here.</span>
          </label>
          <label className="field">
            <span className="field-label">Permission</span>
            <select className="field-control" name="permission" defaultValue="view">
              <option value="view">View only</option>
              <option value="manage">View + Manage</option>
            </select>
            <span className="field-hint">You can change the saved permission later from the Admin record.</span>
          </label>
          <div className="admin-settings-save-row">
            <div><strong>Existing-account grant</strong><span>No invitation email or new authentication user is created.</span></div>
            <button className="button button-primary" type="submit" disabled={grantApplications.length === 0}>Grant Admin access</button>
          </div>
        </form>
      </Card>

      <section className="dashboard-grid" aria-label="Admin access summary">
        <article className="card"><span className="eyebrow">Active Admins</span><h2>{activeCount}</h2></article>
        <article className="card"><span className="eyebrow">Delegated Admins</span><h2>{delegatedCount}</h2></article>
        <article className="card"><span className="eyebrow">Revoked</span><h2>{revokedCount}</h2></article>
        <article className="card"><span className="eyebrow">Assigned scopes</span><h2>{scopes.filter((scope) => scope.can_view || scope.can_manage).length}</h2></article>
      </section>

      <section className="section-stack" aria-label="Administrator memberships">
        {memberships.map((membership) => {
          const user = users.get(membership.user_id);
          const memberScopes = scopes.filter((scope) => scope.admin_membership_id === membership.id);
          const protectedPlatformAdmin = protectedIds.has(membership.id);
          const manageCount = memberScopes.filter((scope) => scope.can_manage).length;
          const viewCount = memberScopes.filter((scope) => scope.can_view && !scope.can_manage).length;

          return (
            <Card key={membership.id}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">{protectedPlatformAdmin ? 'Platform authority' : 'Delegated administrator'}</span>
                  <h2>{user?.name || user?.email || 'Administrator'}</h2>
                  <p>{user?.email || membership.user_id}</p>
                  <p className="muted">Added {formatTime(membership.created_at)}</p>
                </div>
                <div className="section-stack">
                  <Badge tone={membership.active ? 'success' : 'neutral'}>{membership.active ? 'Active' : 'Revoked'}</Badge>
                  <Badge tone={protectedPlatformAdmin ? 'info' : manageCount > 0 ? 'success' : 'neutral'}>
                    {protectedPlatformAdmin ? 'Protected' : manageCount > 0 ? `${manageCount} manage` : viewCount > 0 ? `${viewCount} view only` : 'No active scope'}
                  </Badge>
                </div>
              </div>

              <div className="detail-list">
                <div><strong>{memberScopes.length}</strong><span> scope(s)</span></div>
                <div><strong>{manageCount}</strong><span> manage permission(s)</span></div>
                <div><strong>{viewCount}</strong><span> view-only permission(s)</span></div>
              </div>

              {protectedPlatformAdmin ? (
                <p className="admin-fixture-note">Platform-wide manage authority is protected to prevent accidental Super Admin lockout.</p>
              ) : (
                <details>
                  <summary className="button button-secondary">Manage access & permissions</summary>
                  <div className="section-stack">
                    <form action={setDelegatedAdminMembershipActive} className="admin-settings-save-row">
                      <input type="hidden" name="membership_id" value={membership.id} />
                      <input type="hidden" name="active" value={membership.active ? 'false' : 'true'} />
                      <div>
                        <strong>{membership.active ? 'Admin workspace access is enabled' : 'Admin workspace access is revoked'}</strong>
                        <span>{membership.active ? 'Revoke access without deleting the stored scope configuration.' : 'Reactivate the Admin with the currently saved scope configuration.'}</span>
                      </div>
                      <button className={membership.active ? 'button' : 'button button-primary'} type="submit">
                        {membership.active ? 'Revoke Admin access' : 'Reactivate Admin'}
                      </button>
                    </form>

                    {memberScopes.map((scope) => (
                      <section className="card" key={scope.id}>
                        <div className="admin-record-top">
                          <div>
                            <span className="eyebrow">{scope.scope_type} scope</span>
                            <h3>{scopeLabel(scope)}</h3>
                            <p>
                              {scope.application_id ? applications.get(scope.application_id) ?? 'Application' : 'All applications'}
                              {scope.location_id ? ` · ${locations.get(scope.location_id) ?? 'Location'}` : ''}
                            </p>
                          </div>
                          <Badge tone={scope.can_manage ? 'success' : scope.can_view ? 'info' : 'neutral'}>
                            {scope.can_manage ? 'View + Manage' : scope.can_view ? 'View only' : 'No access'}
                          </Badge>
                        </div>

                        <form action={updateDelegatedAdminScope} className="admin-settings-save-row">
                          <input type="hidden" name="scope_id" value={scope.id} />
                          <div className="admin-settings-grid">
                            <label className="choice-row">
                              <input className="choice-input" type="checkbox" name="can_view" defaultChecked={scope.can_view} disabled={!membership.active} />
                              <span><strong>View</strong><span className="choice-description">See records inside this assigned scope.</span></span>
                            </label>
                            <label className="choice-row">
                              <input className="choice-input" type="checkbox" name="can_manage" defaultChecked={scope.can_manage} disabled={!membership.active} />
                              <span><strong>Manage</strong><span className="choice-description">Perform protected operational changes inside this scope.</span></span>
                            </label>
                          </div>
                          <button className="button button-primary" type="submit" disabled={!membership.active}>Save permissions</button>
                        </form>
                      </section>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          );
        })}
      </section>
    </main>
  );
}
