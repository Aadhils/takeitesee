import { apiFetch } from './api';
import { supabase } from './supabase';

export type NativeNotification = {
  id: string;
  booking_id: string | null;
  conversation_id: string | null;
  target_path: string | null;
  event_type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchNotifications() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ notifications: NativeNotification[] }>('/api/notifications', {
    method: 'GET',
    accessToken,
  });
}

export async function markNotificationRead(id: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ ok: true }>('/api/notifications', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ id }),
  });
}

export async function markAllNotificationsRead() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ ok: true }>('/api/notifications', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ mark_all_read: true }),
  });
}
