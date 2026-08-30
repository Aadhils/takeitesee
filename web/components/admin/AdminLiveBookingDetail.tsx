'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';
import { BookingAuditList, type BookingAuditPayload } from '../booking/BookingAuditTimeline';
import { AdminLiveHeading, AdminLiveShell, AdminLiveStatusText, AdminLiveText } from './AdminLiveChrome';
import AdminRefundPanel from './AdminRefundPanel';

function bookingTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (status === 'confirmed' || status === 'completed') return 'success'; if (status === 'cancelled') return 'danger'; if (status === 'pending' || status === 'rescheduled') return 'warning'; return 'info'; }
function paymentTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' { if (status === 'paid') return 'success'; if (status === 'failed') return 'danger'; if (status === 'pending' || status === 'unpaid') return 'warning'; if (status === 'refunded') return 'info'; return 'neutral'; }

export default function AdminLiveBookingDetail({ bookingId }: { bookingId: string }) {
  const { locale } = useLanguage();
  const [payload, setPayload] = useState<BookingAuditPayload | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); } catch { return `${currency} ${amount.toFixed(2)}`; } };

  useEffect(() => { const refresh = (event: Event) => { const detail = (event as CustomEvent<{ bookingId?: string }>).detail; if (!detail?.bookingId || detail.bookingId === bookingId) setRefreshKey((value) => value + 1); }; window.addEventListener('booking:audit-refresh', refresh); return () => window.removeEventListener('booking:audit-refresh', refresh); }, [bookingId]);
  useEffect(() => { let active = true; setError(''); void (async () => { try { const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/audit`, { cache: 'no-store' }); const body = await response.json() as BookingAuditPayload & { error?: string }; if (!response.ok || !body.booking || !Array.isArray(body.events)) throw new Error(body.error ?? 'Unable to load booking audit.'); if (active) setPayload(body); } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load booking audit.'); } })(); return () => { active = false; }; }, [bookingId, refreshKey]);

  const booking = payload?.booking;
  return <AdminLiveShell active="/admin/bookings">
    <AdminLiveHeading eyebrow={<AdminLiveText en="Scoped booking operations" ta="Scope செய்யப்பட்ட booking செயல்பாடுகள்" />} title={booking?.booking_reference ?? <AdminLiveText en="Booking audit" ta="Booking audit" />} description={<AdminLiveText en="Live booking, payment, refund, review, support, and closeout history from Supabase, restricted by the administrator’s assigned marketplace scope." ta="Supabase-லிருந்து live booking, payment, refund, review, support மற்றும் closeout history; admin-ன் assigned marketplace scope மூலம் கட்டுப்படுத்தப்படுகிறது." />} action={<Link href="/admin/bookings" className="button button-secondary"><AdminLiveText en="Back to bookings" ta="Bookings-க்கு திரும்பு" /></Link>} />
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {!payload && !error ? <Card><p><AdminLiveText en="Loading live booking audit…" ta="Live booking audit ஏற்றப்படுகிறது…" /></p></Card> : null}
    {booking ? <>
      <div className="admin-detail-grid">
        <Card className="admin-detail-card"><div className="admin-record-top"><div><span className="eyebrow"><AdminLiveText en="Booking record" ta="Booking பதிவு" /></span><h2>{booking.service_name}</h2></div><Badge tone={bookingTone(booking.status)}><AdminLiveStatusText status={booking.status} /></Badge></div><dl className="admin-detail-list"><div><dt><AdminLiveText en="Provider" ta="Provider" /></dt><dd>{booking.provider_name}</dd></div><div><dt><AdminLiveText en="Customer account" ta="Customer account" /></dt><dd>{booking.customer_id.slice(0, 8)}…</dd></div><div><dt><AdminLiveText en="Date/time" ta="தேதி/நேரம்" /></dt><dd>{booking.booking_date}, {booking.start_time} {booking.timezone}</dd></div><div><dt><AdminLiveText en="Duration" ta="கால அளவு" /></dt><dd>{booking.duration_minutes} <AdminLiveText en="minutes" ta="நிமிடங்கள்" /></dd></div><div><dt><AdminLiveText en="Location" ta="இடம்" /></dt><dd>{booking.location || <AdminLiveText en="Not specified" ta="குறிப்பிடப்படவில்லை" />}</dd></div><div><dt><AdminLiveText en="Price" ta="விலை" /></dt><dd>{money(booking.quoted_price, booking.currency)}</dd></div></dl></Card>
        <Card className="admin-detail-card"><span className="eyebrow"><AdminLiveText en="Current financial state" ta="தற்போதைய finance நிலை" /></span><h2><AdminLiveText en="Payment coordination" ta="Payment coordination" /></h2><Badge tone={paymentTone(booking.payment_status)}><AdminLiveText en="Payment" ta="பணம்" /> <AdminLiveStatusText status={booking.payment_status} /></Badge><p className="admin-fixture-note"><AdminLiveText en="Gateway-paid refunds must use the verified refund workflow. Directly marking a Cashfree-paid booking refunded is blocked at the database boundary." ta="Gateway மூலம் செலுத்தப்பட்ட refund verified refund workflow-ஐ மட்டுமே பயன்படுத்த வேண்டும். Cashfree-paid booking-ஐ நேரடியாக refunded என மாற்றுவது database boundary-ல் block செய்யப்படுகிறது." /></p><dl className="admin-detail-list"><div><dt><AdminLiveText en="Booking status" ta="Booking நிலை" /></dt><dd><AdminLiveStatusText status={booking.status} /></dd></div><div><dt><AdminLiveText en="Payment status" ta="Payment நிலை" /></dt><dd><AdminLiveStatusText status={booking.payment_status} /></dd></div><div><dt>Service ID</dt><dd>{booking.service_id}</dd></div></dl></Card>
      </div>
      <AdminRefundPanel bookingId={booking.id} bookingStatus={booking.status} paymentStatus={booking.payment_status} amount={booking.quoted_price} currency={booking.currency} />
      <Card className="admin-detail-card"><span className="eyebrow"><AdminLiveText en="Unified audit trail" ta="Unified audit trail" /></span><h2><AdminLiveText en="Booking + payment + refund chronology" ta="Booking + payment + refund காலவரிசை" /></h2><p className="admin-fixture-note"><AdminLiveText en="Lifecycle decisions, payment states, and refund states are shown in one chronological read model. Internal gateway references and administrative notes remain outside this shared timeline." ta="Lifecycle decisions, payment states மற்றும் refund states ஒரே chronological read model-ல் காட்டப்படும். Internal gateway references மற்றும் administrative notes இந்த shared timeline-க்கு வெளியே இருக்கும்." /></p><BookingAuditList events={payload.events} timezone={booking.timezone} /></Card>
    </> : null}
  </AdminLiveShell>;
}
