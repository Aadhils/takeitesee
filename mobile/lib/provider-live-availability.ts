import { apiFetch } from './api';
import { supabase } from './supabase';

export type ProviderWorkMode = 'available' | 'busy' | 'offline' | 'paused';
export type ProviderLiveDurationMinutes = 15 | 30 | 60;

export type ProviderLiveAvailability = {
  provider_type: 'professional' | 'business';
  provider_id: string;
  work_mode: ProviderWorkMode;
  effective_work_mode: ProviderWorkMode;
  mode_expires_at: string | null;
  status_changed_at: string | null;
  updated_at: string | null;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export function effectiveProviderWorkMode(availability: ProviderLiveAvailability | null): ProviderWorkMode {
  if (!availability) return 'offline';
  if (availability.work_mode === 'available' || availability.work_mode === 'busy') {
    if (!availability.mode_expires_at) return 'offline';
    const expiry = new Date(availability.mode_expires_at).getTime();
    if (Number.isNaN(expiry) || expiry <= Date.now()) return 'offline';
  }
  return availability.effective_work_mode || availability.work_mode;
}

export async function fetchProviderLiveAvailability() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ availability: ProviderLiveAvailability }>('/api/provider/live-availability', {
    method: 'GET',
    accessToken,
  });
}

export async function updateProviderLiveAvailability(
  workMode: ProviderWorkMode,
  durationMinutes: ProviderLiveDurationMinutes = 30,
) {
  const accessToken = await currentAccessToken();
  const expiring = workMode === 'available' || workMode === 'busy';
  const modeExpiresAt = expiring
    ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    : null;

  return apiFetch<{ availability: ProviderLiveAvailability }>('/api/provider/live-availability', {
    method: 'PUT',
    accessToken,
    body: JSON.stringify({
      work_mode: workMode,
      mode_expires_at: modeExpiresAt,
    }),
  });
}
