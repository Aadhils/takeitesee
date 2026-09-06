import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getBookingCloseoutReadModel } from '../../../server/bookings/closeout';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const url = new URL(request.url);
    const bookingId = url.searchParams.get('bookingId');
    const supabase = await createSupabaseServerClient();

    if (!bookingId) {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,booking_id,service_id,rating,comment,status,provider_response,provider_responded_at,created_at')
        .eq('customer_id', session.user_id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return NextResponse.json({ reviews: data ?? [] });
    }

    const { data, error } = await supabase.from('reviews').select('*').eq('booking_id', bookingId).eq('customer_id', session.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ review: data ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load review.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const input = await request.json() as { booking_id?: string; rating?: number; comment?: string };
    if (!input.booking_id || !Number.isInteger(input.rating) || Number(input.rating) < 1 || Number(input.rating) > 5) return NextResponse.json({ error: 'A 1 to 5 star rating is required.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data: booking, error: bookingError } = await supabase.from('bookings').select('id,customer_id,service_id,provider_type,professional_id,business_id,status').eq('id', input.booking_id).eq('customer_id', session.user_id).maybeSingle();
    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'completed') return NextResponse.json({ error: 'Only completed bookings can be reviewed.' }, { status: 409 });

    const closeout = await getBookingCloseoutReadModel(String(booking.id), session.user_id);
    if (!closeout?.review_window_open) return NextResponse.json({ error: 'The review window for this booking has ended.' }, { status: 409 });

    const { data: existing } = await supabase.from('reviews').select('id').eq('booking_id', booking.id).maybeSingle();
    if (existing) return NextResponse.json({ error: 'You have already reviewed this booking.' }, { status: 409 });
    const { data, error } = await supabase.from('reviews').insert({ booking_id: booking.id, customer_id: session.user_id, service_id: booking.service_id, provider_type: booking.provider_type, professional_id: booking.professional_id, business_id: booking.business_id, rating: input.rating, comment: input.comment?.trim().slice(0, 1000) || null, status: 'published' }).select('*').single();
    if (error || !data) throw new Error(error?.message ?? 'Review could not be submitted.');
    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit review.' }, { status: 400 });
  }
}
