import { productionAuthProvider } from '../../../../../server/auth/session';
import { productionBookingRepository } from '../../../../../server/bookings/repository';
import { bookingCalendarFilename, buildBookingCalendar } from '../../../../../server/bookings/calendar';
import type { EntityId } from '../../../../../types/entities';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const session = await productionAuthProvider.requireCustomer(request);
    const booking = await productionBookingRepository.getBookingById(session, bookingId as EntityId);
    if (!booking) return new Response(JSON.stringify({ error: 'Booking not found.' }), { status: 404, headers: { 'content-type': 'application/json' } });

    const calendar = buildBookingCalendar(booking);
    return new Response(calendar, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `attachment; filename="${bookingCalendarFilename(booking.booking_reference)}"`,
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export booking calendar.';
    const authenticationFailure = /auth|session|sign in|customer/i.test(message);
    return new Response(JSON.stringify({ error: message }), {
      status: authenticationFailure ? 401 : 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}
