'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

type Profile = {
  display_name: string;
  provider_type: 'professional' | 'business';
  verified: boolean;
  marketplace_disclosure_complete: boolean;
  services_active: number;
  services_total: number;
  location: string;
};

type Booking = {
  id: string;
  booking_reference: string;
  service_name?: string;
  status: string;
  payment_status?: string;
  booking_date?: string | null;
  start_time?: string | null;
  timezone?: string | null;
  duration_minutes?: number | null;
  quoted_price?: number | null;
  currency?: string | null;
  attendance_outcome?: 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
  closeout_state?: 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';
};

type DashboardLink = { href: string; label: string; detail: string };

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = targetUtc;
    for (let index = 0; index < 3; index += 1) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const representedUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
      );
      guess += targetUtc - representedUtc;
    }
    return guess;
  } catch {
    return new Date(`${date}T${time.slice(0, 8)}Z`).getTime();
  }
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

function QuickLinkList({ links }: { links: DashboardLink[] }) {
  return <div className="provider-profile-services">
    {links.map((link) => <div key={link.href}>
      <strong>{link.label}</strong>
      <span>{link.detail}</span>
      <Link href={link.href} className="text-link">Open</Link>
    </div>)}
  </div>;
}

export default function ProviderDashboardManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [bookingsError, setBookingsError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setProfileError('');
    setBookingsError('');

    const [profileResult, bookingsResult] = await Promise.allSettled([
      fetch('/api/provider/profile', { cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json() })),
      fetch('/api/provider/bookings', { cache: 'no-store' }).then(async (response) => ({ response, payload: await response.json() })),
    ]);

    if (profileResult.status === 'fulfilled') {
      const { response, payload } = profileResult.value;
      if (response.ok && payload.profile) setProfile(payload.profile as Profile);
      else {
        setProfile(null);
        setProfileError(payload.error ?? 'Unable to load provider profile.');
      }
    } else {
      setProfile(null);
      setProfileError(profileResult.reason instanceof Error ? profileResult.reason.message : 'Unable to load provider profile.');
    }

    if (bookingsResult.status === 'fulfilled') {
      const { response, payload } = bookingsResult.value;
      if (response.ok) {
        setBookings(Array.isArray(payload.bookings) ? payload.bookings : Array.isArray(payload) ? payload : []);
      } else {
        setBookings([]);
        setBookingsError(payload.error ?? 'Unable to load booking activity.');
      }
    } else {
      setBookings([]);
      setBookingsError(bookingsResult.reason instanceof Error ? bookingsResult.reason.message : 'Unable to load booking activity.');
    }

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('booking:provider-list-refresh', refresh);
    return () => window.removeEventListener('booking:provider-list-refresh', refresh);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const operations = useMemo(() => {
    const needsAction = bookings.filter((booking) => !terminalCloseout(booking) && (
      booking.status === 'pending'
      || booking.status === 'rescheduled'
      || (booking.status === 'confirmed'
        && (booking.attendance_outcome ?? 'pending') === 'pending'
        && bookingEndEpoch(booking) <= now)
    ));
    const upcoming = bookings
      .filter((booking) => !terminalCloseout(booking)
        && booking.status === 'confirmed'
        && (booking.attendance_outcome ?? 'pending') === 'pending'
        && bookingEndEpoch(booking) > now)
      .sort((left, right) => bookingEndEpoch(left) - bookingEndEpoch(right))
      .slice(0, 4);
    const completed = bookings.filter((booking) => booking.status === 'completed');
    return { needsAction, upcoming, completed };
  }, [bookings, now]);

  const roleLabel = profile?.provider_type === 'business'
    ? 'Business · Service business + Employer'
    : 'Professional · Independent provider + Job seeker';

  const profileReadiness = profile
    ? profile.verified && profile.marketplace_disclosure_complete
      ? { value: 'Ready', detail: 'Verified and public details complete', tone: 'success' as const }
      : profile.verified
        ? { value: 'Finish setup', detail: 'Complete public marketplace details', tone: 'warning' as const }
        : { value: 'Verify', detail: 'Verification is still required', tone: 'warning' as const }
    : { value: '—', detail: 'Provider profile is loading', tone: 'neutral' as const };

  const nextSteps = useMemo<DashboardLink[]>(() => {
    if (!profile) return [];
    const items: DashboardLink[] = [];

    if (!profile.verified) {
      items.push({ href: '/provider/verification', label: 'Complete verification', detail: 'Unlock trusted marketplace participation.' });
    }
    if (!profile.marketplace_disclosure_complete) {
      items.push({
        href: profile.provider_type === 'professional' ? '/provider/public-readiness' : '/provider/setup',
        label: 'Finish public profile',
        detail: 'Complete the details customers need before choosing you.',
      });
    }
    if (profile.services_total === 0) {
      items.push({ href: '/provider/services', label: 'Add your first service', detail: 'Create the service customers can discover and book.' });
    } else if (profile.services_active === 0) {
      items.push({ href: '/provider/services', label: 'Publish an active service', detail: 'Your services exist but none are currently active.' });
    }
    if (operations.needsAction.length > 0) {
      items.push({ href: '/provider/bookings', label: `Handle ${operations.needsAction.length} booking action${operations.needsAction.length === 1 ? '' : 's'}`, detail: 'Review requests, reschedules or completion tasks.' });
    } else if (operations.upcoming.length > 0) {
      items.push({ href: '/provider/schedule', label: 'Review your upcoming schedule', detail: `${operations.upcoming.length} confirmed booking${operations.upcoming.length === 1 ? '' : 's'} coming up.` });
    }

    if (profile.provider_type === 'professional') {
      items.push({ href: '/provider/jobs/applications', label: 'Check your career journey', detail: 'Applications, interviews and job progress in one place.' });
    } else {
      items.push({ href: '/provider/jobs', label: 'Check your hiring pipeline', detail: 'Jobs, applicants, interviews and offers in one place.' });
    }

    return items.slice(0, 3);
  }, [operations.needsAction.length, operations.upcoming.length, profile]);

  const customerActions: DashboardLink[] = [
    { href: '/provider/leads', label: 'Leads', detail: 'Review new customer opportunities.' },
    { href: '/provider/messages', label: 'Messages', detail: 'Continue active customer conversations.' },
    { href: '/provider/bookings', label: 'Bookings', detail: 'Manage requests and service delivery.' },
    { href: '/provider/schedule', label: 'Schedule', detail: 'Plan availability and upcoming work.' },
  ];

  const roleActions: DashboardLink[] = profile?.provider_type === 'business'
    ? [
        { href: '/provider/jobs', label: 'Employer jobs', detail: 'Post jobs and manage the hiring journey.' },
        { href: '/provider/jobs/applicants', label: 'Applicant finder', detail: 'Review Professionals across your job posts.' },
        { href: '/provider/services', label: 'Business services', detail: 'Manage services customers can book.' },
        { href: '/provider/profile', label: 'Business profile', detail: 'Review your public business identity.' },
      ]
    : [
        { href: '/jobs', label: 'Find jobs', detail: 'Browse jobs published by verified Businesses.' },
        { href: '/provider/jobs/applications', label: 'My applications', detail: 'Track applications and interviews.' },
        { href: '/provider/resume', label: 'Resume & Career', detail: 'Keep your career profile ready to apply.' },
        { href: '/provider/portfolio', label: 'Portfolio', detail: 'Show customers your previous work.' },
      ];

  const dashboardTitle = profile?.provider_type === 'business' ? 'Business dashboard' : profile?.provider_type === 'professional' ? 'Professional dashboard' : 'Provider dashboard';
  const dashboardDescription = profile?.provider_type === 'business'
    ? 'Your business command center for services, customer work and hiring.'
    : profile?.provider_type === 'professional'
      ? 'Your command center for services, customer work and career opportunities.'
      : 'Your provider workspace at a glance.';

  return <LiveProviderShell active="/provider">
    <ProviderHeading
      eyebrow={profile ? roleLabel : 'Provider workspace'}
      title={dashboardTitle}
      description={dashboardDescription}
      action={profile ? <Link href={profile.provider_type === 'professional' ? '/provider/public-readiness' : '/provider/profile'} className="button button-secondary">View public profile</Link> : undefined}
    />

    {loading ? <Card className="provider-profile-card"><p>Preparing your workspace overview…</p></Card> : null}
    {profileError ? <Card className="provider-profile-card"><p role="alert" style={{ color: 'var(--color-danger)' }}>{profileError}</p><Link href="/provider/setup" className="text-link">Open provider setup</Link></Card> : null}

    {profile ? <>
      <div className="provider-summary-grid">
        <ProviderDashboardSummary
          label="Needs action"
          value={bookingsError ? '—' : String(operations.needsAction.length)}
          detail={bookingsError ? 'Booking activity temporarily unavailable' : 'Requests, reschedules or completion tasks'}
          tone={bookingsError ? 'warning' : operations.needsAction.length ? 'warning' : 'success'}
        />
        <ProviderDashboardSummary
          label="Upcoming work"
          value={bookingsError ? '—' : String(operations.upcoming.length)}
          detail={bookingsError ? 'Open Bookings to retry' : 'Future confirmed bookings'}
          tone={bookingsError ? 'warning' : 'info'}
        />
        <ProviderDashboardSummary
          label="Active services"
          value={`${profile.services_active}/${profile.services_total}`}
          detail={profile.services_active ? 'Visible service catalog' : 'Add or publish a service'}
          tone={profile.services_active ? 'success' : 'warning'}
        />
        <ProviderDashboardSummary
          label="Profile readiness"
          value={profileReadiness.value}
          detail={profileReadiness.detail}
          tone={profileReadiness.tone}
        />
      </div>

      <Card className="provider-profile-card">
        <div className="section-heading">
          <div><span className="eyebrow">Smart next steps</span><h2>What should I do next?</h2></div>
          <Badge tone={nextSteps.length ? 'info' : 'success'}>{nextSteps.length ? `${nextSteps.length} suggested` : 'All clear'}</Badge>
        </div>
        {nextSteps.length ? <QuickLinkList links={nextSteps} /> : <EmptyState title="You are all caught up">New actions will appear here when your workspace needs attention.</EmptyState>}
      </Card>

      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Customer work</span><h2>Run your day</h2></div><Badge tone="info">Quick access</Badge></div>
          <QuickLinkList links={customerActions} />
        </Card>
        <Card className="provider-profile-card">
          <div className="section-heading">
            <div><span className="eyebrow">{profile.provider_type === 'business' ? 'Hiring & business' : 'Career & presence'}</span><h2>{profile.provider_type === 'business' ? 'Grow your team' : 'Grow your opportunities'}</h2></div>
            <Badge tone="info">{profile.provider_type === 'business' ? 'Employer' : 'Professional'}</Badge>
          </div>
          <QuickLinkList links={roleActions} />
        </Card>
      </div>

      <div className="provider-profile-grid">
        <Card className="provider-profile-card">
          <div className="section-heading">
            <div><span className="eyebrow">Your identity</span><h2>{profile.display_name}</h2></div>
            <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? 'Verified' : 'Verification required'}</Badge>
          </div>
          <p>{roleLabel} · {profile.location || 'Service area not set'}</p>
          <div className="provider-profile-services">
            <div><strong>Services</strong><span>{profile.services_active} active of {profile.services_total} total</span></div>
            <div><strong>Completed work</strong><span>{bookingsError ? 'Booking activity unavailable' : `${operations.completed.length} completed booking${operations.completed.length === 1 ? '' : 's'}`}</span></div>
            <div><strong>Public details</strong><span>{profile.marketplace_disclosure_complete ? 'Complete' : 'Needs attention'}</span></div>
          </div>
          <Link href="/provider/profile" className="text-link">Open profile</Link>
        </Card>

        <Card className="provider-profile-card">
          <div className="section-heading"><div><span className="eyebrow">Upcoming</span><h2>Next bookings</h2></div><Badge tone={bookingsError ? 'warning' : 'success'}>{bookingsError ? 'Retry needed' : 'Live'}</Badge></div>
          {bookingsError
            ? <EmptyState title="Booking activity could not load"><Link href="/provider/bookings" className="text-link">Open Bookings to retry</Link></EmptyState>
            : operations.upcoming.length
              ? <div className="provider-profile-services">{operations.upcoming.map((booking) => <div key={booking.id}><strong>{booking.service_name || booking.booking_reference}</strong><span>{booking.booking_date || 'Date pending'}{booking.start_time ? ` · ${booking.start_time}` : ''} · confirmed</span><Link href={`/provider/bookings/${booking.id}`} className="text-link">View booking</Link></div>)}</div>
              : <EmptyState title="No upcoming bookings">Future confirmed work will appear here.</EmptyState>}
        </Card>
      </div>
    </> : null}
  </LiveProviderShell>;
}
