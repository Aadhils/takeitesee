'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading, ProviderShell } from './ProviderPresentation';

type Profile = { display_name: string; business_name: string; provider_type: string; verification: string; active_services: number; total_services: number; service_area: string };
type Earnings = { currency: string; available_balance: number; pending_earnings: number; total_earnings: number; total_completed_count: number };
type Booking = { id: string; booking_reference: string; service_name?: string; status: string; payment_status?: string; booking_date?: string | null; booking_time?: string | null; quoted_price?: number | null; currency?: string | null };

function money(amount: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export default function ProviderDashboardManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { void (async () => {
    try {
      setLoading(true);
      const [profileResponse, earningsResponse, bookingsResponse] = await Promise.all([
        fetch('/api/provider/profile', { cache: 'no-store' }),
        fetch('/api/provider/earnings', { cache: 'no-store' }),
        fetch('/api/provider/bookings', { cache: 'no-store' }),
      ]);
      const profilePayload = await profileResponse.json();
      const earningsPayload = await earningsResponse.json();
      const bookingsPayload = await bookingsResponse.json();
      if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error ?? 'Unable to load provider profile.');
      if (!earningsResponse.ok || !earningsPayload.summary) throw new Error(earningsPayload.error ?? 'Unable to load earnings.');
      if (!bookingsResponse.ok) throw new Error(bookingsPayload.error ?? 'Unable to load bookings.');
      setProfile(profilePayload.profile);
      setEarnings(earningsPayload.summary);
      setBookings(Array.isArray(bookingsPayload.bookings) ? bookingsPayload.bookings : Array.isArray(bookingsPayload) ? bookingsPayload : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  })(); }, []);

  const pending = bookings.filter((b) => ['requested', 'provider_review', 'reschedule_requested'].includes(b.status));
  const upcoming = bookings.filter((b) => ['accepted', 'scheduled', 'in_progress'].includes(b.status)).slice(0, 4);
  const completed = bookings.filter((b) => b.status === 'completed');
  const currency = earnings?.currency ?? 'INR';

  return <ProviderShell active="/provider">
    <ProviderHeading eyebrow="Provider workspace" title={profile ? `${profile.display_name} dashboard` : 'Provider dashboard'} description="Live operational summary from your provider profile, bookings, services, and earnings." />
    {loading ? <Card><p>Loading live provider dashboard…</p></Card> : null}
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {profile && earnings ? <>
      <div className="provider-summary-grid">
        <ProviderDashboardSummary label="Pending requests" value={String(pending.length)} detail="Needs provider attention" tone={pending.length ? 'warning' : 'success'} />
        <ProviderDashboardSummary label="Upcoming work" value={String(upcoming.length)} detail="Accepted, scheduled or active" tone="info" />
        <ProviderDashboardSummary label="Completed jobs" value={String(completed.length)} detail={`${earnings.total_completed_count} reflected in earnings`} tone="success" />
        <ProviderDashboardSummary label="Available balance" value={money(earnings.available_balance, currency)} detail={`${money(earnings.pending_earnings, currency)} awaiting payment`} tone="success" />
      </div>
      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Live provider</span><h2>{profile.business_name}</h2></div><Badge tone="success">{profile.verification}</Badge></div>
          <p>{profile.provider_type === 'business' ? 'Business provider' : 'Professional provider'} · {profile.service_area || 'Service area not set'}</p>
          <div className="provider-profile-services"><div><strong>Active services</strong><span>{profile.active_services} of {profile.total_services}</span></div><div><strong>Total earnings</strong><span>{money(earnings.total_earnings, currency)}</span></div></div>
          <Link href="/provider/profile" className="text-link">View live profile</Link>
        </Card>
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Next jobs</h2></div><Badge tone="success">Live bookings</Badge></div>
          {upcoming.length ? <div className="provider-profile-services">{upcoming.map((booking) => <div key={booking.id}><strong>{booking.service_name || booking.booking_reference}</strong><span>{booking.booking_date || 'Date pending'}{booking.booking_time ? ` · ${booking.booking_time}` : ''} · {booking.status}</span><Link href={`/provider/bookings/${booking.id}`} className="text-link">View</Link></div>)}</div> : <EmptyState title="No upcoming jobs">Accepted and scheduled work will appear here.</EmptyState>}
        </Card>
      </div>
      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">Provider status</span><h2>Production connection</h2></div><Badge tone="success">Supabase connected</Badge></div><p>Dashboard values are read from the signed-in provider's live profile, booking, service, and earnings APIs. Fixture dashboard totals are no longer used.</p></Card>
    </> : null}
  </ProviderShell>;
}
