import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function assertCustomerIsNotProviderOwner(
  session: ServerCustomerSession,
  providerType: 'professional' | 'business',
  providerId: EntityId,
) {
  const supabase = await createSupabaseServerClient();

  if (providerType === 'business') {
    const { data, error } = await supabase
      .from('businesses')
      .select('owner_user_id')
      .eq('id', providerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.owner_user_id === session.user_id) throw new Error('You cannot book your own service.');
    return;
  }

  const { data, error } = await supabase
    .from('professional_profiles')
    .select('user_id')
    .eq('id', providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.user_id === session.user_id) throw new Error('You cannot book your own service.');
}
