import type { EntityId } from '../../types/entities';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import type { CreateBookingInput } from './repository';
import { bookingInstantIso, timeToMinutes } from './time';

type AvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

const BLOCKING_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const DEFAULT_START_MINUTES = 9 * 60;
const DEFAULT_END_MINUTES = 18 * 60;

function bookingRange(input: CreateBookingInput) {
  const start = timeToMinutes(input.start_time);
  return { start, end: start + input.duration_minutes };
}

export async function assertBookingAvailability(input: CreateBookingInput, excludeBookingId?: EntityId) {
  const supabase = await createSupabaseServerClient();
  const { data: setting, error: settingError } = await supabase
    .from('service_availability')
    .select('mode,timezone')
    .eq('service_id', input.service_id)
    .maybeSingle();
  if (settingError) throw new Error(settingError.message);

  const mode = (setting?.mode as AvailabilityMode | undefined) ?? 'on_request';
  const timezone = String(setting?.timezone ?? input.timezone ?? 'Asia/Kolkata');
  const range = bookingRange(input);

  if (mode === 'scheduled') {
    const weekday = new Date(`${input.booking_date}T12:00:00Z`).getUTCDay();
    const { data: windows, error } = await supabase
      .from('service_availability_windows')
      .select('start_time,end_time')
      .eq('service_id', input.service_id)
      .eq('day_of_week', weekday);
    if (error) throw new Error(error.message);
    const fitsWindow = (windows ?? []).some((window) => range.start >= timeToMinutes(window.start_time) && range.end <= timeToMinutes(window.end_time));
    if (!fitsWindow) throw new Error('The selected time is outside the provider availability window.');
  } else if (range.start < DEFAULT_START_MINUTES || range.end > DEFAULT_END_MINUTES) {
    throw new Error('The selected time is outside the provider booking hours.');
  }

  const requestedStart = bookingInstantIso(input.booking_date, range.start, timezone);
  const requestedEnd = bookingInstantIso(input.booking_date, range.end, timezone);
  const { data: blackouts, error: blackoutError } = await supabase
    .from('service_availability_blackouts')
    .select('starts_at,ends_at')
    .eq('service_id', input.service_id)
    .lt('starts_at', requestedEnd)
    .gt('ends_at', requestedStart);
  if (blackoutError) throw new Error(blackoutError.message);
  if ((blackouts ?? []).length) throw new Error('The selected time is blocked by the provider.');

  const providerColumn = input.provider_type === 'professional' ? 'professional_id' : 'business_id';
  let query = supabase
    .from('bookings')
    .select('id,booking_date,start_time,duration_minutes,status')
    .eq(providerColumn, input.provider_id)
    .eq('booking_date', input.booking_date)
    .in('status', BLOCKING_STATUSES);
  if (excludeBookingId) query = query.neq('id', excludeBookingId);
  const { data: bookings, error: bookingError } = await query;
  if (bookingError) throw new Error(bookingError.message);

  const overlaps = (bookings ?? []).some((booking) => {
    const existingStart = timeToMinutes(booking.start_time);
    const existingEnd = existingStart + Number(booking.duration_minutes);
    return range.start < existingEnd && range.end > existingStart;
  });
  if (overlaps) throw new Error('The provider already has a booking during the selected time.');
}
