import type { EntityId } from '../../types/entities';
import type { ProductionBooking, ProductionBookingStatus, ServerCustomerSession } from '../../types/production-domain';
import { assertProductionBackendConfigured } from '../config';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertBookingAvailability } from './availability';

export interface CreateBookingInput {
  service_id: EntityId;
  provider_id: EntityId;
  provider_type: 'professional' | 'business';
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  idempotency_key: string;
  service_name: string;
}

export interface RescheduleBookingInput {
  booking_date: string;
  start_time: string;
  reason?: string;
}

export interface ProductionBookingRepository {
  createBooking(session: ServerCustomerSession, input: CreateBookingInput): Promise<ProductionBooking>;
  getBookingById(session: ServerCustomerSession, bookingId: EntityId): Promise<ProductionBooking | null>;
  getCustomerBookings(session: ServerCustomerSession): Promise<ProductionBooking[]>;
  updateBookingStatus(session: ServerCustomerSession, bookingId: EntityId, status: ProductionBookingStatus, reason?: string): Promise<ProductionBooking>;
  rescheduleBooking(session: ServerCustomerSession, bookingId: EntityId, input: RescheduleBookingInput): Promise<ProductionBooking>;
}

export function validateCreateBookingInput(input: CreateBookingInput) {
  if (!input.service_id || !input.provider_id) throw new Error('Service and provider are required.');
  if (!['professional', 'business'].includes(input.provider_type)) throw new Error('Provider type is invalid.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.booking_date)) throw new Error('Booking date is invalid.');
  if (!input.start_time || !input.timezone) throw new Error('Booking time and timezone are required.');
  if (!Number.isInteger(input.duration_minutes) || input.duration_minutes <= 0) throw new Error('Booking duration is invalid.');
  if (!input.location.trim()) throw new Error('Booking location is required.');
  if (!Number.isFinite(input.quoted_price) || input.quoted_price < 0) throw new Error('Quoted price is invalid.');
  if (!['INR', 'USD'].includes(input.currency)) throw new Error('Currency is invalid.');
  if (!input.idempotency_key.trim()) throw new Error('Idempotency key is required.');
}

/** Server-only seam for a transactional database implementation. */
export const productionBookingRepository: ProductionBookingRepository = {
  async createBooking(session, input) {
    assertProductionBackendConfigured();
    if (!session.roles.includes('customer')) throw new Error('Customer role is required.');
    validateCreateBookingInput(input);
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from('bookings').select('*').eq('idempotency_key', input.idempotency_key).maybeSingle();
    if (existing) return mapBooking(existing as Record<string, unknown>);
    const providerColumn = input.provider_type === 'professional' ? 'professional_id' : 'business_id';
    const { data: service, error: serviceError } = await supabase.from('services').select('id,name,provider_type,professional_id,business_id,active').eq('id', input.service_id).eq('active', true).maybeSingle();
    if (serviceError || !service || service.provider_type !== input.provider_type || service[providerColumn] !== input.provider_id) throw new Error('Service or provider is unavailable.');
    await assertBookingAvailability(input);
    const providerFields = input.provider_type === 'professional' ? { professional_id: input.provider_id, business_id: null } : { professional_id: null, business_id: input.provider_id };
    const { data, error } = await supabase.from('bookings').insert({ booking_reference: createBookingReference(input.booking_date), idempotency_key: input.idempotency_key, customer_id: session.user_id, service_id: input.service_id, provider_type: input.provider_type, ...providerFields, service_name_snapshot: service.name, booking_date: input.booking_date, start_time: input.start_time, timezone: input.timezone, duration_minutes: input.duration_minutes, location: input.location.trim(), customer_notes: input.customer_notes?.trim() || null, quoted_price: input.quoted_price, currency: input.currency, status: 'pending', payment_status: 'unpaid' }).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'Booking could not be created.');
    return mapBooking(data as Record<string, unknown>);
  },
  async getBookingById(session, bookingId) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).eq('customer_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBooking(data) : null;
  },
  async getCustomerBookings(session) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('bookings').select('*').eq('customer_id', session.user_id).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapBooking);
  },
  async updateBookingStatus(session, bookingId, status, reason) {
    assertProductionBackendConfigured();
    if (status !== 'cancelled') throw new Error('Customer status updates are limited to cancellation.');
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('cancel_owned_booking', { target_booking_id: bookingId, cancel_reason: reason ?? null }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Booking could not be updated.');
    return mapBooking(data as Record<string, unknown>);
  },
  async rescheduleBooking(session, bookingId, input) {
    assertProductionBackendConfigured();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.booking_date) || !/^\d{2}:\d{2}/.test(input.start_time)) throw new Error('New booking date and time are required.');
    const current = await this.getBookingById(session, bookingId);
    if (!current) throw new Error('Booking not found.');
    if (!['pending', 'confirmed', 'rescheduled'].includes(current.status)) throw new Error(`Booking cannot be rescheduled from status ${current.status}.`);
    const availabilityInput: CreateBookingInput = {
      service_id: current.service_id,
      provider_id: current.provider.provider_id,
      provider_type: current.provider.provider_type,
      booking_date: input.booking_date,
      start_time: input.start_time,
      timezone: current.timezone,
      duration_minutes: current.duration_minutes,
      location: current.location,
      customer_notes: current.customer_notes,
      quoted_price: current.quoted_price,
      currency: current.currency,
      idempotency_key: `reschedule:${bookingId}:${input.booking_date}:${input.start_time}`,
      service_name: current.service_name,
    };
    await assertBookingAvailability(availabilityInput, bookingId);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('reschedule_owned_booking', {
      target_booking_id: bookingId,
      new_booking_date: input.booking_date,
      new_start_time: input.start_time,
      reschedule_reason: input.reason ?? null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Booking could not be rescheduled.');
    return mapBooking(data as Record<string, unknown>);
  },
};

function createBookingReference(date: string) { return `TIS-${date.replace(/-/g, '').slice(0, 8)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`; }

function mapBooking(row: Record<string, unknown>): ProductionBooking {
  const providerType = row.provider_type as 'professional' | 'business';
  return { id: row.id as EntityId, booking_reference: row.booking_reference as string, customer_id: row.customer_id as EntityId, service_id: row.service_id as EntityId, provider: providerType === 'professional' ? { provider_type: providerType, provider_id: row.professional_id as EntityId, professional_id: row.professional_id as EntityId } : { provider_type: providerType, provider_id: row.business_id as EntityId, business_id: row.business_id as EntityId }, service_name: row.service_name_snapshot as string, booking_date: row.booking_date as string, start_time: row.start_time as string, timezone: row.timezone as string, duration_minutes: row.duration_minutes as number, location: row.location as string, customer_notes: row.customer_notes as string | undefined, quoted_price: Number(row.quoted_price), currency: row.currency as 'INR' | 'USD', status: row.status as ProductionBooking['status'], payment_status: row.payment_status as ProductionBooking['payment_status'], created_at: new Date(row.created_at as string), updated_at: new Date(row.updated_at as string) };
}
