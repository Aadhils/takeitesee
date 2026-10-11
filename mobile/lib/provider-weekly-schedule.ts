import { apiFetch } from './api';
import { supabase } from './supabase';
import { fetchOwnedServices, type OwnedService } from './provider-services';
export type WeeklyWindow = { day_of_week: number; start_time: string; end_time: string };
export type WeeklySchedule = { service_id: string; mode: 'always_available' | 'on_request' | 'scheduled'; timezone: string; weekly_windows: WeeklyWindow[]; blackout_periods: { starts_at: string; ends_at: string; reason?: string }[] };
export class ScheduleSaveUncertainError extends Error {}
async function token(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage your schedule.');
  return data.session.access_token;
}
function timeSeconds(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error('Use 24-hour times such as 09:00 or 17:30.');
  const [hour, minute, second = 0] = value.split(':').map(Number); return hour * 3600 + minute * 60 + second;
}
export function validateWeeklySchedule(schedule: WeeklySchedule) {
  if (!['always_available', 'on_request', 'scheduled'].includes(schedule.mode)) throw new Error('Choose a valid availability mode.');
  if (!schedule.timezone.trim()) throw new Error('Service timezone is missing. Reload the schedule.');
  if (schedule.mode === 'scheduled' && !schedule.weekly_windows.length) throw new Error('Add at least one working-hours window for Scheduled mode.');
  const ranges = new Map<number, [number, number][]>();
  for (const row of schedule.weekly_windows) {
    if (!Number.isInteger(row.day_of_week) || row.day_of_week < 0 || row.day_of_week > 6) throw new Error('Choose a valid weekday.');
    const start = timeSeconds(row.start_time), end = timeSeconds(row.end_time);
    if (start >= end) throw new Error('End time must be after start time on the same day.');
    const day = ranges.get(row.day_of_week) ?? [];
    if (day.some(([a, b]) => start < b && end > a)) throw new Error('Working-hours windows on the same day must not overlap.');
    day.push([start, end]); ranges.set(row.day_of_week, day);
  }
}
function fingerprint(schedule: WeeklySchedule) {
  return JSON.stringify({ mode: schedule.mode, timezone: schedule.timezone, windows: schedule.weekly_windows.map((row) => [row.day_of_week, timeSeconds(row.start_time), timeSeconds(row.end_time)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), blackouts: schedule.blackout_periods.map((row) => [new Date(row.starts_at).toISOString(), new Date(row.ends_at).toISOString(), row.reason ?? '']).sort() });
}
export async function fetchWeeklySchedule(userId: string, serviceId: string): Promise<WeeklySchedule> {
  const accessToken = await token(userId);
  const { availability } = await apiFetch<{ availability: WeeklySchedule }>(`/api/provider/services/${encodeURIComponent(serviceId)}/availability`, { accessToken });
  await token(userId);
  if (!availability || availability.service_id !== serviceId || !Array.isArray(availability.weekly_windows) || !Array.isArray(availability.blackout_periods)) throw new Error('This service schedule could not be verified.');
  return availability;
}
export async function saveWeeklySchedule(userId: string, scope: OwnedService['provider_type'], original: WeeklySchedule, draft: WeeklySchedule) {
  if (original.service_id !== draft.service_id || original.timezone !== draft.timezone) throw new Error('Reload the service schedule before saving.');
  validateWeeklySchedule(draft);
  if (!(await fetchOwnedServices(userId, scope)).some((service) => service.id === original.service_id)) throw new Error('This service is unavailable in your Provider profile.');
  const latest = await fetchWeeklySchedule(userId, original.service_id);
  if (fingerprint(latest) !== fingerprint(original)) throw new Error('This schedule changed elsewhere. Reload saved hours before editing again.');
  const accessToken = await token(userId);
  try {
    const { availability } = await apiFetch<{ availability: WeeklySchedule }>(`/api/provider/services/${encodeURIComponent(original.service_id)}/availability`, { method: 'PUT', accessToken, body: JSON.stringify({ mode: draft.mode, timezone: original.timezone, weekly_windows: draft.weekly_windows, blackout_periods: latest.blackout_periods }) });
    await token(userId);
    if (!availability || availability.service_id !== original.service_id) throw new Error('Save result could not be verified.');
    return availability;
  } catch {
    throw new ScheduleSaveUncertainError('Some schedule changes may have saved. Reload saved hours and check them before trying again.');
  }
}
