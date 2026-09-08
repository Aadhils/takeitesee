import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type BusinessShopState = 'open' | 'closed';

export interface BusinessShopStatusInput {
  shop_state: BusinessShopState;
}

export interface BusinessShopStatusRecord {
  business_id: string;
  shop_state: BusinessShopState;
  status_changed_at: string | null;
  updated_at: string | null;
}

type BusinessIdentity = { business_id: string };

function normalizeState(value: unknown): BusinessShopState {
  if (value !== 'open' && value !== 'closed') throw new Error('Business shop state is invalid.');
  return value;
}

async function resolveBusinessIdentity(session: ServerCustomerSession): Promise<BusinessIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);
  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) throw new Error('Business Provider identity is required to manage Shop Open/Closed.');
  if (!business) throw new Error('Business Provider identity was not found.');
  return { business_id: String(business.id) };
}

export const productionBusinessShopStatusRepository = {
  async get(session: ServerCustomerSession): Promise<BusinessShopStatusRecord> {
    assertProductionBackendConfigured();
    const identity = await resolveBusinessIdentity(session);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('business_shop_status')
      .select('business_id,shop_state,status_changed_at,updated_at')
      .eq('business_id', identity.business_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      business_id: identity.business_id,
      shop_state: data?.shop_state === 'open' ? 'open' : 'closed',
      status_changed_at: data?.status_changed_at ?? null,
      updated_at: data?.updated_at ?? null,
    };
  },

  async save(session: ServerCustomerSession, input: BusinessShopStatusInput): Promise<BusinessShopStatusRecord> {
    assertProductionBackendConfigured();
    const identity = await resolveBusinessIdentity(session);
    const shopState = normalizeState(input.shop_state);
    const supabase = await createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from('business_shop_status')
      .select('business_id')
      .eq('business_id', identity.business_id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error } = await supabase
        .from('business_shop_status')
        .update({ shop_state: shopState })
        .eq('business_id', identity.business_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('business_shop_status').insert({
        business_id: identity.business_id,
        shop_state: shopState,
      });
      if (error) throw new Error(error.message);
    }

    return this.get(session);
  },
};
