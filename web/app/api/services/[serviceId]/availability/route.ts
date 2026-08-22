import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ serviceId: string }> };
type Mode = 'always_available' | 'on_request' | 'scheduled';
type WindowRow = { day_of_week: number; start_time: string; end_time: string };
type BlackoutRow = { starts_at: string; ends_at: string };
type BookingRow = { booking_date: string; start_time: string; duration_minutes: number; status: string };

const BLOCKING_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const SLOT_STEP_MINUTES = 30;
const DAYS_AHEAD = 14;

function minutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function timeLabel(total: number) {
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
}

function candidateEpoch(date: string, totalMinutes: number, timezone: string) {
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  // Phase 9 currently supports the configured India marketplace timezone.
  const offset = timezone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  return new Date(`${date}T${hh}:${mm}:00${offset}`).getTime();
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { serviceId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id,duration_minutes,provider_type,professional_id,business_id,status')
      .eq('id', serviceId)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    if (!service || service.status !== 'active') throw new Error('This service is not available for booking.');

    const [{ data: setting, error: settingError }, { data: windows, error: windowsError }, { data: blackouts, error: blackoutsError }] = await Promise.all([
      supabase.from('service_availability').select('mode,timezone').eq('service_id', serviceId).maybeSingle(),
      supabase.from('service_availability_windows').select('day_of_week,start_time,end_time').eq('service_id', serviceId).order('day_of_week').order('start_time'),
      supabase.from('service_availability_blackouts').select('starts_at,ends_at').eq('service_id', serviceId).order('starts_at'),
    ]);
    if (settingError || windowsError || blackoutsError) throw new Error(settingError?.message ?? windowsError?.message ?? blackoutsError?.message ?? 'Unable to load availability.');

    const mode = (setting?.mode as Mode | undefined) ?? 'on_request';
    const timezone = setting?.timezone ?? 'Asia/Kolkata';
    const duration = Number(service.duration_minutes) || 60;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + DAYS_AHEAD - 1);

    const providerColumn = service.provider_type === 'professional' ? 'professional_id' : 'business_id';
    const providerId = service.provider_type === 'professional' ? service.professional_id : service.business_id;
    let bookings: BookingRow[] = [];
    if (providerId) {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_date,start_time,duration_minutes,status')
        .eq(providerColumn, providerId)
        .gte('booking_date', isoDate(start))
        .lte('booking_date', isoDate(end))
        .in('status', BLOCKING_STATUSES);
      if (!error) bookings = (data ?? []) as BookingRow[];
    }

    const blackoutRows = (blackouts ?? []) as BlackoutRow[];
    const windowRows = (windows ?? []) as WindowRow[];
    const days = [];

    for (let index = 0; index < DAYS_AHEAD; index += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const dateString = isoDate(date);
      const weekday = date.getUTCDay();
      const ranges = mode === 'scheduled'
        ? windowRows.filter((row) => row.day_of_week === weekday).map((row) => [minutes(row.start_time), minutes(row.end_time)] as const)
        : [[9 * 60, 18 * 60] as const];
      const slots: Array<{ time: string; value: string; available: boolean; reason?: string }> = [];

      for (const [rangeStart, rangeEnd] of ranges) {
        for (let slotStart = rangeStart; slotStart + duration <= rangeEnd; slotStart += SLOT_STEP_MINUTES) {
          const slotEnd = slotStart + duration;
          const startEpoch = candidateEpoch(dateString, slotStart, timezone);
          const endEpoch = candidateEpoch(dateString, slotEnd, timezone);
          const blackout = blackoutRows.some((row) => startEpoch < new Date(row.ends_at).getTime() && endEpoch > new Date(row.starts_at).getTime());
          const conflict = bookings.some((booking) => {
            if (booking.booking_date !== dateString) return false;
            const existingStart = minutes(booking.start_time);
            const existingEnd = existingStart + Number(booking.duration_minutes);
            return slotStart < existingEnd && slotEnd > existingStart;
          });
          slots.push({ time: timeLabel(slotStart), value: `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`, available: !blackout && !conflict, reason: blackout ? 'Provider blackout' : conflict ? 'Already booked' : undefined });
        }
      }

      days.push({ date: dateString, label: dateLabel(date), slots });
    }

    return NextResponse.json({ mode, timezone, duration_minutes: duration, days });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking availability.' }, { status: 400 });
  }
}
