import Link from 'next/link';
import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveShell, AdminLiveStatusText, AdminLiveText } from '../../../components/admin/AdminLiveChrome';
import { Badge, Card } from '../../../components/ui/primitives';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { getAdminSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

type LiveBooking = { id: string; booking_reference: string; service_name_snapshot: string; booking_date: string; start_time: string; location: string; status: string; payment_status: string; quoted_price: number | string; currency: string; created_at: string; };
function toneForStatus(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (status === 'confirmed' || status === 'completed') return 'success'; if (status === 'cancelled') return 'danger'; if (status === 'pending' || status === 'rescheduled') return 'warning'; return 'info'; }
function toneForPayment(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (status === 'paid') return 'success'; if (status === 'failed') return 'danger'; if (status === 'refunded') return 'info'; if (status === 'unpaid' || status === 'pending') return 'warning'; return 'neutral'; }
function formatAmount(value: number | string, currency: string) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(Number(value || 0)); }

export default async function AdminBookingsRoute() {
  if (!await getAdminSessionOrNull()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: mappedScopes, error: scopeError } = await supabase.from('service_ecosystem_scope').select('service_id').eq('enabled', true);
  if (scopeError) throw new Error(scopeError.message);
  const serviceIds = Array.from(new Set((mappedScopes ?? []).map((row) => String(row.service_id))));
  let bookings: LiveBooking[] = [];
  if (serviceIds.length) { const { data, error } = await supabase.from('bookings').select('id,booking_reference,service_name_snapshot,booking_date,start_time,location,status,payment_status,quoted_price,currency,created_at').in('service_id', serviceIds).order('created_at', { ascending: false }).limit(200); if (error) throw new Error(error.message); bookings = (data ?? []) as LiveBooking[]; }

  return <AdminLiveShell active="/admin/bookings">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped marketplace operations" ta="Scope செய்யப்பட்ட marketplace செயல்பாடுகள்" />} title={<AdminLiveText en="Live booking management" ta="நேரடி booking நிர்வாகம்" />} description={<AdminLiveText en="Bookings shown here come from Supabase and are restricted to services inside this administrator’s assigned scope." ta="இங்கே காட்டப்படும் bookings Supabase-லிருந்து வந்து, இந்த admin-க்கு assign செய்யப்பட்ட scope உள்ள services-க்கு மட்டும் கட்டுப்படுத்தப்படுகின்றன." />} />
    {bookings.length ? <div className="admin-record-grid">{bookings.map((booking) => <Card className="admin-booking-card" key={booking.id}><div className="admin-record-top"><div><span className="eyebrow">{booking.booking_reference}</span><h2>{booking.service_name_snapshot}</h2></div><Badge tone={toneForStatus(booking.status)}><AdminLiveStatusText status={booking.status} /></Badge></div><p>{booking.location || <AdminLiveText en="Location not specified" ta="இடம் குறிப்பிடப்படவில்லை" />}</p><dl className="admin-record-details"><div><dt><AdminLiveText en="Date/time" ta="தேதி/நேரம்" /></dt><dd>{booking.booking_date} · {booking.start_time}</dd></div><div><dt><AdminLiveText en="Amount" ta="தொகை" /></dt><dd>{formatAmount(booking.quoted_price, booking.currency)}</dd></div><div><dt><AdminLiveText en="Payment" ta="பணம்" /></dt><dd><Badge tone={toneForPayment(booking.payment_status)}><AdminLiveStatusText status={booking.payment_status} /></Badge></dd></div></dl><div className="admin-actions"><Link href={`/admin/bookings/${encodeURIComponent(booking.id)}`} className="text-link"><AdminLiveText en="Open unified audit" ta="Unified audit திற" /></Link></div></Card>)}</div> : <Card><AdminLiveEmptyState titleEn="No scoped bookings yet" titleTa="Scoped bookings இன்னும் இல்லை"><AdminLiveText en="Bookings will appear automatically when customers book services inside this administrator scope." ta="இந்த admin scope-இல் உள்ள services-ஐ customers book செய்ததும் bookings தானாக இங்கே வரும்." /></AdminLiveEmptyState></Card>}
  </AdminLiveShell>;
}
