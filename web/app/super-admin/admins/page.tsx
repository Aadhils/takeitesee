import Link from 'next/link';
import { Alert, Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { setDelegatedAdminMembershipActive, updateDelegatedAdminScope } from './actions';

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

  const { data: membershipsData, error: membershipsError } = await supabase
    .from('admin_memberships')
    .select('id,user_id,active,created_at,updated_at')
    .order('created_at', { ascending: true });
  if (membershipsError) throw new Error(membershipsError.message);

  const memberships = (membershipsData ?? []) as MembershipRow[];
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
  const applicationIds = Array.from(new Set(scopes.map((row) => row.application_id).filter((id): id is string => Boolean(id))));
  const locationIds = Array.from(new Set(scopes.map((row) => row.location_id).filter((id): id is string => Boolean(id))));
  const categoryIds = Array.from(new Set(scopes.map((row) => row.category_id).filter((id): id is string => Boolean(id))));
  const serviceIds = Array.from(new Set(scopes.map((row) => row.service_id).filter((id): id is string => Boolean(id))));

  const [applicationsResult, locationsResult, categoriesResult, servicesResult] = await Promise.all([
    applicationIds.length ? supabase.from('platform_applications').select('id,name').in('id', applicationIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    locationIds.length ? supabase.from('platform_locations').select('id,name').in('id', locationIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    categoryIds.length ? supabase.from('platform_categories').select('id,name').in('id', categoryIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    serviceIds.length ? supabase.from('services').select('id,name').in('id', serviceIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ]);

  for (const result of [applicationsResult, locationsResult, categoriesResult, servicesResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const users = new Map(((usersResult.data ?? []) as UserRow[]).map((row) => [row.id, row]));
  const applications = new Map(((applicationsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
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

  return (
    <main className="container section-stack">
      <section className="page-intro">
        <span className="eyebrow">Access governance</span>
        <h1>Delegated Admin controls</h1>
        <p>Change view/manage permissions or revoke delegated Admin access. Changes are enforced from Supabase on the administrator&apos;s next request and written to the audit log.</p>
        <p><Link href="/super-admin">← Super Admin</Link> · <Link href="/super-admin/audit">Audit log →</Link></p>
      </section>

      {params.updated ? <Alert tone="success" title="Admin permissions updated">The change is live and has been written to the Super Admin audit log.</Alert> : null}
      {params.error === 'protected' ? <Alert tone="danger" title="Protected authority">Super Admin or self-access cannot be changed from this delegated control screen.</Alert> : null}
      {params.error && params.error !== 'protected' ? <Alert tone="danger" title="Permission change failed">The requested Admin permission change could not be saved.</Alert> : null}

      <section className="card">
        <div className="detail-list">
          <div><strong>{memberships.length}</strong><span> admin membership(s)</span></div>
          <div><strong>Immediate enforcement</strong><span> · server-side session checks</span></div>
          <div><strong>Audited</strong><span> · every protected change</span></div>
        </div>
      </section>

      <section className="section-stack" aria-label="Administrator memberships">
        {memberships.map((membership) => {
          const user = users.get(membership.user_id);
          const memberScopes = scopes.filter((scope) => scope.admin_membership_id === membership.id);
          const protectedPlatformAdmin = memberScopes.some((scope) => scope.scope_type === 'platform' && scope.can_manage);

          return (
            <Card key={membership.id}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">{protectedPlatformAdmin ? 'Protected Super Admin' : 'Delegated administrator'}</span>
                  <h2>{user?.name || user?.email || 'Administrator'}</h2>
                  <p>{user?.email || membership.user_id}</p>
                  <p className="muted">Membership created {formatTime(membership.created_at)}</p>
                </div>
                <Badge tone={membership.active ? 'success' : 'neutral'}>{membership.active ? 'Active' : 'Revoked'}</Badge>
              </div>

              {!protectedPlatformAdmin ? (
                <form action={setDelegatedAdminMembershipActive} className="admin-settings-save-row">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <input type="hidden" name="active" value={membership.active ? 'false' : 'true'} />
                  <div>
                    <strong>{membership.active ? 'Admin workspace access enabled' : 'Admin workspace access revoked'}</strong>
                    <span>{membership.active ? 'Revoking removes Admin entry on the next authenticated request.' : 'Reactivation restores only scopes that still have View or Manage enabled.'}</span>
                  </div>
                  <button className={membership.active ? 'button' : 'button button-primary'} type="submit">
                    {membership.active ? 'Revoke admin access' : 'Reactivate admin access'}
                  </button>
                </form>
              ) : (
                <p className="admin-fixture-note">Platform-wide manage authority is protected here to prevent accidental Super Admin lockout.</p>
              )}

              <div className="section-stack">
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

                    {protectedPlatformAdmin ? null : (
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
                    )}
                  </section>
                ))}
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
