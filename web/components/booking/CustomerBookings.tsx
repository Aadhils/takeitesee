'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { getCurrentCustomerAsync, isSupabaseConfigured, presentationAuthAdapter, type AuthState } from '../../services/auth-adapter';

function closeoutOutcome(booking: CustomerBooking) {
  return booking.attendanceOutcome === 'customer_no_show'
    || booking.attendanceOutcome === 'provider_no_show'
    || booking.closeoutState === 'eligible_to_close'
    || booking.closeoutState === 'closed';
}

function effectiveTone(booking: CustomerBooking): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (booking.attendanceOutcome === 'provider_no_show') return 'danger';
  if (booking.attendanceOutcome === 'customer_no_show' || booking.closeoutState === 'eligible_to_close') return 'warning';
  if (booking.closeoutState === 'closed' || booking.status === 'completed') return 'success';
  if (booking.status === 'cancelled') return 'danger';
  return 'info';
}

const bookingStatusLabels: Record<string, { en: string; ta: string }> = {
  pending: { en: 'Pending', ta: 'நிலுவையில்' },
  confirmed: { en: 'Confirmed', ta: 'உறுதிசெய்யப்பட்டது' },
  accepted: { en: 'Accepted', ta: 'ஏற்கப்பட்டது' },
  in_progress: { en: 'In progress', ta: 'செயலில் உள்ளது' },
  completed: { en: 'Completed', ta: 'முடிந்தது' },
  cancelled: { en: 'Cancelled', ta: 'ரத்து செய்யப்பட்டது' },
  rescheduled: { en: 'Reschedule requested', ta: 'மறுஅட்டவணை கோரப்பட்டது' },
};

const paymentStatusLabels: Record<string, { en: string; ta: string }> = {
  unpaid: { en: 'Unpaid', ta: 'செலுத்தப்படவில்லை' },
  pending: { en: 'Pending', ta: 'நிலுவையில்' },
  paid: { en: 'Paid', ta: 'செலுத்தப்பட்டது' },
  refunded: { en: 'Refunded', ta: 'திருப்பிச் செலுத்தப்பட்டது' },
  failed: { en: 'Failed', ta: 'தோல்வி' },
};

export default function CustomerBookings() {
  const { locale } = useLanguage();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [auth, setAuth] = useState<AuthState>(() => presentationAuthAdapter.getCurrentCustomer());
  const [resolved, setResolved] = useState(!isSupabaseConfigured());
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState('');
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const mappedLabel = (value: string, labels: Record<string, { en: string; ta: string }>) => {
    const mapped = labels[value.toLowerCase()];
    return mapped ? (locale === 'ta-IN' ? mapped.ta : mapped.en) : value.replaceAll('_', ' ');
  };
  const effectiveLabel = (booking: CustomerBooking) => {
    if (booking.closeoutState === 'closed') return text('Finally closed', 'இறுதியாக மூடப்பட்டது');
    if (booking.closeoutState === 'eligible_to_close') return text('Closeout due', 'Closeout நிலுவையில்');
    if (booking.attendanceOutcome === 'customer_no_show') return text('Customer no-show', 'வாடிக்கையாளர் வரவில்லை');
    if (booking.attendanceOutcome === 'provider_no_show') return text('Provider no-show', 'வழங்குநர் வரவில்லை');
    return mappedLabel(booking.status, bookingStatusLabels);
  };
  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };
  const displayDate = (value: string) => {
    try {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parsed);
    } catch { return value; }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      const currentAuth = await getCurrentCustomerAsync();
      if (cancelled) return;
      setAuth(currentAuth); setResolved(true);
      if (!currentAuth.authenticated) { setBookings([]); setLoading(false); return; }
      try {
        const value = isSupabaseConfigured() ? await getBookingsThroughConfiguredRepository(currentAuth.customerId) : getBookingsForCustomer(currentAuth.customerId);
        if (!cancelled) setBookings(value);
      } catch (loadError) {
        if (!cancelled) { setBookings([]); setError(loadError instanceof Error ? loadError.message : text('Unable to load your bookings.', 'உங்கள் bookings-ஐ ஏற்ற முடியவில்லை.')); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (resolved && !auth.authenticated) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">{text('Customer space', 'வாடிக்கையாளர் பகுதி')}</span><h1>{text('My bookings', 'என் bookings')}</h1><p>{text('Your bookings will appear here after you sign in.', 'நீங்கள் sign in செய்த பிறகு உங்கள் bookings இங்கே தோன்றும்.')}</p></section><Card><EmptyState title={text('Sign in to view bookings', 'Bookings பார்க்க sign in செய்யவும்')}>{text('Sign in to your account to see your customer bookings.', 'உங்கள் customer bookings-ஐ பார்க்க account-ல் sign in செய்யவும்.')}</EmptyState></Card></div>;
  if (loading) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">{text('Customer space', 'வாடிக்கையாளர் பகுதி')}</span><h1>{text('My bookings', 'என் bookings')}</h1><p>{text('Loading your live bookings…', 'உங்கள் live bookings ஏற்றப்படுகின்றன…')}</p></section></div>;
  if (error) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">{text('Customer space', 'வாடிக்கையாளர் பகுதி')}</span><h1>{text('My bookings', 'என் bookings')}</h1></section><Card><EmptyState title={text('Bookings unavailable', 'Bookings கிடைக்கவில்லை')}>{error}</EmptyState></Card></div>;

  const groups = [
    { key: 'upcoming', title: text('Upcoming', 'வரவிருப்பவை'), values: bookings.filter((booking) => !closeoutOutcome(booking) && ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)) },
    { key: 'completed', title: text('Completed', 'முடிந்தவை'), values: bookings.filter((booking) => booking.status === 'completed' && !closeoutOutcome(booking)) },
    { key: 'closeout', title: text('Closeout', 'Closeout'), values: bookings.filter(closeoutOutcome) },
    { key: 'cancelled', title: text('Cancelled', 'ரத்து செய்யப்பட்டவை'), values: bookings.filter((booking) => booking.status === 'cancelled' && !closeoutOutcome(booking)) },
  ];

  return <div className="bookings-page">
    <section className="page-intro"><span className="eyebrow">{text('Customer space', 'வாடிக்கையாளர் பகுதி')}</span><h1>{text('My bookings', 'என் bookings')}</h1><p>{text('Live booking history including attendance and final closeout outcomes.', 'Attendance மற்றும் final closeout outcomes உட்பட live booking history.')}</p></section>
    {groups.map((group) => <section className="booking-group" aria-labelledby={`group-${group.key}`} key={group.key}>
      <div className="section-heading"><h2 id={`group-${group.key}`}>{group.title}</h2><span className="results-note">{text(`${group.values.length} shown`, `${group.values.length} காட்டப்படுகிறது`)}</span></div>
      {group.values.length ? <div className="booking-grid">{group.values.map((booking) => <Card className="booking-card" key={booking.bookingId}>
        <div className="booking-card-top"><div><span className="eyebrow">{booking.bookingReference}</span><h3>{booking.serviceName}</h3></div><Badge tone={effectiveTone(booking)}>{effectiveLabel(booking)}</Badge></div>
        <p className="card-provider">{booking.providerName || (booking.providerType === 'business' ? text('Business provider', 'வணிக வழங்குநர்') : text('Professional provider', 'நிபுணர் வழங்குநர்'))}</p>
        <div className="booking-card-meta"><span>{displayDate(booking.bookingDate)}, {booking.startTime}</span><span>{money(booking.basePrice, booking.currency)}</span><Badge tone="neutral">{mappedLabel(booking.paymentStatus, paymentStatusLabels)}</Badge></div>
        <Link href={`/bookings/${booking.bookingId}`} className="button button-secondary">{text('View booking details', 'Booking விவரங்களை பார்க்க')}</Link>
      </Card>)}</div> : <Card><EmptyState title={text(`No ${group.title.toLowerCase()} bookings`, `${group.title} bookings இல்லை`)}>{text('Bookings in this lifecycle state will appear here when available.', 'இந்த lifecycle நிலையில் bookings கிடைக்கும் போது இங்கே தோன்றும்.')}</EmptyState></Card>}
    </section>)}
  </div>;
}
