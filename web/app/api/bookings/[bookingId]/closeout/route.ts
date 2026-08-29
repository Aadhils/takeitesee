import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { getBookingCloseoutReadModel } from '../../../../../server/bookings/closeout';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { bookingId } = await params;
    const closeout = await getBookingCloseoutReadModel(bookingId, session.user_id);
    if (!closeout) return NextResponse.json({ error: 'Booking not found or not accessible.' }, { status: 404 });
    return NextResponse.json(closeout);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking closeout.' }, { status: 400 });
  }
}
