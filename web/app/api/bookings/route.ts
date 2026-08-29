import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { productionBookingRepository, type CreateBookingInput } from '../../../server/bookings/repository';
import { assertCustomerIsNotProviderOwner } from '../../../server/bookings/ownership';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const bookings = await productionBookingRepository.getCustomerBookings(session);
    const bookingIds = bookings.map((booking) => booking.id);
    const closeoutByBooking = new Map<string, { attendance_outcome: string; state: string; closed_at: string | null }>();

    if (bookingIds.length) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('booking_closeouts')
        .select('booking_id,attendance_outcome,state,closed_at')
        .in('booking_id', bookingIds);
      if (error) throw new Error(error.message);
      for (const closeout of data ?? []) {
        closeoutByBooking.set(String(closeout.booking_id), {
          attendance_outcome: String(closeout.attendance_outcome),
          state: String(closeout.state),
          closed_at: closeout.closed_at ? String(closeout.closed_at) : null,
        });
      }
    }

    return NextResponse.json({
      bookings: bookings.map((booking) => {
        const closeout = closeoutByBooking.get(String(booking.id));
        return closeout ? {
          ...booking,
          attendance_outcome: closeout.attendance_outcome,
          closeout_state: closeout.state,
          closed_at: closeout.closed_at,
        } : booking;
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load bookings.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const input = await request.json() as CreateBookingInput;
    await assertCustomerIsNotProviderOwner(session, input.provider_type, input.provider_id);
    const booking = await productionBookingRepository.createBooking(session, input);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create booking.' }, { status: 400 });
  }
}
