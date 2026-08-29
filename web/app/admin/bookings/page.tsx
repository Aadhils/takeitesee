import Link from 'next/link';
import { AdminHeading, AdminShell } from '../../../components/admin/AdminPresentation';
import { Badge, Card, EmptyState } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { productionAuthProvider } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveBooking = {
  id: string;
  booking_reference: string;
  service_name_snapshot: string;
  booking_date: string;
  start_time: string;
  location: string;
  status: string;
  payment_status: string;
  quoted_price: number | string;
  currency: string;
  created_at: string;
};

function toneForStatus(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'confirmed' || status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'pending' || status === 'rescheduled') return 'warning';
  return 'info';
}

function toneForPayment(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'refunded') return 'info';
  if (status === 'unpaid' || status === 'pending') return 'warning';
  return 'neutral';
}

function formatAmount(value: number | string, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default async function AdminBookingsRoute() {
  await productionAuthProvider.requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: mappedScopes, error: scopeError } = await supabase
    .from('service_ecosystem_scope')
    .select('service_id')
    .eq('enabled', true);

  if (scopeError) throw new Error(scopeError.message);

  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let bookings: LiveBooking[] = [];

  if (serviceIds.length) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id,booking_reference,service_name_snapshot,booking_date,start_time,location,status,payment_status,quoted_price,currency,created_at')
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    bookings = (data ?? []) as LiveBooking[];
  }

  return (
    <AdminShell active="/admin/bookings">
      <AdminHeading
        eyebrow="Scoped marketplace operations"
        title="Live booking management"
        description="Bookings shown here come from Supabase and are restricted to services inside this administrator’s assigned scope."
      />

      {bookings.length ? (
        <div className="admin-record-grid">
          {bookings.map((booking) => (
            <Card className="admin-booking-card" key={booking.id}>
              <div className="admin-record-top">
                <div>
                  <span className="eyebrow">{booking.booking_reference}</span>
                  <h2>{booking.service_name_snapshot}</h2>
                </div>
                <Badge tone={toneForStatus(booking.status)}>{booking.status.replaceAll('_', ' ')}</Badge>
              </div>
              <p>{booking.location || 'Location not specified'}</p>
              <dl className="admin-record-details">
                <div><dt>Date/time</dt><dd>{booking.booking_date} · {booking.start_time}</dd></div>
                <div><dt>Amount</dt><dd>{formatAmount(booking.quoted_price, booking.currency)}</dd></div>
                <div><dt>Payment</dt><dd><Badge tone={toneForPayment(booking.payment_status)}>{booking.payment_status.replaceAll('_', ' ')}</Badge></dd></div>
              </dl>
              <div className="admin-actions">
                <Link href={`/admin/bookings/${encodeURIComponent(booking.id)}`} className="text-link">Open unified audit</Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState title="No scoped bookings yet">Bookings will appear automatically when customers book services inside this administrator scope.</EmptyState>
        </Card>
      )}
    </AdminShell>
  );
}
