import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { assertProductionBackendConfigured } from '../config';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export interface ServerAuthProvider {
  getSession(request: Request): Promise<ServerCustomerSession | null>;
  requireCustomer(request: Request): Promise<ServerCustomerSession>;
}

/** Production boundary. Wire this to the selected OIDC/Supabase/Auth.js provider. */
export const productionAuthProvider: ServerAuthProvider = {
  async getSession(_request: Request) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: profile, error: profileError } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    const role = profile?.role === 'admin' ? 'admin' : profile?.role === 'professional' ? 'professional' : profile?.role === 'business' ? 'business_owner' : 'customer';
    return { user_id: user.id as EntityId, roles: [role], expires_at: new Date(Date.now() + 60 * 60 * 1000) };
  },
  async requireCustomer(request: Request) {
    const session = await this.getSession(request);
    if (!session || !session.roles.includes('customer')) throw new Error('Authentication required.');
    return session;
  },
};

export function assertOwnsCustomerRecord(session: ServerCustomerSession, customerId: EntityId) {
  if (session.user_id !== customerId) throw new Error('Customer ownership check failed.');
}
