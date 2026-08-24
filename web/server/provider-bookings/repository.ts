import type { EntityId } from '../../types/entities';
import type { ProductionBookingStatus, ProductionPaymentStatus, ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';

export interface ProviderBookingRecord {
  id: EntityId;
  booking_reference: string;
  customer_id: EntityId;
  service_id: EntityId;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  status: ProductionBookingStatus;
  payment_status: ProductionPaymentStatus;
  provider_type: 'professional' | 'business';
  provider_id: EntityId;
  provider_name: string;
  created_at: string;
  updated_at: string;
}

type ProviderOwner =
  | { provider_type: 'professional'; provider_id: EntityId; provider_name: string }
  | { provider_type: 'business'; provider_id: EntityId; provider_name: string };

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtc;

  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    guess += targetUtc - representedUtc;
  }

  return guess;
}

function completionEligibleAt(row: Record<string, unknown>) {
  const start = zonedDateTimeToEpoch(String(row.booking_date), String(row.start_time), String(row.timezone || 'Asia/Kolkata'));
  return start + Number(row.duration_minutes || 0) * 60_000;
}

async function resolveOwner(session: ServerCustomerSession): Promise<ProviderOwner> {
  const supabase = await createSupabaseServerClient();
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select('id,headline').eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return { provider_type: 'professional', provider_id: data.id as EntityId, provider_name: (data.headline as string | null) || 'Professional' };
  }
  if (session.roles.includes('business_owner')) {
    const { data, error } = await supabase.from('businesses').select('id,name').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Business profile is required.');
    return { provider_type: 'business', provider_id: data.id as EntityId, provider_name: (data.name as string | null) || 'Business' };
  }
  throw new Error('Provider role is required.');
}

function mapBooking(row: Record<string, unknown>, owner: ProviderOwner): ProviderBookingRecord {
  return {
    id: row.id as EntityId,
    booking_reference: row.booking_reference as string,
    customer_id: row.customer_id as EntityId,
    service_id: row.service_id as EntityId,
    service_name: row.service_name_snapshot as string,
    booking_date: row.booking_date as string,
    start_time: row.start_time as string,
    timezone: row.timezone as string,
    duration_minutes: Number(row.duration_minutes),
    location: row.location as string,
    customer_notes: (row.customer_notes as string | null) || undefined,
    quoted_price: Number(row.quoted_price),
    currency: row.currency as 'INR' | 'USD',
    status: row.status as ProductionBookingStatus,
    payment_status: row.payment_status as ProductionPaymentStatus,
    provider_type: owner.provider_type,
    provider_id: owner.provider_id,
    provider_name: owner.provider_name,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function ownedBookingQuery(owner: ProviderOwner, bookingId: EntityId) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('bookings').select('*').eq('id', bookingId);
  query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.provider_id) : query.eq('business_id', owner.provider_id);
  return query.maybeSingle();
}

export const productionProviderBookingRepository = {
  async list(session: ServerCustomerSession): Promise<ProviderBookingRecord[]> {
    assertProductionBackendConfigured();
    const owner = await resolveOwner(session);
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.provider_id) : query.eq('business_id', owner.provider_id);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapBooking(row as Record<string, unknown>, owner));
  },

  async getById(session: ServerCustomerSession, bookingId: EntityId): Promise<ProviderBookingRecord | null> {
    assertProductionBackendConfigured();
    const owner = await resolveOwner(session);
    const { data, error } = await ownedBookingQuery(owner, bookingId);
    if (error) throw new Error(error.message);
    return data ? mapBooking(data as Record<string, unknown>, owner) : null;
  },

  async updateStatus(session: ServerCustomerSession, bookingId: EntityId, action: 'accept' | 'decline' | 'complete'): Promise<ProviderBookingRecord> {
    assertProductionBackendConfigured();
    const owner = await resolveOwner(session);
    const supabase = await createSupabaseServerClient();
    const expectedStatus: ProductionBookingStatus = action === 'complete' ? 'confirmed' : 'pending';
    const nextStatus: ProductionBookingStatus = action === 'accept' ? 'confirmed' : action === 'complete' ? 'completed' : 'cancelled';

    if (action === 'complete') {
      const { data: current, error: currentError } = await ownedBookingQuery(owner, bookingId);
      if (currentError) throw new Error(currentError.message);
      if (!current || current.status !== 'confirmed') throw new Error('Only a confirmed booking can be completed.');
      const eligibleAt = completionEligibleAt(current as Record<string, unknown>);
      if (Date.now() < eligibleAt) {
        const label = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: String(current.timezone || 'Asia/Kolkata') }).format(new Date(eligibleAt));
        throw new Error(`This service can be marked completed after the scheduled service time (${label}).`);
      }
    }

    let query = supabase.from('bookings').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', bookingId).eq('status', expectedStatus);
    query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.provider_id) : query.eq('business_id', owner.provider_id);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Booking was not found, is no longer ${expectedStatus}, or is not owned by this provider.`);
    return mapBooking(data as Record<string, unknown>, owner);
  },
};
