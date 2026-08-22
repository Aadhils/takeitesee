import type { EntityId } from '../../types/entities';
import type { PlatformRole } from '../../types/ownership';
import type { ServerCustomerSession } from '../../types/production-domain';
import { assertProductionBackendConfigured } from '../config';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export interface ServerAuthProvider {
  getSession(request: Request): Promise<ServerCustomerSession | null>;
  requireCustomer(request: Request): Promise<ServerCustomerSession>;
  requireProvider(request: Request): Promise<ServerCustomerSession>;
}

/** Production boundary backed by Supabase auth plus owned provider records. */
export const productionAuthProvider: ServerAuthProvider = {
  async getSession(_request: Request) {
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
    if (storedRole === 'professional') roles.push('professional');
    if (storedRole === 'business') roles.push('business_owner');

    // Provider workspaces are ultimately owned by these records. Resolve them
    // from ownership as well so an older/customer users.role value cannot block
    // a legitimate professional/business workspace session.
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

    // Every authenticated marketplace account can still use customer flows.
    if (!roles.includes('customer')) roles.push('customer');

    return {
      user_id: user.id as EntityId,
      roles,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    };
  },
  async requireCustomer(request: Request) {
    const session = await this.getSession(request);
    if (!session || !session.roles.includes('customer')) throw new Error('Authentication required.');
    return session;
  },
  async requireProvider(request: Request) {
    const session = await this.getSession(request);
    if (!session || (!session.roles.includes('professional') && !session.roles.includes('business_owner'))) {
      throw new Error('Provider authentication required.');
    }
    return session;
  },
};

export function assertOwnsCustomerRecord(session: ServerCustomerSession, customerId: EntityId) {
  if (session.user_id !== customerId) throw new Error('Customer ownership check failed.');
}
