import type { EntityId } from '../../types/entities';
import type { PlatformRole } from '../../types/ownership';
import type { ServerCustomerSession } from '../../types/production-domain';
import { assertProductionBackendConfigured } from '../config';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { getWorkspacePreference } from './workspace';

export interface ServerAuthProvider {
  getSession(request?: Request): Promise<ServerCustomerSession | null>;
  requireCustomer(request?: Request): Promise<ServerCustomerSession>;
  requireProvider(request?: Request): Promise<ServerCustomerSession>;
  requireAdmin(request?: Request): Promise<ServerCustomerSession>;
}

/** Production boundary backed by Supabase auth plus owned provider/admin records. */
export const productionAuthProvider: ServerAuthProvider = {
  async getSession(_request?: Request) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const roles: PlatformRole[] = [];
    const storedRole = profile?.role;
    if (storedRole === 'admin') roles.push('admin');
    if (storedRole === 'super_admin') roles.push('admin', 'super_admin');
    if (storedRole === 'professional') roles.push('professional');
    if (storedRole === 'business') roles.push('business_owner');

    const { data: adminMembership, error: adminMembershipError } = await supabase
      .from('admin_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (adminMembershipError) throw new Error(adminMembershipError.message);

    if (adminMembership) {
      const { data: adminScopes, error: adminScopesError } = await supabase
        .from('admin_scopes')
        .select('scope_type, can_view, can_manage')
        .eq('admin_membership_id', adminMembership.id);
      if (adminScopesError) throw new Error(adminScopesError.message);

      const hasDelegatedAdminAccess = (adminScopes ?? []).some((scope) => scope.can_view || scope.can_manage);
      const platformManageScope = (adminScopes ?? []).find(
        (scope) => scope.scope_type === 'platform' && scope.can_manage,
      );

      // Any active delegated scope grants entry to the Admin workspace.
      // Only platform-wide manage authority grants Super Admin control-plane access.
      if (hasDelegatedAdminAccess && !roles.includes('admin')) roles.push('admin');
      if (platformManageScope && !roles.includes('super_admin')) roles.push('super_admin');
    }

    if (!roles.includes('professional')) {
      const { data: professional, error: professionalError } = await supabase
        .from('professional_profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (professionalError) throw new Error(professionalError.message);
      if (professional) roles.push('professional');
    }

    if (!roles.includes('business_owner')) {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (businessError) throw new Error(businessError.message);
      if (business) roles.push('business_owner');
    }

    if (!roles.includes('customer')) roles.push('customer');

    return {
      user_id: user.id as EntityId,
      roles,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    };
  },
  async requireCustomer(request?: Request) {
    const session = await this.getSession(request);
    if (!session || !session.roles.includes('customer')) throw new Error('Authentication required.');
    return session;
  },
  async requireProvider(request?: Request) {
    const session = await this.getSession(request);
    if (!session || (!session.roles.includes('professional') && !session.roles.includes('business_owner'))) {
      throw new Error('Provider authentication required.');
    }

    const hasProfessional = session.roles.includes('professional');
    const hasBusiness = session.roles.includes('business_owner');
    if (!hasProfessional || !hasBusiness) return session;

    // This cookie is a workspace preference only, never an authorization claim. getSession()
    // already re-derives all roles from authenticated server-side ownership on every request.
    const preference = await getWorkspacePreference(request);
    const activeProvider = preference === 'professional' ? 'professional' : 'business';
    const roles = session.roles.filter((role) => activeProvider === 'professional' ? role !== 'business_owner' : role !== 'professional');
    return { ...session, roles };
  },
  async requireAdmin(request?: Request) {
    const session = await this.getSession(request);
    if (!session || (!session.roles.includes('admin') && !session.roles.includes('super_admin'))) {
      throw new Error('Admin authentication required.');
    }
    return session;
  },
};

/**
 * Read-side Admin page guard. Parent `/admin` layout owns redirect behavior, while
 * child pages use this non-throwing helper to avoid emitting expected guest auth
 * failures as runtime errors before the parent redirect wins the render race.
 */
export async function getAdminSessionOrNull(request?: Request) {
  const session = await productionAuthProvider.getSession(request);
  if (!session || (!session.roles.includes('admin') && !session.roles.includes('super_admin'))) return null;
  return session;
}

export function assertOwnsCustomerRecord(session: ServerCustomerSession, customerId: EntityId) {
  if (session.user_id !== customerId) throw new Error('Customer ownership check failed.');
}
