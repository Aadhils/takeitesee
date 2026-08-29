import { NextResponse } from 'next/server';
import { loadServiceSlotAvailability } from '../../../../../server/bookings/slot-availability';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ serviceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { serviceId } = await context.params;
    const availability = await loadServiceSlotAvailability(serviceId);
    return NextResponse.json(availability);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking availability.' }, { status: 400 });
  }
}
