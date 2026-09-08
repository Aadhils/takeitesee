import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type ProviderIdentityType = 'professional' | 'business';
export type ProviderLocationShareMinutes = 15 | 30 | 60;

export type ProviderLiveLocationInput =
  | {
      action: 'share';
      latitude: number;
      longitude: number;
      accuracy_meters?: number | null;
      share_minutes: ProviderLocationShareMinutes;
    }
  | { action: 'stop' };

export interface ProviderLiveLocationRecord {
  provider_type: ProviderIdentityType;
  provider_id: string;
  matching_enabled: boolean;
  effective_matching_enabled: boolean;
  captured_at: string | null;
  expires_at: string | null;
  accuracy_meters: number | null;
  updated_at: string | null;
}

type ProviderIdentity = {
  provider_type: ProviderIdentityType;
  provider_id: string;
  professional_id: string | null;
  business_id: string | null;
};

const SHARE_MINUTES = new Set<number>([15, 30, 60]);

async function resolveProviderIdentity(session: ServerCustomerSession): Promise<ProviderIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);

  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) return { provider_type: 'professional', provider_id: professional.id, professional_id: professional.id, business_id: null };
  if (business) return { provider_type: 'business', provider_id: business.id, professional_id: null, business_id: business.id };
  throw new Error('Provider identity was not found.');
}

function effectiveMatchingEnabled(matchingEnabled: boolean, expiresAt: string | null) {
  if (!matchingEnabled || !expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

function normalizeShareInput(input: Extract<ProviderLiveLocationInput, { action: 'share' }>) {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const accuracy = input.accuracy_meters == null ? null : Number(input.accuracy_meters);
  const shareMinutes = Number(input.share_minutes);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude is invalid.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude is invalid.');
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50000)) throw new Error('Location accuracy is invalid.');
  if (!SHARE_MINUTES.has(shareMinutes)) throw new Error('Location share window is invalid.');

  const capturedAt = new Date();
  const expiresAt = new Date(capturedAt.getTime() + shareMinutes * 60_000);
  return {
    point: `POINT(${longitude} ${latitude})`,
    accuracy_meters: accuracy,
    captured_at: capturedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    matching_enabled: true,
  };
}

export const productionProviderLiveLocationRepository = {
  async get(session: ServerCustomerSession): Promise<ProviderLiveLocationRecord> {
    assertProductionBackendConfigured();
    const identity = await resolveProviderIdentity(session);
    const supabase = await createSupabaseServerClient();
    const baseQuery = supabase
      .from('provider_live_locations')
      .select('matching_enabled,captured_at,expires_at,accuracy_meters,updated_at')
      .eq('provider_type', identity.provider_type);
    const { data, error } = identity.provider_type === 'professional'
      ? await baseQuery.eq('professional_id', identity.provider_id).maybeSingle()
      : await baseQuery.eq('business_id', identity.provider_id).maybeSingle();

    if (error) throw new Error(error.message);
    const matchingEnabled = Boolean(data?.matching_enabled);
    const expiresAt = data?.expires_at ?? null;
    return {
      provider_type: identity.provider_type,
      provider_id: identity.provider_id,
      matching_enabled: matchingEnabled,
      effective_matching_enabled: effectiveMatchingEnabled(matchingEnabled, expiresAt),
      captured_at: data?.captured_at ?? null,
      expires_at: expiresAt,
      accuracy_meters: data?.accuracy_meters == null ? null : Number(data.accuracy_meters),
      updated_at: data?.updated_at ?? null,
    };
  },

  async save(session: ServerCustomerSession, input: ProviderLiveLocationInput): Promise<ProviderLiveLocationRecord> {
    assertProductionBackendConfigured();
    if (!input || (input.action !== 'share' && input.action !== 'stop')) throw new Error('Location action is invalid.');

    const identity = await resolveProviderIdentity(session);
    const supabase = await createSupabaseServerClient();
    const existingQuery = supabase
      .from('provider_live_locations')
      .select('id')
      .eq('provider_type', identity.provider_type);
    const { data: existing, error: existingError } = identity.provider_type === 'professional'
      ? await existingQuery.eq('professional_id', identity.provider_id).maybeSingle()
      : await existingQuery.eq('business_id', identity.provider_id).maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (input.action === 'stop') {
      if (existing) {
        const { error } = await supabase
          .from('provider_live_locations')
          .update({ matching_enabled: false, expires_at: null })
          .eq('id', existing.id);
        if (error) throw new Error(error.message);
      }
      return this.get(session);
    }

    const patch = normalizeShareInput(input);
    if (existing) {
      const { error } = await supabase.from('provider_live_locations').update(patch).eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('provider_live_locations').insert({
        provider_type: identity.provider_type,
        professional_id: identity.professional_id,
        business_id: identity.business_id,
        ...patch,
      });
      if (error) throw new Error(error.message);
    }

    return this.get(session);
  },
};
