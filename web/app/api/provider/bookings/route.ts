import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { productionProviderBookingRepository } from '../../../../server/provider-bookings/repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const bookings = await productionProviderBookingRepository.list(session);
    return NextResponse.json({ bookings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider bookings.' }, { status: 401 });
  }
}
