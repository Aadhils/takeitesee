import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { productionBookingRepository } from '../../../../../server/bookings/repository';
import { loadServiceSlotAvailability } from '../../../../../server/bookings/slot-availability';
import type { EntityId } from '../../../../../types/entities';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const session = await productionAuthProvider.requireCustomer(request);
    const booking = await productionBookingRepository.getBookingById(session, bookingId as EntityId);
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (!['pending', 'confirmed', 'rescheduled'].includes(booking.status)) {
      return NextResponse.json({ error: `This ${booking.status} booking cannot be rescheduled.` }, { status: 400 });
    }

    const availability = await loadServiceSlotAvailability(booking.service_id, { excludeOwnedBookingId: bookingId });
    return NextResponse.json(availability);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load reschedule availability.' }, { status: 400 });
  }
}
