'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter, signOutWithSupabase } from '../../services/auth-adapter';
import { getBookingsForCustomer, getBookingsThroughConfiguredRepository } from '../../services/booking-repository';
import type { User } from '../../types/auth-domain';
import type { CustomerBooking } from '../../types/booking-domain';

export default function AuthenticatedAccount() {
  const [user, setUser] = useState<User>();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let currentUser: User | undefined;
      if (isSupabaseConfigured()) {
        const current = await getSupabaseBrowserUser();
        if (current) {
          currentUser = {
            id: current.id,
            name: current.user_metadata?.name ?? current.email ?? 'Account',
            email: current.email ?? '',
            phone: current.user_metadata?.phone,
            role: 'customer',
            createdAt: current.created_at,
            updatedAt: current.updated_at ?? current.created_at,
          };
        }
      } else {
        currentUser = localDevelopmentAuthAdapter.getCurrentUser();
      }
      if (cancelled) return;
      setUser(currentUser);
      if (!currentUser) return;
      try {
        const liveBookings = isSupabaseConfigured()
          ? await getBookingsThroughConfiguredRepository(currentUser.id)
          : getBookingsForCustomer(currentUser.id);
        if (!cancelled) setBookings(liveBookings);
      } catch (error) {
        if (!cancelled) setBookingError(error instanceof Error ? error.message : 'Unable to load booking activity.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => ({
    upcoming: bookings.filter((booking) => ['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    total: bookings.length,
  }), [bookings]);

  if (!user) {
    return (
      <div className="account-page-heading">
        <span className="eyebrow">takeitesee account</span>
        <h1>Your account</h1>
        <p>Sign in to view your account and bookings.</p>
        <div className="account-actions">
          <Link href="/login" className="button button-primary">Sign in</Link>
          <Link href="/signup" className="button button-secondary">Create account</Link>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    if (isSupabaseConfigured()) await signOutWithSupabase();
    else localDevelopmentAuthAdapter.signOut();
    setUser(undefined);
  };

  return (
    <div className="account-page-heading">
      <span className="eyebrow">takeitesee account</span>
      <h1>Welcome, {user.name.split(' ')[0]}.</h1>
      <p>{isSupabaseConfigured() ? 'Your production account session is active.' : 'Your local development session is active.'}</p>

      <Card className="profile-summary">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</div>
        <div><span className="eyebrow">Signed-in customer</span><h2>{user.name}</h2><p>{user.email}</p>{user.phone ? <span className="card-location">{user.phone}</span> : null}</div>
        <Badge tone="info">{user.role}</Badge>
      </Card>

      <div className="dashboard-stat-grid">
        <Card><span className="eyebrow">Upcoming</span><h2>{summary.upcoming}</h2><p>Active booking requests and scheduled services.</p></Card>
        <Card><span className="eyebrow">Completed</span><h2>{summary.completed}</h2><p>Services completed on your account.</p></Card>
        <Card><span className="eyebrow">Cancelled</span><h2>{summary.cancelled}</h2><p>Bookings cancelled from the shared lifecycle.</p></Card>
        <Card><span className="eyebrow">Total bookings</span><h2>{summary.total}</h2><p>Live bookings associated with your customer account.</p></Card>
      </div>
      {bookingError ? <p role="alert" style={{ color: '#b42318' }}>Booking activity unavailable: {bookingError}</p> : null}

      <div className="account-actions">
        <Link href="/bookings" className="button button-primary">My bookings</Link>
        <Link href="/notifications" className="button button-secondary">Notifications</Link>
        <Link href="/account/profile" className="button button-secondary">Profile</Link>
        <Link href="/account/settings" className="button button-secondary">Settings</Link>
        <Button type="button" variant="quiet" onClick={signOut}>Sign out</Button>
      </div>

      <Card className="account-provider-entry">
        <span className="eyebrow">Offer services on takeitesee</span>
        <h2>Grow from customer to provider.</h2>
        <p>Create a professional profile for your own services or register a business workspace for a team.</p>
        <div className="account-actions">
          <Link href="/provider/onboarding?type=professional" className="button button-primary">Become a Professional</Link>
          <Link href="/provider/onboarding?type=business" className="button button-secondary">Register a Business</Link>
          <Link href="/provider" className="button button-quiet">Open provider workspace</Link>
        </div>
      </Card>
    </div>
  );
}
