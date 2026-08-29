import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { getBookingAuditReadModel } from '../../../../../server/bookings/audit';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { bookingId } = await params;
    const audit = await getBookingAuditReadModel(bookingId);
    if (!audit) return NextResponse.json({ error: 'Booking not found or not accessible.' }, { status: 404 });

    return NextResponse.json(audit);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking audit.' }, { status: 400 });
  }
}
