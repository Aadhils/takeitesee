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

async function resolveOwner(session: ServerCustomerSession): Promise<ProviderOwner> {
  const supabase = await createSupabaseServerClient();
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase.from('professional_profiles').select('id,display_name').eq('user_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required.');
    return { provider_type: 'professional', provider_id: data.id as EntityId, provider_name: (data.display_name as string | null) || 'Professional' };
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

  async updateStatus(session: ServerCustomerSession, bookingId: EntityId, action: 'accept' | 'decline'): Promise<ProviderBookingRecord> {
    assertProductionBackendConfigured();
    const owner = await resolveOwner(session);
    const supabase = await createSupabaseServerClient();
    const nextStatus: ProductionBookingStatus = action === 'accept' ? 'confirmed' : 'cancelled';
    let query = supabase.from('bookings').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', bookingId).eq('status', 'pending');
    query = owner.provider_type === 'professional' ? query.eq('professional_id', owner.provider_id) : query.eq('business_id', owner.provider_id);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Booking was not found, is no longer pending, or is not owned by this provider.');
    return mapBooking(data as Record<string, unknown>, owner);
  },
};
