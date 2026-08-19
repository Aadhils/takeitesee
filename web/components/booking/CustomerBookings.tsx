'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { CustomerBooking } from '../../types/booking-domain';
import { getCurrentCustomerAsync, isSupabaseConfigured, presentationAuthAdapter, type AuthState } from '../../services/auth-adapter';
import { formatMoney } from '../../types/money';

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [auth, setAuth] = useState<AuthState>(() => presentationAuthAdapter.getCurrentCustomer());
  const [resolved, setResolved] = useState(!isSupabaseConfigured());
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const currentAuth = await getCurrentCustomerAsync();
      if (cancelled) return;
      setAuth(currentAuth);
      setResolved(true);
      if (!currentAuth.authenticated) { setBookings([]); return; }
      if (isSupabaseConfigured()) {
        void getBookingsThroughConfiguredRepository(currentAuth.customerId).then((value) => { if (!cancelled) setBookings(value); }).catch(() => { if (!cancelled) setBookings([]); });
      } else setBookings(getBookingsForCustomer(currentAuth.customerId));
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  if (resolved && !auth.authenticated) return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Your bookings will appear here after you sign in.</p></section><Card><EmptyState title="Sign in to view bookings">Sign in to your account to see your customer bookings.</EmptyState></Card></div>;
  const groups = [{ title: 'Upcoming', values: bookings.filter((booking) => ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)) }, { title: 'Completed', values: bookings.filter((booking) => booking.status === 'completed') }, { title: 'Cancelled', values: bookings.filter((booking) => booking.status === 'cancelled') }];
  return <div className="bookings-page"><section className="page-intro"><span className="eyebrow">Customer space</span><h1>My bookings</h1><p>Review your upcoming, completed, and cancelled bookings.</p></section>{groups.map((group) => <section className="booking-group" aria-labelledby={`group-${group.title}`} key={group.title}><div className="section-heading"><h2 id={`group-${group.title}`}>{group.title}</h2><span className="results-note">{group.values.length} shown</span></div>{group.values.length ? <div className="booking-grid">{group.values.map((booking) => <Card className="booking-card" key={booking.bookingId}><div className="booking-card-top"><div><span className="eyebrow">{booking.bookingReference}</span><h3>{booking.serviceName}</h3></div><Badge tone={booking.status === 'completed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'info'}>{booking.status}</Badge></div><p className="card-provider">{booking.providerName}</p><div className="booking-card-meta"><span>{booking.bookingDate}, {booking.startTime}</span><span>{formatMoney({ amount: booking.basePrice, currency: booking.currency })}</span><Badge tone="neutral">{booking.paymentStatus}</Badge></div><Link href={`/bookings/${booking.bookingId}`} className="button button-secondary">View booking details</Link></Card>)}</div> : <Card><EmptyState title={`No ${group.title.toLowerCase()} bookings`}>Bookings in this state will appear here when available.</EmptyState></Card>}</section>)}</div>;
}
