import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { productionBookingRepository } from '../../../../server/bookings/repository';
import type { EntityId } from '../../../../types/entities';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const session = await productionAuthProvider.requireCustomer(request);
    const booking = await productionBookingRepository.getBookingById(session, bookingId as EntityId);
    return booking ? NextResponse.json({ booking }) : NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking.' }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const { bookingId } = await params;
    const session = await productionAuthProvider.requireCustomer(request);
    const body = await request.json() as { status?: 'cancelled' | 'rescheduled'; reason?: string; booking_date?: string; start_time?: string };
    if (body.status === 'cancelled') {
      const reason = body.reason?.trim() ?? '';
      if (reason.length < 3) return NextResponse.json({ error: 'A cancellation reason is required.' }, { status: 400 });
      if (reason.length > 500) return NextResponse.json({ error: 'Cancellation reason must be 500 characters or fewer.' }, { status: 400 });
      const booking = await productionBookingRepository.updateBookingStatus(session, bookingId as EntityId, body.status, reason);
      return NextResponse.json({ booking });
    }
    if (body.status === 'rescheduled') {
      if (!body.booking_date || !body.start_time) return NextResponse.json({ error: 'New booking date and time are required.' }, { status: 400 });
      const booking = await productionBookingRepository.rescheduleBooking(session, bookingId as EntityId, { booking_date: body.booking_date, start_time: body.start_time, reason: body.reason });
      return NextResponse.json({ booking });
    }
    return NextResponse.json({ error: 'Unsupported booking update.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update booking.' }, { status: 400 });
  }
}
