import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
export type ProviderIdentityType = 'professional' | 'business';

export interface ProviderLiveAvailabilityInput {
  work_mode: ProviderWorkMode;
  mode_expires_at?: string | null;
}

export interface ProviderLiveAvailabilityRecord {
  provider_type: ProviderIdentityType;
  provider_id: string;
  work_mode: ProviderWorkMode;
  effective_work_mode: ProviderWorkMode;
  mode_expires_at: string | null;
  status_changed_at: string | null;
  updated_at: string | null;
}

type ProviderIdentity = {
  provider_type: ProviderIdentityType;
  provider_id: string;
  professional_id: string | null;
  business_id: string | null;
};

function normalizeInput(input: ProviderLiveAvailabilityInput) {
  if (!['available', 'busy', 'offline', 'paused'].includes(input.work_mode)) {
    throw new Error('Provider work mode is invalid.');
  }

  if (input.work_mode === 'offline' || input.work_mode === 'paused') {
    return { work_mode: input.work_mode, mode_expires_at: null };
  }

  const modeExpiresAt = input.mode_expires_at?.trim() || null;
  if (modeExpiresAt) {
    const parsed = new Date(modeExpiresAt);
    if (Number.isNaN(parsed.getTime())) throw new Error('Live work-mode expiry is invalid.');
    if (parsed.getTime() <= Date.now()) throw new Error('Live work-mode expiry must be in the future.');
    return { work_mode: input.work_mode, mode_expires_at: parsed.toISOString() };
  }

  return { work_mode: input.work_mode, mode_expires_at: null };
}

function effectiveWorkMode(workMode: ProviderWorkMode, modeExpiresAt: string | null): ProviderWorkMode {
  if ((workMode === 'available' || workMode === 'busy') && modeExpiresAt) {
    const expiry = new Date(modeExpiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) return 'offline';
  }
  return workMode;
}

async function resolveProviderIdentity(session: ServerCustomerSession): Promise<ProviderIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);

  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) {
    return { provider_type: 'professional', provider_id: professional.id, professional_id: professional.id, business_id: null };
  }
  if (business) {
    return { provider_type: 'business', provider_id: business.id, professional_id: null, business_id: business.id };
  }
  throw new Error('Provider identity was not found.');
}

export const productionProviderLiveAvailabilityRepository = {
  async get(session: ServerCustomerSession): Promise<ProviderLiveAvailabilityRecord> {
    assertProductionBackendConfigured();
    const identity = await resolveProviderIdentity(session);
    const supabase = await createSupabaseServerClient();
    const query = supabase
      .from('provider_live_availability')
      .select('work_mode,mode_expires_at,status_changed_at,updated_at')
      .eq('provider_type', identity.provider_type);
    const { data, error } = identity.provider_type === 'professional'
      ? await query.eq('professional_id', identity.provider_id).maybeSingle()
      : await query.eq('business_id', identity.provider_id).maybeSingle();

    if (error) throw new Error(error.message);
    const workMode = (data?.work_mode as ProviderWorkMode | undefined) ?? 'offline';
    const modeExpiresAt = data?.mode_expires_at ?? null;
    return {
      provider_type: identity.provider_type,
      provider_id: identity.provider_id,
      work_mode: workMode,
      effective_work_mode: effectiveWorkMode(workMode, modeExpiresAt),
      mode_expires_at: modeExpiresAt,
      status_changed_at: data?.status_changed_at ?? null,
      updated_at: data?.updated_at ?? null,
    };
  },

  async save(session: ServerCustomerSession, input: ProviderLiveAvailabilityInput): Promise<ProviderLiveAvailabilityRecord> {
    assertProductionBackendConfigured();
    const normalized = normalizeInput(input);
    const identity = await resolveProviderIdentity(session);
    const supabase = await createSupabaseServerClient();

    const query = supabase
      .from('provider_live_availability')
      .select('id')
      .eq('provider_type', identity.provider_type);
    const { data: existing, error: existingError } = identity.provider_type === 'professional'
      ? await query.eq('professional_id', identity.provider_id).maybeSingle()
      : await query.eq('business_id', identity.provider_id).maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error } = await supabase
        .from('provider_live_availability')
        .update({ work_mode: normalized.work_mode, mode_expires_at: normalized.mode_expires_at })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('provider_live_availability').insert({
        provider_type: identity.provider_type,
        professional_id: identity.professional_id,
        business_id: identity.business_id,
        work_mode: normalized.work_mode,
        mode_expires_at: normalized.mode_expires_at,
      });
      if (error) throw new Error(error.message);
    }

    return this.get(session);
  },
};
