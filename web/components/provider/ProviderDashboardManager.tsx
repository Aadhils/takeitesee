'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type Profile = { display_name: string; provider_type: string; verified: boolean; services_active: number; services_total: number; location: string };
type Earnings = { currency: string; available_balance: number; pending_earnings: number; total_earnings: number; total_completed_count: number };
type Booking = {
  id: string; booking_reference: string; service_name?: string; status: string; payment_status?: string; booking_date?: string | null; start_time?: string | null;
  timezone?: string | null; duration_minutes?: number | null; quoted_price?: number | null; currency?: string | null;
  attendance_outcome?: 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
  closeout_state?: 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';
};

function money(amount: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = targetUtc;
    for (let index = 0; index < 3; index += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
      guess += targetUtc - representedUtc;
    }
    return guess;
  } catch { return new Date(`${date}T${time.slice(0, 8)}Z`).getTime(); }
}

function bookingEndEpoch(booking: Booking) {
  if (!booking.booking_date || !booking.start_time) return Number.POSITIVE_INFINITY;
  const start = zonedDateTimeToEpoch(booking.booking_date, booking.start_time, booking.timezone || 'Asia/Kolkata');
  return start + Number(booking.duration_minutes || 0) * 60_000;
}

function terminalCloseout(booking: Booking) {
  return booking.attendance_outcome === 'customer_no_show'
    || booking.attendance_outcome === 'provider_no_show'
    || booking.closeout_state === 'eligible_to_close'
    || booking.closeout_state === 'closed';
}

export default function ProviderDashboardManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
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
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const operations = useMemo(() => {
    const needsAction = bookings.filter((booking) => !terminalCloseout(booking) && (
      booking.status === 'pending'
      || booking.status === 'rescheduled'
      || (booking.status === 'confirmed' && (booking.attendance_outcome ?? 'pending') === 'pending' && bookingEndEpoch(booking) <= now)));
    const upcoming = bookings
      .filter((booking) => !terminalCloseout(booking) && booking.status === 'confirmed' && (booking.attendance_outcome ?? 'pending') === 'pending' && bookingEndEpoch(booking) > now)
      .sort((left, right) => bookingEndEpoch(left) - bookingEndEpoch(right))
      .slice(0, 4);
    const completed = bookings.filter((booking) => booking.status === 'completed');
    const closeout = bookings.filter(terminalCloseout);
    return { needsAction, upcoming, completed, closeout };
  }, [bookings, now]);

  const currency = earnings?.currency ?? 'INR';

  return <LiveProviderShell active="/provider">
    <ProviderHeading eyebrow="Provider workspace" title={profile ? `${profile.display_name} dashboard` : 'Provider dashboard'} description="Live operations including booking actions, attendance outcomes, closeout and recognized earnings." />
    {loading ? <Card><p>Loading live provider dashboard…</p></Card> : null}
    {error ? <Card><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p></Card> : null}
    {profile && earnings ? <>
      <div className="provider-summary-grid">
        <ProviderDashboardSummary label="Needs action" value={String(operations.needsAction.length)} detail="Requests, reschedules, or completion tasks" tone={operations.needsAction.length ? 'warning' : 'success'} />
        <ProviderDashboardSummary label="Upcoming work" value={String(operations.upcoming.length)} detail="Future confirmed bookings" tone="info" />
        <ProviderDashboardSummary label="Closeout" value={String(operations.closeout.length)} detail="No-shows, SLA closeout, or final closure" tone={operations.closeout.length ? 'warning' : 'success'} />
        <ProviderDashboardSummary label="Recognized earnings" value={money(earnings.available_balance, currency)} detail={`${money(earnings.pending_earnings, currency)} completed but awaiting payment`} tone="success" />
      </div>
      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Live provider</span><h2>{profile.display_name}</h2></div><Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Unverified'}</Badge></div>
          <p>{profile.provider_type === 'business' ? 'Business provider' : 'Professional provider'} · {profile.location || 'Service area not set'}</p>
          <div className="provider-profile-services"><div><strong>Active services</strong><span>{profile.services_active} of {profile.services_total}</span></div><div><strong>Completed jobs</strong><span>{operations.completed.length}</span></div><div><strong>Lifetime earned</strong><span>{money(earnings.total_earnings, currency)}</span></div></div>
          <Link href="/provider/profile" className="text-link">View live profile</Link>
        </Card>
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Next jobs</h2></div><Badge tone="success">Live bookings</Badge></div>
          {operations.upcoming.length ? <div className="provider-profile-services">{operations.upcoming.map((booking) => <div key={booking.id}><strong>{booking.service_name || booking.booking_reference}</strong><span>{booking.booking_date || 'Date pending'}{booking.start_time ? ` · ${booking.start_time}` : ''} · confirmed</span><Link href={`/provider/bookings/${booking.id}`} className="text-link">View</Link></div>)}</div> : <EmptyState title="No upcoming jobs">Future confirmed work will appear here.</EmptyState>}
        </Card>
      </div>
      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">Provider status</span><h2>Production connection</h2></div><Badge tone="success">Supabase connected</Badge></div><p>Dashboard values are read from live provider, booking, closeout, service, and payment-aware earnings APIs. No-show outcomes are removed from completion work and handled through closeout/support.</p></Card>
    </> : null}
  </LiveProviderShell>;
}
