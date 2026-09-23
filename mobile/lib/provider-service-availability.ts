import { apiFetch } from './api';
import { supabase } from './supabase';

export type ProviderServiceAvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

export type ProviderServiceAvailability = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  category: string | null;
  location: string | null;
  duration_minutes: number;
  base_price: number;
  currency: 'INR' | 'USD';
  availability_mode: ProviderServiceAvailabilityMode;
  timezone: string;
  weekly_window_count: number;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchProviderServiceAvailability() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ services: ProviderServiceAvailability[] }>('/api/mobile/provider/service-availability', {
    method: 'GET',
    accessToken,
  });
}

export async function updateProviderServiceAvailability(
  serviceId: string,
  mode: ProviderServiceAvailabilityMode,
) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ service: ProviderServiceAvailability }>('/api/mobile/provider/service-availability', {
    method: 'PUT',
    accessToken,
    body: JSON.stringify({ service_id: serviceId, mode }),
  });
}

export function formatProviderServiceAvailabilityMode(mode: ProviderServiceAvailabilityMode) {
  if (mode === 'always_available') return 'Always available';
  if (mode === 'scheduled') return 'Scheduled';
  return 'On request';
}
