import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Alert, Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { saveScopedServiceSettings } from './actions';

export const dynamic = 'force-dynamic';

type ScopeMapping = {
  service_id: string;
  application_id: string;
  location_id: string | null;
  category_id: string | null;
  enabled: boolean;
};

type AdminScope = {
  scope_type: string;
  application_id: string | null;
  location_id: string | null;
  category_id: string | null;
  service_id: string | null;
  can_manage: boolean;
};

type SettingsRow = {
  id: string;
  service_id: string;
  application_id: string;
  location_id: string | null;
  category_id: string | null;
  show_new_services_after_review: boolean;
  display_verification_badges: boolean;
  default_review_queue: string;
  require_provider_response: boolean;
  flag_low_ratings: boolean;
  low_rating_threshold: number;
  updated_at: string;
};

type NamedRow = { id: string; name: string };
type AuditRow = { id: number; action: string; resource_id: string | null; metadata: unknown; created_at: string };

const defaults = {
  show_new_services_after_review: true,
  display_verification_badges: true,
  default_review_queue: 'provider_review',
  require_provider_response: true,
  flag_low_ratings: true,
  low_rating_threshold: 3,
};

function keyFor(scope: Pick<ScopeMapping, 'service_id' | 'application_id' | 'location_id' | 'category_id'>) {
  return [scope.service_id, scope.application_id, scope.location_id ?? '-', scope.category_id ?? '-'].join(':');
}

function scopeCanManage(scope: ScopeMapping, adminScopes: AdminScope[], isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  return adminScopes.some((candidate) => {
    if (!candidate.can_manage) return false;
    if (candidate.scope_type === 'platform') return true;
    if (candidate.scope_type === 'application') return candidate.application_id === scope.application_id;
    if (candidate.scope_type === 'location') {
      return candidate.location_id === scope.location_id && (!candidate.application_id || candidate.application_id === scope.application_id);
    }
    if (candidate.scope_type === 'category') {
      return candidate.category_id === scope.category_id && (!candidate.application_id || candidate.application_id === scope.application_id);
    }
    if (candidate.scope_type === 'service') {
      return candidate.service_id === scope.service_id && (!candidate.application_id || candidate.application_id === scope.application_id);
    }
    return false;
  });
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export default async function AdminSettingsRoute({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const session = await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from('admin_memberships')
    .select('id')
    .eq('user_id', session.user_id)
    .eq('active', true)
    .maybeSingle();

  let adminScopes: AdminScope[] = [];
  if (membership) {
    const { data, error } = await supabase
      .from('admin_scopes')
      .select('scope_type,application_id,location_id,category_id,service_id,can_manage')
      .eq('admin_membership_id', membership.id);
    if (error) throw new Error(error.message);
    adminScopes = (data ?? []) as AdminScope[];
  }

  const isSuperAdmin = session.roles.includes('super_admin') || adminScopes.some((scope) => scope.scope_type === 'platform' && scope.can_manage);

  const { data: scopeData, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id,application_id,location_id,category_id,enabled')
    .eq('enabled', true);
  if (scopeError) throw new Error(scopeError.message);

  const mappings = (scopeData ?? []) as ScopeMapping[];
  const serviceIds = Array.from(new Set(mappings.map((scope) => scope.service_id)));
  const applicationIds = Array.from(new Set(mappings.map((scope) => scope.application_id)));
  const locationIds = Array.from(new Set(mappings.map((scope) => scope.location_id).filter(Boolean))) as string[];
  const categoryIds = Array.from(new Set(mappings.map((scope) => scope.category_id).filter(Boolean))) as string[];

  const [serviceResult, applicationResult, locationResult, categoryResult, settingsResult, auditResult] = await Promise.all([
    serviceIds.length ? supabase.from('services').select('id,name').in('id', serviceIds) : Promise.resolve({ data: [], error: null }),
    applicationIds.length ? supabase.from('platform_applications').select('id,name').in('id', applicationIds) : Promise.resolve({ data: [], error: null }),
    locationIds.length ? supabase.from('platform_locations').select('id,name').in('id', locationIds) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? supabase.from('platform_categories').select('id,name').in('id', categoryIds) : Promise.resolve({ data: [], error: null }),
    serviceIds.length ? supabase.from('service_operational_settings').select('*').in('service_id', serviceIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('admin_audit_log').select('id,action,resource_id,metadata,created_at').eq('actor_user_id', session.user_id).eq('action', 'settings.update').order('created_at', { ascending: false }).limit(8),
  ]);

  for (const result of [serviceResult, applicationResult, locationResult, categoryResult, settingsResult, auditResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const services = new Map(((serviceResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const applications = new Map(((applicationResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const locations = new Map(((locationResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const categories = new Map(((categoryResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const settingRows = (settingsResult.data ?? []) as SettingsRow[];
  const settingsByScope = new Map(settingRows.map((row) => [keyFor(row), row]));
  const audits = (auditResult.data ?? []) as AuditRow[];

  return (
    <AdminShell active="/admin/settings">
      <AdminHeading
        eyebrow="Scoped operations configuration"
        title="Live admin settings"
        description="Operational preferences are stored in Supabase per active service scope. Saves require manage permission and every successful change is written to the admin audit log."
      />

      {params.saved === '1' ? <Alert tone="success" title="Settings saved">The scoped configuration was persisted and audited.</Alert> : null}
      {params.error === 'manage_required' ? <Alert tone="danger" title="Manage permission required">This scope is view-only for the signed-in administrator.</Alert> : null}
      {params.error && params.error !== 'manage_required' ? <Alert tone="danger" title="Settings were not saved">Please review the values and try again.</Alert> : null}

      {mappings.length ? (
        <div className="admin-live-settings-stack">
          {mappings.map((scope) => {
            const stored = settingsByScope.get(keyFor(scope));
            const current = stored ?? defaults;
            const canManage = scopeCanManage(scope, adminScopes, isSuperAdmin);
            const serviceName = services.get(scope.service_id) ?? 'Scoped service';
            const applicationName = applications.get(scope.application_id) ?? 'Application';
            const locationName = scope.location_id ? locations.get(scope.location_id) ?? 'Assigned location' : 'All locations';
            const categoryName = scope.category_id ? categories.get(scope.category_id) ?? 'Assigned category' : 'All categories';

            return (
              <Card className="admin-live-settings-card" key={keyFor(scope)}>
                <div className="admin-record-top">
                  <div>
                    <span className="eyebrow">{applicationName} · {locationName}</span>
                    <h2>{serviceName}</h2>
                    <p>{categoryName}</p>
                  </div>
                  <Badge tone={canManage ? 'success' : 'neutral'}>{canManage ? 'Manage enabled' : 'View only'}</Badge>
                </div>

                <form action={saveScopedServiceSettings}>
                  <input type="hidden" name="service_id" value={scope.service_id} />
                  <input type="hidden" name="application_id" value={scope.application_id} />
                  <input type="hidden" name="location_id" value={scope.location_id ?? ''} />
                  <input type="hidden" name="category_id" value={scope.category_id ?? ''} />

                  <div className="admin-settings-grid">
                    <section className="admin-settings-panel">
                      <span className="eyebrow">Marketplace</span>
                      <h3>Listing preferences</h3>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="show_new_services_after_review" defaultChecked={current.show_new_services_after_review} disabled={!canManage} />
                        <span><strong>Show new services after review</strong><span className="choice-description">Reviewed services can appear in the marketplace catalog.</span></span>
                      </label>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="display_verification_badges" defaultChecked={current.display_verification_badges} disabled={!canManage} />
                        <span><strong>Display verification badges</strong><span className="choice-description">Show verified-provider trust status on scoped listings.</span></span>
                      </label>
                    </section>

                    <section className="admin-settings-panel">
                      <span className="eyebrow">Booking rules</span>
                      <h3>Customer journey defaults</h3>
                      <div className="field">
                        <label className="field-label" htmlFor={`review-${scope.service_id}`}>Default review queue</label>
                        <select className="field-control" id={`review-${scope.service_id}`} name="default_review_queue" defaultValue={current.default_review_queue} disabled={!canManage}>
                          <option value="provider_review">Provider review</option>
                          <option value="manual_review">Manual review</option>
                        </select>
                      </div>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="require_provider_response" defaultChecked={current.require_provider_response} disabled={!canManage} />
                        <span><strong>Require provider response</strong><span className="choice-description">Keep provider acknowledgement enabled for scoped booking requests.</span></span>
                      </label>
                    </section>

                    <section className="admin-settings-panel">
                      <span className="eyebrow">Trust and reviews</span>
                      <h3>Moderation preferences</h3>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="flag_low_ratings" defaultChecked={current.flag_low_ratings} disabled={!canManage} />
                        <span><strong>Flag low ratings for review</strong><span className="choice-description">Enable the persisted low-rating moderation preference.</span></span>
                      </label>
                      <div className="field">
                        <label className="field-label" htmlFor={`threshold-${scope.service_id}`}>Low rating threshold</label>
                        <select className="field-control" id={`threshold-${scope.service_id}`} name="low_rating_threshold" defaultValue={String(current.low_rating_threshold)} disabled={!canManage}>
                          <option value="1">1 star</option>
                          <option value="2">2 stars</option>
                          <option value="3">3 stars</option>
                          <option value="4">4 stars</option>
                          <option value="5">5 stars</option>
                        </select>
                      </div>
                    </section>
                  </div>

                  <div className="admin-settings-save-row">
                    <div>
                      <strong>{stored ? 'Database configuration active' : 'Using safe defaults'}</strong>
                      <span>{stored ? `Last saved ${formatTimestamp(stored.updated_at)}` : 'The first save creates the scoped settings record.'}</span>
                    </div>
                    <button className="button button-primary" type="submit" disabled={!canManage}>Save settings</button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped services">Assign an enabled service scope before configuring operational settings.</EmptyState>
        </Card>
      )}

      <Card className="admin-settings-audit-card">
        <div className="admin-section-heading">
          <div>
            <span className="eyebrow">Audit trail</span>
            <h2>Recent setting changes</h2>
          </div>
          <Badge tone="info">Supabase persisted</Badge>
        </div>
        {audits.length ? (
          <ol className="admin-settings-audit-list">
            {audits.map((audit) => (
              <li key={audit.id}>
                <div><strong>Settings updated</strong><span>{formatTimestamp(audit.created_at)}</span></div>
                <Badge tone="success">audited</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-fixture-note">No settings changes have been recorded for this administrator yet.</p>
        )}
      </Card>
    </AdminShell>
  );
}
