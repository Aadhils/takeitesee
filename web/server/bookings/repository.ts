import type { EntityId } from '../../types/entities';
import type { ProductionBooking, ProductionBookingStatus, ServerCustomerSession } from '../../types/production-domain';
import { assertProductionBackendConfigured } from '../config';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertBookingAvailability } from './availability';
import { normalizeBookingTime } from './time';

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

export interface RescheduleBookingInput { booking_date: string; start_time: string; reason: string; }

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
  const bookingDate = new Date(`${input.booking_date}T12:00:00Z`);
  if (Number.isNaN(bookingDate.getTime())) throw new Error('Booking date is invalid.');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (bookingDate.getTime() < today.getTime()) throw new Error('Booking date cannot be in the past.');
  normalizeBookingTime(input.start_time);
  if (!input.timezone?.trim()) throw new Error('Booking timezone is required.');
  if (!input.location?.trim()) throw new Error('Booking location is required.');
  if (!input.idempotency_key?.trim()) throw new Error('Idempotency key is required.');
}

const bookingSelect = '*, businesses(name), professional_profiles(headline)';

export const productionBookingRepository: ProductionBookingRepository = {
  async createBooking(session, input) {
    assertProductionBackendConfigured();
    if (!session.roles.includes('customer')) throw new Error('Customer role is required.');
    validateCreateBookingInput(input);
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
      .from('bookings')
      .select(bookingSelect)
      .eq('customer_id', session.user_id)
      .eq('idempotency_key', input.idempotency_key)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return mapBooking(existing as Record<string, unknown>);

    const providerColumn = input.provider_type === 'professional' ? 'professional_id' : 'business_id';
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id,name,provider_type,professional_id,business_id,active,status,duration_minutes,base_price,currency,location')
      .eq('id', input.service_id)
      .eq('active', true)
      .eq('status', 'active')
      .maybeSingle();
    if (serviceError || !service || service.provider_type !== input.provider_type || service[providerColumn] !== input.provider_id) {
      throw new Error('Service or provider is unavailable.');
    }

    const durationMinutes = Number(service.duration_minutes);
    const quotedPrice = Number(service.base_price);
    const currency = String(service.currency || 'INR') as CreateBookingInput['currency'];
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error('Service duration is not configured.');
    if (!Number.isFinite(quotedPrice) || quotedPrice < 0) throw new Error('Service price is not configured.');
    if (!['INR', 'USD'].includes(currency)) throw new Error('Service currency is not supported.');

    const { data: availabilitySetting, error: availabilitySettingError } = await supabase
      .from('service_availability')
      .select('timezone')
      .eq('service_id', input.service_id)
      .maybeSingle();
    if (availabilitySettingError) throw new Error(availabilitySettingError.message);

    const canonicalInput: CreateBookingInput = {
      ...input,
      start_time: normalizeBookingTime(input.start_time),
      timezone: String(availabilitySetting?.timezone ?? 'Asia/Kolkata'),
      duration_minutes: durationMinutes,
      location: String(service.location || input.location).trim(),
      quoted_price: quotedPrice,
      currency,
      service_name: String(service.name),
    };

    await assertBookingAvailability(canonicalInput);
    const providerFields = canonicalInput.provider_type === 'professional'
      ? { professional_id: canonicalInput.provider_id, business_id: null }
      : { professional_id: null, business_id: canonicalInput.provider_id };

    const { data, error } = await supabase.from('bookings').insert({
      booking_reference: createBookingReference(canonicalInput.booking_date),
      idempotency_key: canonicalInput.idempotency_key,
      customer_id: session.user_id,
      service_id: canonicalInput.service_id,
      provider_type: canonicalInput.provider_type,
      ...providerFields,
      service_name_snapshot: canonicalInput.service_name,
      booking_date: canonicalInput.booking_date,
      start_time: canonicalInput.start_time,
      timezone: canonicalInput.timezone,
      duration_minutes: canonicalInput.duration_minutes,
      location: canonicalInput.location,
      customer_notes: canonicalInput.customer_notes?.trim() || null,
      quoted_price: canonicalInput.quoted_price,
      currency: canonicalInput.currency,
      status: 'pending',
      payment_status: 'unpaid',
    }).select(bookingSelect).single();
    if (error || !data) throw new Error(error?.message ?? 'Booking could not be created.');
    return mapBooking(data as Record<string, unknown>);
  },

  async getBookingById(session, bookingId) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('bookings').select(bookingSelect).eq('id', bookingId).eq('customer_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBooking(data as Record<string, unknown>) : null;
  },

  async getCustomerBookings(session) {
    assertProductionBackendConfigured();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('bookings').select(bookingSelect).eq('customer_id', session.user_id).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapBooking(row as Record<string, unknown>));
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.booking_date)) throw new Error('New booking date is required.');
    const bookingDate = new Date(`${input.booking_date}T12:00:00Z`);
    if (Number.isNaN(bookingDate.getTime())) throw new Error('New booking date is invalid.');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (bookingDate.getTime() < today.getTime()) throw new Error('New booking date cannot be in the past.');

    const reason = input.reason?.trim() ?? '';
    if (reason.length < 3) throw new Error('A reschedule reason is required.');
    if (reason.length > 500) throw new Error('Reschedule reason must be 500 characters or fewer.');

    const normalizedStartTime = normalizeBookingTime(input.start_time);
    const current = await this.getBookingById(session, bookingId);
    if (!current) throw new Error('Booking not found.');
    if (!['pending', 'confirmed', 'rescheduled'].includes(current.status)) throw new Error(`Booking cannot be rescheduled from status ${current.status}.`);
    if (current.booking_date === input.booking_date && normalizeBookingTime(current.start_time) === normalizedStartTime) {
      throw new Error('Choose a different date or time to reschedule.');
    }

    const availabilityInput: CreateBookingInput = {
      service_id: current.service_id,
      provider_id: current.provider.provider_id,
      provider_type: current.provider.provider_type,
      booking_date: input.booking_date,
      start_time: normalizedStartTime,
      timezone: current.timezone,
      duration_minutes: current.duration_minutes,
      location: current.location,
      customer_notes: current.customer_notes,
      quoted_price: current.quoted_price,
      currency: current.currency,
      idempotency_key: `reschedule:${bookingId}:${input.booking_date}:${normalizedStartTime}`,
      service_name: current.service_name,
    };
    await assertBookingAvailability(availabilityInput, bookingId);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('reschedule_owned_booking', {
      target_booking_id: bookingId,
      new_booking_date: input.booking_date,
      new_start_time: normalizedStartTime,
      reschedule_reason: reason,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Booking could not be rescheduled.');
    const refreshed = await this.getBookingById(session, bookingId);
    return refreshed ?? mapBooking(data as Record<string, unknown>);
  },
};

function createBookingReference(date: string) {
  return `TIS-${date.replace(/-/g, '').slice(0, 8)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function relatedName(value: unknown, key: 'name' | 'headline') {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && key in row ? String((row as Record<string, unknown>)[key] ?? '') : '';
}

function mapBooking(row: Record<string, unknown>): ProductionBooking {
  const providerType = row.provider_type as 'professional' | 'business';
  const providerName = providerType === 'business' ? relatedName(row.businesses, 'name') : relatedName(row.professional_profiles, 'headline');
  return {
    id: row.id as EntityId,
    booking_reference: row.booking_reference as string,
    customer_id: row.customer_id as EntityId,
    service_id: row.service_id as EntityId,
    provider: providerType === 'professional'
      ? { provider_type: providerType, provider_id: row.professional_id as EntityId, professional_id: row.professional_id as EntityId }
      : { provider_type: providerType, provider_id: row.business_id as EntityId, business_id: row.business_id as EntityId },
    provider_name: providerName || undefined,
    service_name: row.service_name_snapshot as string,
    booking_date: row.booking_date as string,
    start_time: row.start_time as string,
    timezone: row.timezone as string,
    duration_minutes: row.duration_minutes as number,
    location: row.location as string,
    customer_notes: row.customer_notes as string | undefined,
    quoted_price: Number(row.quoted_price),
    currency: row.currency as 'INR' | 'USD',
    status: row.status as ProductionBooking['status'],
    payment_status: row.payment_status as ProductionBooking['payment_status'],
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}
