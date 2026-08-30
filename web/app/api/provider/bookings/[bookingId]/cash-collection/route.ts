import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';
import { productionProviderBookingRepository } from '../../../../../../server/provider-bookings/repository';
import type { EntityId } from '../../../../../../types/entities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CashCollectionRow = {
  payment_status: string;
  payment_method: 'unselected' | 'online_gateway' | 'cash_on_service';
  cash_collected_at: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const owned = await productionProviderBookingRepository.getById(session, bookingId as EntityId);
    if (!owned) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('id,status,payment_status,payment_method,cash_collected_at')
      .eq('id', bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    return NextResponse.json({
      booking_status: data.status,
      payment_status: data.payment_status,
      payment_method: data.payment_method,
      cash_collected_at: data.cash_collected_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load cash collection status.' }, { status: 401 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const { bookingId } = await context.params;
    const body = await request.json().catch(() => ({})) as { note?: string };
    const owned = await productionProviderBookingRepository.getById(session, bookingId as EntityId);
    if (!owned) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('provider_confirm_cash_collection', {
      target_booking_id: bookingId,
      collection_note: body.note?.trim() || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Cash collection could not be confirmed.');
    const updated = data as unknown as CashCollectionRow;

    return NextResponse.json({
      payment_status: updated.payment_status,
      payment_method: updated.payment_method,
      cash_collected_at: updated.cash_collected_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cash collection could not be confirmed.';
    const status = /authentication|ownership|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
