import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type FinanceOverview = {
  policies?: Array<{
    currency: string;
    active: boolean;
    commission_bps: number;
    settlement_hold_days: number;
    minimum_payout_minor: number;
    version: number;
    updated_at: string;
  }>;
  summary?: {
    gross_minor?: number;
    platform_fee_minor?: number;
    provider_net_minor?: number;
    held_minor?: number;
    available_minor?: number;
    assigned_minor?: number;
    paid_minor?: number;
    reversed_minor?: number;
    settlement_count?: number;
    available_count?: number;
  };
  settlements?: Array<Record<string, unknown>>;
  payouts?: Array<Record<string, unknown>>;
};

function amountOf(value: BookingRow['quoted_price']) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
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
      providerType = 'professional'; providerId = data.id as string;
    } else {
      const { data, error } = await supabase.from('businesses').select('id').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Business profile is required.');
      providerType = 'business'; providerId = data.id as string;
    }

    let bookingsQuery = supabase
      .from('bookings')
      .select('id,booking_reference,service_name_snapshot,quoted_price,currency,status,payment_status,booking_date,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    bookingsQuery = providerType === 'professional' ? bookingsQuery.eq('professional_id', providerId) : bookingsQuery.eq('business_id', providerId);

    const [bookingResult, financeResult] = await Promise.all([
      bookingsQuery,
      supabase.rpc('get_my_provider_finance_overview'),
    ]);
    if (bookingResult.error) throw new Error(bookingResult.error.message);
    if (financeResult.error) throw new Error(financeResult.error.message);

    const bookings = (bookingResult.data ?? []) as BookingRow[];
    const completed = bookings.filter((booking) => booking.status === 'completed');
    const paidCompleted = completed.filter((booking) => booking.payment_status === 'paid');
    const awaitingPayment = completed.filter((booking) => ['unpaid', 'pending'].includes(booking.payment_status));
    const currency = bookings.find((booking) => booking.currency)?.currency ?? 'INR';
    const sum = (items: BookingRow[]) => Number(items.reduce((total, booking) => total + amountOf(booking.quoted_price), 0).toFixed(2));

    return NextResponse.json({
      finance: (financeResult.data ?? {}) as FinanceOverview,
      booking_summary: {
        currency,
        completed_paid_gross: sum(paidCompleted),
        completed_paid_count: paidCompleted.length,
        awaiting_payment_gross: sum(awaitingPayment),
        awaiting_payment_count: awaitingPayment.length,
        completed_gross: sum(completed),
        completed_count: completed.length,
      },
      activity: bookings.map((booking) => ({
        id: booking.id,
        booking_reference: booking.booking_reference,
        service_name: booking.service_name_snapshot ?? 'Service booking',
        amount: amountOf(booking.quoted_price),
        currency: booking.currency ?? currency,
        booking_status: booking.status,
        payment_status: booking.payment_status,
        booking_date: booking.booking_date,
        created_at: booking.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider earnings.' }, { status: 401 });
  }
}
