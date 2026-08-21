import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export type AvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

export interface AvailabilityWindowInput {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
}

export interface AvailabilityBlackoutInput {
  starts_at: string;
  ends_at: string;
  reason?: string;
}

export interface ProviderAvailabilityInput {
  mode: AvailabilityMode;
  timezone: string;
  weekly_windows: AvailabilityWindowInput[];
  blackout_periods: AvailabilityBlackoutInput[];
}

export interface ProviderAvailabilityRecord extends ProviderAvailabilityInput {
  service_id: EntityId;
}

function assertTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error('Availability time is invalid.');
}

function validate(input: ProviderAvailabilityInput) {
  if (!['always_available', 'on_request', 'scheduled'].includes(input.mode)) throw new Error('Availability mode is invalid.');
  if (!input.timezone.trim()) throw new Error('Timezone is required.');
  if (input.mode === 'scheduled' && input.weekly_windows.length === 0) throw new Error('Scheduled availability requires at least one weekly window.');
  for (const window of input.weekly_windows) {
    if (!Number.isInteger(window.day_of_week) || window.day_of_week < 0 || window.day_of_week > 6) throw new Error('Availability day is invalid.');
    assertTime(window.start_time);
    assertTime(window.end_time);
    if (window.start_time >= window.end_time) throw new Error('Availability window end time must be after start time.');
  }
  for (const blackout of input.blackout_periods) {
    const start = new Date(blackout.starts_at);
    const end = new Date(blackout.ends_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new Error('Blackout period is invalid.');
  }
}

async function assertOwnService(session: ServerCustomerSession, serviceId: EntityId) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('services').select('id,provider_type,professional_id,business_id').eq('id', serviceId).maybeSingle();
  if (error || !data) throw new Error('Service was not found.');

  if (session.roles.includes('professional')) {
    const { data: profile } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
    if (!profile || data.provider_type !== 'professional' || data.professional_id !== profile.id) throw new Error('Service ownership check failed.');
    return;
  }

  if (session.roles.includes('business_owner')) {
    const { data: business } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).eq('id', data.business_id).maybeSingle();
    if (!business || data.provider_type !== 'business') throw new Error('Service ownership check failed.');
    return;
  }

  throw new Error('Provider role is required.');
}

export const productionProviderAvailabilityRepository = {
  async get(session: ServerCustomerSession, serviceId: EntityId): Promise<ProviderAvailabilityRecord> {
    assertProductionBackendConfigured();
    await assertOwnService(session, serviceId);
    const supabase = await createSupabaseServerClient();
    const [{ data: setting, error: settingError }, { data: windows, error: windowsError }, { data: blackouts, error: blackoutsError }] = await Promise.all([
      supabase.from('service_availability').select('mode,timezone').eq('service_id', serviceId).maybeSingle(),
      supabase.from('service_availability_windows').select('day_of_week,start_time,end_time').eq('service_id', serviceId).order('day_of_week').order('start_time'),
      supabase.from('service_availability_blackouts').select('starts_at,ends_at,reason').eq('service_id', serviceId).order('starts_at'),
    ]);
    if (settingError || windowsError || blackoutsError) throw new Error(settingError?.message ?? windowsError?.message ?? blackoutsError?.message ?? 'Unable to load availability.');
    return {
      service_id: serviceId,
      mode: (setting?.mode as AvailabilityMode | undefined) ?? 'on_request',
      timezone: setting?.timezone ?? 'Asia/Kolkata',
      weekly_windows: (windows ?? []).map((row) => ({ day_of_week: row.day_of_week as AvailabilityWindowInput['day_of_week'], start_time: row.start_time, end_time: row.end_time })),
      blackout_periods: (blackouts ?? []).map((row) => ({ starts_at: row.starts_at, ends_at: row.ends_at, reason: row.reason ?? undefined })),
    };
  },

  async save(session: ServerCustomerSession, serviceId: EntityId, input: ProviderAvailabilityInput): Promise<ProviderAvailabilityRecord> {
    assertProductionBackendConfigured();
    validate(input);
    await assertOwnService(session, serviceId);
    const supabase = await createSupabaseServerClient();

    const { error: settingError } = await supabase.from('service_availability').upsert({ service_id: serviceId, mode: input.mode, timezone: input.timezone.trim(), updated_at: new Date().toISOString() }, { onConflict: 'service_id' });
    if (settingError) throw new Error(settingError.message);

    const { error: clearWindowsError } = await supabase.from('service_availability_windows').delete().eq('service_id', serviceId);
    if (clearWindowsError) throw new Error(clearWindowsError.message);
    if (input.weekly_windows.length) {
      const { error } = await supabase.from('service_availability_windows').insert(input.weekly_windows.map((window) => ({ service_id: serviceId, ...window })));
      if (error) throw new Error(error.message);
    }

    const { error: clearBlackoutsError } = await supabase.from('service_availability_blackouts').delete().eq('service_id', serviceId);
    if (clearBlackoutsError) throw new Error(clearBlackoutsError.message);
    if (input.blackout_periods.length) {
      const { error } = await supabase.from('service_availability_blackouts').insert(input.blackout_periods.map((blackout) => ({ service_id: serviceId, starts_at: blackout.starts_at, ends_at: blackout.ends_at, reason: blackout.reason?.trim() || null })));
      if (error) throw new Error(error.message);
    }

    return this.get(session, serviceId);
  },
};
