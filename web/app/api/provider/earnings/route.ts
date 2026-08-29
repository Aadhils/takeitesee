import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

type BookingRow = {
  id: string;
  booking_reference: string;
  service_name_snapshot: string | null;
  quoted_price: number | string | null;
  currency: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  booking_date: string | null;
  created_at: string;
};

function amountOf(value: BookingRow['quoted_price']) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sourceDateOf(booking: BookingRow) {
  return booking.booking_date ? new Date(`${booking.booking_date}T00:00:00Z`) : new Date(booking.created_at);
}

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();

    let providerType: 'professional' | 'business';
    let providerId: string;

    if (session.roles.includes('professional')) {
      const { data, error } = await supabase.from('professional_profiles').select('id').eq('user_id', session.user_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Professional profile is required.');
      providerType = 'professional';
      providerId = data.id as string;
    } else {
      const { data, error } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Business profile is required.');
      providerType = 'business';
      providerId = data.id as string;
    }

    let query = supabase
      .from('bookings')
      .select('id,booking_reference,service_name_snapshot,quoted_price,currency,status,payment_status,booking_date,created_at')
      .order('created_at', { ascending: false });
    query = providerType === 'professional' ? query.eq('professional_id', providerId) : query.eq('business_id', providerId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const bookings = (data ?? []) as BookingRow[];
    const now = new Date();
    const month = now.getUTCMonth();
    const year = now.getUTCFullYear();

    const completed = bookings.filter((booking) => booking.status === 'completed');
    const paidCompleted = completed.filter((booking) => booking.payment_status === 'paid');
    const awaitingPayment = completed.filter((booking) => booking.payment_status === 'unpaid' || booking.payment_status === 'pending');
    const failedCompleted = completed.filter((booking) => booking.payment_status === 'failed');
    const refunded = bookings.filter((booking) => booking.payment_status === 'refunded');
    const paidThisMonth = paidCompleted.filter((booking) => {
      const sourceDate = sourceDateOf(booking);
      return sourceDate.getUTCFullYear() === year && sourceDate.getUTCMonth() === month;
    });

    const currency = bookings.find((booking) => booking.currency)?.currency ?? 'INR';
    const sum = (items: BookingRow[]) => Number(items.reduce((total, booking) => total + amountOf(booking.quoted_price), 0).toFixed(2));

    const activity = bookings.slice(0, 30).map((booking) => ({
      id: booking.id,
      booking_reference: booking.booking_reference,
      service_name: booking.service_name_snapshot ?? 'Service booking',
      amount: amountOf(booking.quoted_price),
      currency: booking.currency ?? currency,
      booking_status: booking.status,
      payment_status: booking.payment_status,
      booking_date: booking.booking_date,
      created_at: booking.created_at,
    }));

    return NextResponse.json({
      summary: {
        currency,
        available_balance: sum(paidCompleted),
        available_count: paidCompleted.length,
        pending_earnings: sum(awaitingPayment),
        pending_count: awaitingPayment.length,
        failed_amount: sum(failedCompleted),
        failed_count: failedCompleted.length,
        refunded_amount: sum(refunded),
        refunded_count: refunded.length,
        gross_completed_value: sum(completed),
        gross_completed_count: completed.length,
        this_month: sum(paidThisMonth),
        this_month_count: paidThisMonth.length,
        total_earnings: sum(paidCompleted),
        total_completed_count: paidCompleted.length,
      },
      activity,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider earnings.' }, { status: 401 });
  }
}
