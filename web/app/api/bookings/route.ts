import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { productionBookingRepository, type CreateBookingInput } from '../../../server/bookings/repository';

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
    const booking = await productionBookingRepository.createBooking(session, input);
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create booking.' }, { status: 400 });
  }
}
