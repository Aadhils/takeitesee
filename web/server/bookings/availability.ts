import type { EntityId } from '../../types/entities';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import type { CreateBookingInput } from './repository';

type AvailabilityMode = 'always_available' | 'on_request' | 'scheduled';

const BLOCKING_STATUSES = ['pending', 'confirmed', 'rescheduled'];

function minutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function bookingRange(input: CreateBookingInput) {
  const start = minutes(input.start_time);
  return { start, end: start + input.duration_minutes };
}

function isoForBooking(input: CreateBookingInput, end = false) {
  const { start, end: endMinutes } = bookingRange(input);
  const total = end ? endMinutes : start;
  const dayOffset = Math.floor(total / 1440);
  const normalized = total % 1440;
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minute = String(normalized % 60).padStart(2, '0');
  const base = new Date(`${input.booking_date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return `${base.toISOString().slice(0, 10)}T${hour}:${minute}:00`;
}

export async function assertBookingAvailability(input: CreateBookingInput) {
  const supabase = await createSupabaseServerClient();
  const { data: setting, error: settingError } = await supabase
    .from('service_availability')
    .select('mode,timezone')
    .eq('service_id', input.service_id)
    .maybeSingle();
  if (settingError) throw new Error(settingError.message);

  const mode = (setting?.mode as AvailabilityMode | undefined) ?? 'on_request';
  if (mode === 'scheduled') {
    const weekday = new Date(`${input.booking_date}T12:00:00Z`).getUTCDay();
    const { data: windows, error } = await supabase
      .from('service_availability_windows')
      .select('start_time,end_time')
      .eq('service_id', input.service_id)
      .eq('day_of_week', weekday);
    if (error) throw new Error(error.message);
    const range = bookingRange(input);
    const fitsWindow = (windows ?? []).some((window) => range.start >= minutes(window.start_time) && range.end <= minutes(window.end_time));
    if (!fitsWindow) throw new Error('The selected time is outside the provider availability window.');
  }

  const requestedStart = isoForBooking(input);
  const requestedEnd = isoForBooking(input, true);
  const { data: blackouts, error: blackoutError } = await supabase
    .from('service_availability_blackouts')
    .select('starts_at,ends_at')
    .eq('service_id', input.service_id)
    .lt('starts_at', requestedEnd)
    .gt('ends_at', requestedStart);
  if (blackoutError) throw new Error(blackoutError.message);
  if ((blackouts ?? []).length) throw new Error('The selected time is blocked by the provider.');

  const providerColumn = input.provider_type === 'professional' ? 'professional_id' : 'business_id';
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_date,start_time,duration_minutes,status')
    .eq(providerColumn, input.provider_id)
    .eq('booking_date', input.booking_date)
    .in('status', BLOCKING_STATUSES);
  if (bookingError) throw new Error(bookingError.message);

  const requested = bookingRange(input);
  const overlaps = (bookings ?? []).some((booking) => {
    const existingStart = minutes(booking.start_time);
    const existingEnd = existingStart + Number(booking.duration_minutes);
    return requested.start < existingEnd && requested.end > existingStart;
  });
  if (overlaps) throw new Error('The provider already has a booking during the selected time.');
}
