import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { productionBookingRepository, type CreateBookingInput } from '../../../server/bookings/repository';
import { assertCustomerIsNotProviderOwner } from '../../../server/bookings/ownership';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    return NextResponse.json({ bookings: await productionBookingRepository.getCustomerBookings(session) });
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
