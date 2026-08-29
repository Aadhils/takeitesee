import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { productionProviderBookingRepository } from '../../../../../server/provider-bookings/repository';
import { transitionProviderBookingStatus } from '../../../../../server/provider-bookings/status-transition';
import type { EntityId } from '../../../../../types/entities';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const booking = await productionProviderBookingRepository.getById(session, bookingId as EntityId);
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ booking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking.' }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const body = await request.json() as { action?: 'accept' | 'decline' | 'complete'; reason?: string };
    if (!body.action || !['accept', 'decline', 'complete'].includes(body.action)) {
      return NextResponse.json({ error: 'A valid provider action is required.' }, { status: 400 });
    }
    if (body.action === 'decline') {
      const reason = body.reason?.trim() ?? '';
      if (reason.length < 3) return NextResponse.json({ error: 'A decline reason is required.' }, { status: 400 });
      if (reason.length > 500) return NextResponse.json({ error: 'Decline reason must be 500 characters or fewer.' }, { status: 400 });
    }
    const booking = await transitionProviderBookingStatus(session, bookingId as EntityId, body.action, body.reason);
    return NextResponse.json({ booking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update booking.' }, { status: 400 });
  }
}
