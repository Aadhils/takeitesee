import AdminLiveSettings from '../../../components/admin/AdminLiveSettings';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

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

  const scopes = mappings.map((scope) => {
    const stored = settingsByScope.get(keyFor(scope));
    const current = stored ?? defaults;
    return {
      key: keyFor(scope),
      serviceId: scope.service_id,
      applicationId: scope.application_id,
      locationId: scope.location_id,
      categoryId: scope.category_id,
      serviceName: services.get(scope.service_id) ?? null,
      applicationName: applications.get(scope.application_id) ?? null,
      locationName: scope.location_id ? locations.get(scope.location_id) ?? null : null,
      categoryName: scope.category_id ? categories.get(scope.category_id) ?? null : null,
      canManage: scopeCanManage(scope, adminScopes, isSuperAdmin),
      stored: Boolean(stored),
      updatedAt: stored?.updated_at ?? null,
      settings: {
        showNewServicesAfterReview: current.show_new_services_after_review,
        displayVerificationBadges: current.display_verification_badges,
        defaultReviewQueue: current.default_review_queue,
        requireProviderResponse: current.require_provider_response,
        flagLowRatings: current.flag_low_ratings,
        lowRatingThreshold: current.low_rating_threshold,
      },
    };
  });

  return (
    <AdminLiveSettings
      saved={params.saved === '1'}
      error={params.error ?? null}
      scopes={scopes}
      audits={audits.map((audit) => ({ id: audit.id, createdAt: audit.created_at }))}
    />
  );
}
