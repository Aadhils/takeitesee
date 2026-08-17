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
    const body = await request.json() as { status?: 'cancelled'; reason?: string };
    if (body.status !== 'cancelled') return NextResponse.json({ error: 'Only cancellation is currently supported.' }, { status: 400 });
    const booking = await productionBookingRepository.updateBookingStatus(session, bookingId as EntityId, body.status, body.reason);
    return NextResponse.json({ booking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update booking.' }, { status: 400 });
  }
}
