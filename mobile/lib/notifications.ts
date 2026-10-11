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

async function currentAccessToken(userId?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (userId && data.session?.user.id !== userId) throw new Error('Your account changed. Reload notifications.');
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchNotifications(userId?: string) {
  const accessToken = await currentAccessToken(userId);
  return apiFetch<{ notifications: NativeNotification[] }>('/api/notifications', {
    method: 'GET',
    accessToken,
  });
}

export async function markNotificationRead(id: string, userId?: string) {
  const accessToken = await currentAccessToken(userId);
  return apiFetch<{ ok: true }>('/api/notifications', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ id }),
  });
}

export async function markAllNotificationsRead(userId?: string) {
  const accessToken = await currentAccessToken(userId);
  return apiFetch<{ ok: true }>('/api/notifications', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ mark_all_read: true }),
  });
}
