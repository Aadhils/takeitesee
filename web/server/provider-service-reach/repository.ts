import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type ServiceFulfillmentMode = 'at_provider' | 'at_customer' | 'remote';
export type ServiceGeoLocationRole = 'service_site' | 'mobile_base';

export type ProviderServiceReachInput =
  | {
      action: 'save_modes';
      modes: Array<{ mode: ServiceFulfillmentMode; max_travel_distance_meters?: number | null }>;
    }
  | {
      action: 'set_location';
      role: ServiceGeoLocationRole;
      latitude: number;
      longitude: number;
      label?: string | null;
    }
  | {
      action: 'remove_location';
      role: ServiceGeoLocationRole;
    };

export interface ProviderServiceReachRecord {
  service_id: string;
  modes: Array<{
    mode: ServiceFulfillmentMode;
    max_travel_distance_meters: number | null;
  }>;
  locations: Array<{
    role: ServiceGeoLocationRole;
    is_set: boolean;
    label: string | null;
    updated_at: string | null;
  }>;
}

type ProviderIdentity = {
  provider_type: 'professional' | 'business';
  provider_id: string;
};

const ALL_MODES: ServiceFulfillmentMode[] = ['at_provider', 'at_customer', 'remote'];
const ALL_ROLES: ServiceGeoLocationRole[] = ['service_site', 'mobile_base'];

async function resolveProviderIdentity(session: ServerCustomerSession): Promise<ProviderIdentity> {
  const supabase = await createSupabaseServerClient();
  const [{ data: professional, error: professionalError }, { data: business, error: businessError }] = await Promise.all([
    supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle(),
    supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle(),
  ]);
  if (professionalError) throw new Error(professionalError.message);
  if (businessError) throw new Error(businessError.message);
  if (professional && business) throw new Error('Provider identity conflict detected. One account may own only one Provider identity.');
  if (professional) return { provider_type: 'professional', provider_id: professional.id };
  if (business) return { provider_type: 'business', provider_id: business.id };
  throw new Error('Provider identity was not found.');
}

async function assertOwnedService(session: ServerCustomerSession, serviceId: string) {
  const identity = await resolveProviderIdentity(session);
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('services').select('id,provider_type,professional_id,business_id').eq('id', serviceId);
  query = identity.provider_type === 'professional'
    ? query.eq('professional_id', identity.provider_id).eq('provider_type', 'professional')
    : query.eq('business_id', identity.provider_id).eq('provider_type', 'business');
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Service was not found or is not owned by this provider.');
  return data;
}

function normalizeModes(input: Extract<ProviderServiceReachInput, { action: 'save_modes' }>) {
  if (!Array.isArray(input.modes) || input.modes.length < 1 || input.modes.length > ALL_MODES.length) {
    throw new Error('Choose at least one valid service fulfillment mode.');
  }

  const unique = new Map<ServiceFulfillmentMode, number | null>();
  for (const item of input.modes) {
    if (!ALL_MODES.includes(item.mode)) throw new Error('Service fulfillment mode is invalid.');
    if (unique.has(item.mode)) throw new Error('Duplicate service fulfillment mode.');
    const distance = item.max_travel_distance_meters == null ? null : Math.round(Number(item.max_travel_distance_meters));
    if (item.mode === 'at_customer') {
      if (distance !== null && (!Number.isFinite(distance) || distance < 100 || distance > 500000)) {
        throw new Error('Travel distance must be between 100 meters and 500 kilometers.');
      }
      unique.set(item.mode, distance);
    } else {
      if (distance !== null) throw new Error('Travel distance applies only when the provider travels to the customer.');
      unique.set(item.mode, null);
    }
  }
  return unique;
}

function normalizeLocation(input: Extract<ProviderServiceReachInput, { action: 'set_location' }>) {
  if (!ALL_ROLES.includes(input.role)) throw new Error('Service location role is invalid.');
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude is invalid.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude is invalid.');
  const label = input.label?.trim() || (input.role === 'service_site' ? 'Primary service site' : 'Mobile service base');
  if (label.length > 120) throw new Error('Location label is too long.');
  return { role: input.role, point: `POINT(${longitude} ${latitude})`, label };
}

export const productionProviderServiceReachRepository = {
  async get(session: ServerCustomerSession, serviceId: string): Promise<ProviderServiceReachRecord> {
    assertProductionBackendConfigured();
    await assertOwnedService(session, serviceId);
    const supabase = await createSupabaseServerClient();
    const [{ data: modeRows, error: modeError }, { data: locationRows, error: locationError }] = await Promise.all([
      supabase
        .from('service_fulfillment_modes')
        .select('mode,max_travel_distance_meters')
        .eq('service_id', serviceId)
        .eq('active', true)
        .order('mode', { ascending: true }),
      supabase
        .from('service_geo_locations')
        .select('role,label,updated_at')
        .eq('service_id', serviceId)
        .eq('active', true)
        .eq('is_primary', true),
    ]);
    if (modeError) throw new Error(modeError.message);
    if (locationError) throw new Error(locationError.message);

    const locationByRole = new Map<ServiceGeoLocationRole, { label: string | null; updated_at: string | null }>();
    for (const row of locationRows ?? []) {
      if (ALL_ROLES.includes(row.role as ServiceGeoLocationRole)) {
        locationByRole.set(row.role as ServiceGeoLocationRole, {
          label: row.label ?? null,
          updated_at: row.updated_at ?? null,
        });
      }
    }

    return {
      service_id: serviceId,
      modes: (modeRows ?? []).map((row) => ({
        mode: row.mode as ServiceFulfillmentMode,
        max_travel_distance_meters: row.max_travel_distance_meters == null ? null : Number(row.max_travel_distance_meters),
      })),
      locations: ALL_ROLES.map((role) => ({
        role,
        is_set: locationByRole.has(role),
        label: locationByRole.get(role)?.label ?? null,
        updated_at: locationByRole.get(role)?.updated_at ?? null,
      })),
    };
  },

  async save(session: ServerCustomerSession, serviceId: string, input: ProviderServiceReachInput): Promise<ProviderServiceReachRecord> {
    assertProductionBackendConfigured();
    await assertOwnedService(session, serviceId);
    if (!input || !['save_modes', 'set_location', 'remove_location'].includes(input.action)) throw new Error('Service reach action is invalid.');
    const supabase = await createSupabaseServerClient();

    if (input.action === 'save_modes') {
      const modes = normalizeModes(input);
      for (const mode of ALL_MODES) {
        if (modes.has(mode)) {
          const { error } = await supabase.from('service_fulfillment_modes').upsert({
            service_id: serviceId,
            mode,
            max_travel_distance_meters: modes.get(mode) ?? null,
            active: true,
          }, { onConflict: 'service_id,mode' });
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('service_fulfillment_modes').delete().eq('service_id', serviceId).eq('mode', mode);
          if (error) throw new Error(error.message);
        }
      }
      return this.get(session, serviceId);
    }

    if (input.action === 'remove_location') {
      if (!ALL_ROLES.includes(input.role)) throw new Error('Service location role is invalid.');
      const { error } = await supabase
        .from('service_geo_locations')
        .update({ active: false, is_primary: false })
        .eq('service_id', serviceId)
        .eq('role', input.role)
        .eq('active', true);
      if (error) throw new Error(error.message);
      return this.get(session, serviceId);
    }

    const location = normalizeLocation(input);
    const { data: existing, error: existingError } = await supabase
      .from('service_geo_locations')
      .select('id')
      .eq('service_id', serviceId)
      .eq('role', location.role)
      .eq('active', true)
      .eq('is_primary', true)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error } = await supabase
        .from('service_geo_locations')
        .update({ point: location.point, label: location.label, active: true, is_primary: true })
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('service_geo_locations').insert({
        service_id: serviceId,
        role: location.role,
        point: location.point,
        label: location.label,
        active: true,
        is_primary: true,
      });
      if (error) throw new Error(error.message);
    }

    return this.get(session, serviceId);
  },
};
