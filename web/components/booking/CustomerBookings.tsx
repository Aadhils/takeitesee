'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { getCurrentCustomerAsync, isSupabaseConfigured, presentationAuthAdapter, type AuthState } from '../../services/auth-adapter';
import { formatMoney } from '../../types/money';

function closeoutOutcome(booking: CustomerBooking) {
  return booking.attendanceOutcome === 'customer_no_show'
    || booking.attendanceOutcome === 'provider_no_show'
    || booking.closeoutState === 'eligible_to_close'
    || booking.closeoutState === 'closed';
}

function effectiveLabel(booking: CustomerBooking) {
  if (booking.closeoutState === 'closed') return 'finally closed';
  if (booking.closeoutState === 'eligible_to_close') return 'closeout due';
  if (booking.attendanceOutcome === 'customer_no_show') return 'customer no-show';
  if (booking.attendanceOutcome === 'provider_no_show') return 'provider no-show';
  if (booking.status === 'rescheduled') return 'reschedule requested';
  return booking.status;
}

function effectiveTone(booking: CustomerBooking): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (booking.attendanceOutcome === 'provider_no_show') return 'danger';
  if (booking.attendanceOutcome === 'customer_no_show' || booking.closeoutState === 'eligible_to_close') return 'warning';
  if (booking.closeoutState === 'closed' || booking.status === 'completed') return 'success';
  if (booking.status === 'cancelled') return 'danger';
  return 'info';
}

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [auth, setAuth] = useState<AuthState>(() => presentationAuthAdapter.getCurrentCustomer());
  const [resolved, setResolved] = useState(!isSupabaseConfigured());
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState('');

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
        if (!cancelled) { setBookings([]); setError(loadError instanceof Error ? loadError.message : 'Unable to load your bookings.'); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (resolved && !auth.authenticated) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Your bookings will appear here after you sign in.</p></section><Card><EmptyState title="Sign in to view bookings">Sign in to your account to see your customer bookings.</EmptyState></Card></div>;
  if (loading) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Loading your live bookings…</p></section></div>;
  if (error) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1></section><Card><EmptyState title="Bookings unavailable">{error}</EmptyState></Card></div>;

  const groups = [
    { title: 'Upcoming', values: bookings.filter((booking) => !closeoutOutcome(booking) && ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)) },
    { title: 'Completed', values: bookings.filter((booking) => booking.status === 'completed' && !closeoutOutcome(booking)) },
    { title: 'Closeout', values: bookings.filter(closeoutOutcome) },
    { title: 'Cancelled', values: bookings.filter((booking) => booking.status === 'cancelled' && !closeoutOutcome(booking)) },
  ];

  return <div className="bookings-page">
    <section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Live booking history including attendance and final closeout outcomes.</p></section>
    {groups.map((group) => <section className="booking-group" aria-labelledby={`group-${group.title}`} key={group.title}>
      <div className="section-heading"><h2 id={`group-${group.title}`}>{group.title}</h2><span className="results-note">{group.values.length} shown</span></div>
      {group.values.length ? <div className="booking-grid">{group.values.map((booking) => <Card className="booking-card" key={booking.bookingId}>
        <div className="booking-card-top"><div><span className="eyebrow">{booking.bookingReference}</span><h3>{booking.serviceName}</h3></div><Badge tone={effectiveTone(booking)}>{effectiveLabel(booking)}</Badge></div>
        <p className="card-provider">{booking.providerName || (booking.providerType === 'business' ? 'Business provider' : 'Professional provider')}</p>
        <div className="booking-card-meta"><span>{booking.bookingDate}, {booking.startTime}</span><span>{formatMoney({ amount: booking.basePrice, currency: booking.currency })}</span><Badge tone="neutral">{booking.paymentStatus}</Badge></div>
        <Link href={`/bookings/${booking.bookingId}`} className="button button-secondary">View booking details</Link>
      </Card>)}</div> : <Card><EmptyState title={`No ${group.title.toLowerCase()} bookings`}>Bookings in this lifecycle state will appear here when available.</EmptyState></Card>}
    </section>)}
  </div>;
}
