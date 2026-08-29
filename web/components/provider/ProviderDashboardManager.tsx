'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type Profile = { display_name: string; provider_type: string; verified: boolean; services_active: number; services_total: number; location: string };
type Earnings = { currency: string; available_balance: number; pending_earnings: number; total_earnings: number; total_completed_count: number };
type Booking = { id: string; booking_reference: string; service_name?: string; status: string; payment_status?: string; booking_date?: string | null; start_time?: string | null; booking_time?: string | null; quoted_price?: number | null; currency?: string | null };

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

  const pending = bookings.filter((b) => ['pending', 'rescheduled'].includes(b.status));
  const upcoming = bookings.filter((b) => b.status === 'confirmed').slice(0, 4);
  const completed = bookings.filter((b) => b.status === 'completed');
  const currency = earnings?.currency ?? 'INR';

  return <LiveProviderShell active="/provider">
    <ProviderHeading eyebrow="Provider workspace" title={profile ? `${profile.display_name} dashboard` : 'Provider dashboard'} description="Live operational summary from your provider profile, bookings, services, and earnings." />
    {loading ? <Card><p>Loading live provider dashboard…</p></Card> : null}
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {profile && earnings ? <>
      <div className="provider-summary-grid">
        <ProviderDashboardSummary label="Requests needing action" value={String(pending.length)} detail="New bookings and reschedule requests" tone={pending.length ? 'warning' : 'success'} />
        <ProviderDashboardSummary label="Upcoming work" value={String(upcoming.length)} detail="Confirmed bookings" tone="info" />
        <ProviderDashboardSummary label="Completed jobs" value={String(completed.length)} detail={`${earnings.total_completed_count} reflected in earnings`} tone="success" />
        <ProviderDashboardSummary label="Available balance" value={money(earnings.available_balance, currency)} detail={`${money(earnings.pending_earnings, currency)} awaiting payment`} tone="success" />
      </div>
      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Live provider</span><h2>{profile.display_name}</h2></div><Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Unverified'}</Badge></div>
          <p>{profile.provider_type === 'business' ? 'Business provider' : 'Professional provider'} · {profile.location || 'Service area not set'}</p>
          <div className="provider-profile-services"><div><strong>Active services</strong><span>{profile.services_active} of {profile.services_total}</span></div><div><strong>Total earnings</strong><span>{money(earnings.total_earnings, currency)}</span></div></div>
          <Link href="/provider/profile" className="text-link">View live profile</Link>
        </Card>
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Next jobs</h2></div><Badge tone="success">Live bookings</Badge></div>
          {upcoming.length ? <div className="provider-profile-services">{upcoming.map((booking) => <div key={booking.id}><strong>{booking.service_name || booking.booking_reference}</strong><span>{booking.booking_date || 'Date pending'}{(booking.start_time || booking.booking_time) ? ` · ${booking.start_time || booking.booking_time}` : ''} · {booking.status}</span><Link href={`/provider/bookings/${booking.id}`} className="text-link">View</Link></div>)}</div> : <EmptyState title="No upcoming jobs">Confirmed work will appear here.</EmptyState>}
        </Card>
      </div>
      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">Provider status</span><h2>Production connection</h2></div><Badge tone="success">Supabase connected</Badge></div><p>Dashboard values are read from the signed-in provider's live profile, booking, service, and earnings APIs. Fixture dashboard totals are no longer used.</p></Card>
    </> : null}
  </LiveProviderShell>;
}
