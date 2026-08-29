import type { EntityId } from '../../types/entities';
import type { ServerCustomerSession } from '../../types/production-domain';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { assertProductionBackendConfigured } from '../config';
import { productionProviderBookingRepository, type ProviderBookingRecord } from './repository';

type ProviderBookingAction = 'accept' | 'decline' | 'complete';

export async function transitionProviderBookingStatus(
  session: ServerCustomerSession,
  bookingId: EntityId,
  action: ProviderBookingAction,
  reason?: string,
): Promise<ProviderBookingRecord> {
  assertProductionBackendConfigured();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc('provider_update_booking_status', {
    p_booking_id: bookingId,
    p_action: action,
    p_reason: reason?.trim() || null,
  });

  if (error) throw new Error(error.message);

  const booking = await productionProviderBookingRepository.getById(session, bookingId);
  if (!booking) throw new Error('Booking status changed but the booking could not be reloaded.');
  return booking;
}
